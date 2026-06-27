import { app, ipcMain, net, shell } from 'electron'
import { randomUUID } from 'node:crypto'
import { appendFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { closeSync, createWriteStream, mkdirSync, openSync, readSync, statSync } from 'node:fs'
import { chmodSync } from 'node:fs'
import { join, extname, basename } from 'node:path'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const CLIENT_UPDATE_TEMP_PREFIX = 'arena-client-update'
const DOWNLOAD_TIMEOUT_MS = 30 * 60 * 1000
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024
const MIN_INSTALLER_BYTES = 64 * 1024

export type ClientUpdateProgressPayload = {
  phase: 'download' | 'install'
  percent?: number
  receivedBytes?: number
  totalBytes?: number | null
}

let pendingInstallerOnQuit: string | null = null
let quitInstallHookRegistered = false

function logClientUpdate(message: string): void {
  try {
    const line = `[${new Date().toISOString()}] ${message}\n`
    appendFileSync(join(app.getPath('userData'), 'client-update.log'), line, 'utf8')
  } catch {
    /* ignore */
  }
}

function getPendingUpdateDir(): string {
  const dir = join(app.getPath('userData'), CLIENT_UPDATE_TEMP_PREFIX)
  mkdirSync(dir, { recursive: true })
  return dir
}

function sendProgress(sender: Electron.WebContents, payload: ClientUpdateProgressPayload): void {
  if (sender.isDestroyed()) return
  sender.send('client-update:progress', payload)
}

function basenameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const seg = u.pathname.split('/').filter(Boolean).pop()
    return seg || 'update-installer.exe'
  } catch {
    return 'update-installer.exe'
  }
}

function safeInstallerBasename(name: string): string {
  const raw = basename(String(name || '').trim() || 'update-installer.exe')
  const cleaned = raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 180)
  let out = cleaned || 'update-installer.exe'
  if (process.platform === 'win32' && !out.toLowerCase().endsWith('.exe')) {
    out = `${out}.exe`
  }
  return out
}

async function downloadInstaller(
  url: string,
  destPath: string,
  onProgress: (received: number, total: number | null) => void
): Promise<void> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    const response = await net.fetch(url, { method: 'GET', signal: controller.signal })
    if (!response.ok) {
      throw new Error(`下载失败（HTTP ${response.status}）`)
    }
    const lenHeader = response.headers.get('content-length')
    const total =
      lenHeader && Number.isFinite(Number(lenHeader)) ? Number(lenHeader) : null
    if (total != null && total > MAX_INSTALLER_BYTES) {
      throw new Error('安装包体积超过允许上限')
    }

    const body = response.body
    if (!body) throw new Error('下载响应为空')

    let received = 0
    const nodeStream = Readable.fromWeb(body as import('stream/web').ReadableStream)
    nodeStream.on('data', (chunk: Buffer | string) => {
      const n = typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
      received += n
      if (received > MAX_INSTALLER_BYTES) {
        nodeStream.destroy(new Error('安装包体积超过允许上限'))
        return
      }
      onProgress(received, total)
    })

    const ws = createWriteStream(destPath)
    await pipeline(nodeStream, ws)
  } finally {
    clearTimeout(timer)
  }
}

function assertInstallerReady(filePath: string): void {
  let st: ReturnType<typeof statSync>
  try {
    st = statSync(filePath)
  } catch {
    throw new Error('安装包文件不存在')
  }
  if (!st.isFile() || st.size < MIN_INSTALLER_BYTES) {
    throw new Error('安装包无效或未下载完整，请检查后台安装包地址是否可直接下载')
  }
}

function assertWindowsPeExecutable(filePath: string): void {
  const fd = openSync(filePath, 'r')
  try {
    const buf = new Uint8Array(2)
    readSync(fd, buf, 0, 2, 0)
    if (buf[0] !== 0x4d || buf[1] !== 0x5a) {
      throw new Error(
        '下载内容不是有效的 Windows 安装程序，请确认安装包 URL 无需登录且返回 exe 文件'
      )
    }
  } finally {
    closeSync(fd)
  }
}

function spawnDetached(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.once('error', reject)
    child.once('spawn', () => {
      child.unref()
      resolve()
    })
  })
}

function launchWindowsInstallerViaWscript(filePath: string): Promise<void> {
  const vbsPath = join(getPendingUpdateDir(), `launch-${randomUUID()}.vbs`)
  const escaped = filePath.replace(/"/g, '""')
  writeFileSync(
    vbsPath,
    `CreateObject("WScript.Shell").Run "${escaped}", 1, False\r\n`,
    'utf8'
  )
  return spawnDetached('wscript.exe', ['//B', '//Nologo', vbsPath]).finally(() => {
    setTimeout(() => {
      try {
        unlinkSync(vbsPath)
      } catch {
        /* ignore */
      }
    }, 60_000).unref()
  })
}

async function openWindowsInstaller(filePath: string): Promise<void> {
  const shellErr = await shell.openPath(filePath)
  if (!shellErr) {
    logClientUpdate(`shell.openPath ok: ${filePath}`)
    return
  }
  logClientUpdate(`shell.openPath failed: ${shellErr}; try wscript`)
  await launchWindowsInstallerViaWscript(filePath)
  logClientUpdate(`wscript launched: ${filePath}`)
}

function ensureQuitInstallHook(): void {
  if (quitInstallHookRegistered) return
  quitInstallHookRegistered = true

  app.on('will-quit', (event) => {
    const target = pendingInstallerOnQuit
    if (!target) return

    pendingInstallerOnQuit = null
    event.preventDefault()
    logClientUpdate(`will-quit: launching ${target}`)

    void (async () => {
      try {
        await openWindowsInstaller(target)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        logClientUpdate(`launch failed: ${msg}`)
      } finally {
        setTimeout(() => app.exit(0), 600)
      }
    })()
  })
}

function queueWindowsInstallerAndQuit(filePath: string, requestQuit: () => void): void {
  ensureQuitInstallHook()
  pendingInstallerOnQuit = filePath
  logClientUpdate(`queued installer on quit: ${filePath}`)
  requestQuit()
}

async function launchInstaller(filePath: string, platform: NodeJS.Platform): Promise<void> {
  assertInstallerReady(filePath)
  const ext = extname(filePath).toLowerCase()

  if (platform === 'win32') {
    assertWindowsPeExecutable(filePath)
    if (ext === '.msi') {
      await spawnDetached('msiexec', ['/i', filePath])
      return
    }
    const shellErr = await shell.openPath(filePath)
    if (shellErr) {
      throw new Error(shellErr || '无法启动安装程序')
    }
    return
  }

  if (platform === 'darwin') {
    if (ext === '.pkg') {
      await spawnDetached('open', ['-W', filePath])
      return
    }
    await spawnDetached('open', [filePath])
    return
  }

  if (ext === '.deb') {
    await spawnDetached('xdg-open', [filePath])
    return
  }
  if (ext === '.appimage' || filePath.toLowerCase().endsWith('.appimage')) {
    try {
      chmodSync(filePath, 0o755)
    } catch {
      /* best-effort */
    }
    await spawnDetached(filePath, [])
    return
  }
  await spawnDetached('xdg-open', [filePath])
}

export function registerClientUpdateHandlers(requestQuit: () => void): void {
  ipcMain.removeHandler('client-update:download-and-install')
  ipcMain.handle(
    'client-update:download-and-install',
    async (event, payload: { url?: string; suggestedName?: string }) => {
      const url = String(payload?.url || '').trim()
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return { success: false, error: '安装包地址无效' }
      }

      if (!app.isPackaged) {
        return {
          success: false,
          error: '开发模式下无法自动安装，请使用打包后的客户端或手动安装。',
        }
      }

      const sender = event.sender
      const dir = getPendingUpdateDir()
      const fileName = safeInstallerBasename(payload?.suggestedName || basenameFromUrl(url))
      const filePath = join(dir, fileName)

      try {
        sendProgress(sender, { phase: 'download', percent: 0, receivedBytes: 0, totalBytes: null })
        await downloadInstaller(url, filePath, (received, total) => {
          const percent =
            total != null && total > 0 ? Math.min(99, Math.round((100 * received) / total)) : undefined
          sendProgress(sender, {
            phase: 'download',
            percent,
            receivedBytes: received,
            totalBytes: total,
          })
        })

        sendProgress(sender, { phase: 'install', percent: 100 })

        if (process.platform === 'win32') {
          assertInstallerReady(filePath)
          assertWindowsPeExecutable(filePath)
          queueWindowsInstallerAndQuit(filePath, requestQuit)
          return { success: true }
        }

        await launchInstaller(filePath, process.platform)
        requestQuit()
        return { success: true }
      } catch (e) {
        const msg = e instanceof Error ? e.message : '下载或安装失败'
        logClientUpdate(`error: ${msg}`)
        return { success: false, error: msg }
      }
    }
  )
}
