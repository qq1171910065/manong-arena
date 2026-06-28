import { app, BrowserWindow, dialog, ipcMain, protocol } from 'electron'
import extractZip from 'extract-zip'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { cp } from 'node:fs/promises'
import { extname, join } from 'node:path'
import {
  INITIAL_ASSET_PACK_ID,
  type AssetPackProgressPayload,
  type InitialAssetInstallState,
} from '@shared/arena/initial-assets'
import {
  assertAssetPackStructure,
  resolveAssetPackZip,
  verifyAssetPackZip,
  extractAssetPackZip,
} from './install-core'
import { resolveAssetPackManifest } from './manifest'
import {
  ASSET_PACK_MARKER_PATH,
  ASSET_PACK_SYNC_DIRS,
  findBundledAssetsDir,
  findDevAssetsDir,
  findLocalAssetZipPath,
  getInstalledAssetsDir,
  getInstallStatePath,
  getProjectRoots,
  hasPackContentAt,
  isInitialAssetsReady,
  readInstallState,
  resolveAssetFilePath,
} from './paths'
import { BUNDLED_MINIMAL_ASSET_VERSION } from '@shared/arena/initial-assets'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

function logAssetPack(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`
  console.log(`[asset-pack] ${message}`)
  try {
    appendFileSync(join(app.getPath('userData'), 'asset-pack.log'), `${line}\n`, 'utf8')
  } catch {
    /* ignore */
  }
}

function sendProgress(
  sender: Electron.WebContents | null | undefined,
  payload: AssetPackProgressPayload
): void {
  if (!sender || sender.isDestroyed()) return
  sender.send('asset-pack:progress', payload)
}

function clearInstalledAssets(appId: string): void {
  const dir = getInstalledAssetsDir(appId)
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    if (entry === 'installed.json') continue
    rmSync(join(dir, entry), { recursive: true, force: true })
  }
}

function writeInstallState(appId: string, version: string): void {
  const dir = getInstalledAssetsDir(appId)
  mkdirSync(dir, { recursive: true })
  const state: InitialAssetInstallState = {
    packId: INITIAL_ASSET_PACK_ID,
    version,
    installedAt: new Date().toISOString(),
  }
  writeFileSync(getInstallStatePath(appId), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function extractInitialAssets(appId: string, zipPath: string, version: string): Promise<void> {
  const destDir = getInstalledAssetsDir(appId)
  mkdirSync(destDir, { recursive: true })
  clearInstalledAssets(appId)
  logAssetPack(`extracting ${zipPath} -> ${destDir}`)
  await extractZip(zipPath, { dir: destDir })
  assertAssetPackStructure(destDir)
  writeInstallState(appId, version)
  logAssetPack(`installed v${version} -> ${destDir}`)
}

async function installFromPackDirs(
  appId: string,
  sourceDir: string,
  version: string,
  sender?: Electron.WebContents | null
): Promise<void> {
  sendProgress(sender, {
    phase: 'extract',
    percent: 95,
    label: '正在同步本地素材…',
  })

  const destDir = getInstalledAssetsDir(appId)
  mkdirSync(destDir, { recursive: true })
  clearInstalledAssets(appId)

  for (const dirName of ASSET_PACK_SYNC_DIRS) {
    const src = join(sourceDir, dirName)
    if (!existsSync(src)) continue
    await cp(src, join(destDir, dirName), { recursive: true, force: true })
  }

  assertAssetPackStructure(destDir)
  writeInstallState(appId, version)
  logAssetPack(`installed from local dir ${sourceDir} -> ${destDir}`)

  sendProgress(sender, {
    phase: 'extract',
    percent: 100,
    label: '素材准备完成',
  })
}

async function installFromZipFile(
  appId: string,
  zipPath: string,
  manifest: import('@shared/arena/initial-assets').InitialAssetPackManifest,
  sender?: Electron.WebContents | null
): Promise<void> {
  sendProgress(sender, {
    phase: 'verify',
    percent: 90,
    label: '正在校验素材包…',
  })
  verifyAssetPackZip(zipPath, manifest)

  sendProgress(sender, {
    phase: 'extract',
    percent: 98,
    label: '正在解压素材…',
  })
  await extractInitialAssets(appId, zipPath, manifest.version)

  sendProgress(sender, {
    phase: 'extract',
    percent: 100,
    label: '素材准备完成',
  })
}

export type EnsureInitialAssetsResult = {
  ok: boolean
  skipped?: boolean
  source?: 'local' | 'remote'
  error?: string
}

async function installFromBundledMinimal(
  appId: string,
  sender?: Electron.WebContents | null
): Promise<EnsureInitialAssetsResult> {
  const bundledDir = findBundledAssetsDir()
  if (!bundledDir) {
    return { ok: false, error: '未找到内置默认素材包。请更新应用版本或载入本地素材 zip。' }
  }
  await installFromPackDirs(appId, bundledDir, BUNDLED_MINIMAL_ASSET_VERSION, sender)
  return { ok: true, source: 'local' }
}

export async function ensureInitialAssetsInstall(
  appId: string,
  sender?: Electron.WebContents | null
): Promise<EnsureInitialAssetsResult> {
  if (isInitialAssetsReady(appId)) {
    return { ok: true, skipped: true }
  }

  const manifest = resolveAssetPackManifest()
  if (!manifest) {
    logAssetPack(`bundled manifest not found, roots=${getProjectRoots().join('; ')}`)
    return {
      ok: false,
      error: '未找到内置素材清单。请更新应用版本，或在设置中心载入本地素材包。',
    }
  }

  if (!app.isPackaged) {
    const localDir = findDevAssetsDir()
    if (localDir && hasPackContentAt(localDir)) {
      try {
        logAssetPack(`using dev workspace assets: ${localDir}`)
        await installFromPackDirs(appId, localDir, manifest.version, sender)
        return { ok: true, source: 'local' }
      } catch (error) {
        const message = error instanceof Error ? error.message : '本地素材同步失败'
        logAssetPack(`dev workspace install failed: ${message}`)
        return { ok: false, error: message }
      }
    }
  }

  const localZip = findLocalAssetZipPath(appId, manifest)
  if (localZip) {
    try {
      logAssetPack(`using cached zip: ${localZip}`)
      await installFromZipFile(appId, localZip, manifest, sender)
      return { ok: true, source: 'local' }
    } catch (error) {
      const message = error instanceof Error ? error.message : '本地素材解压失败'
      logAssetPack(`local zip install failed: ${message}`)
      try {
        rmSync(localZip, { force: true })
      } catch {
        /* ignore */
      }
      if (!app.isPackaged) {
        const fallbackDir = findDevAssetsDir()
        if (fallbackDir && hasPackContentAt(fallbackDir)) {
          logAssetPack(`fallback to dev workspace after zip failure: ${fallbackDir}`)
          await installFromPackDirs(appId, fallbackDir, manifest.version, sender)
          return { ok: true, source: 'local' }
        }
      }
      return { ok: false, error: message }
    }
  }

  try {
    logAssetPack(`resolving zip from manifest ${manifest.downloadUrl}`)
    const progress = (payload: AssetPackProgressPayload) => {
      sendProgress(sender, {
        ...payload,
        label: payload.label || '正在下载初始素材…',
      })
    }
    const { zipPath, source } = await resolveAssetPackZip(appId, manifest, progress)
    await installFromZipFile(appId, zipPath, manifest, sender)
    return { ok: true, source }
  } catch (error) {
    const message = error instanceof Error ? error.message : '素材下载或解压失败'
    logAssetPack(`remote install failed: ${message}`)
    if (!app.isPackaged) {
      const fallbackDir = findDevAssetsDir() || findBundledAssetsDir()
      if (fallbackDir && hasPackContentAt(fallbackDir)) {
        try {
          logAssetPack(`fallback to bundled/dev assets after remote failure: ${fallbackDir}`)
          await installFromPackDirs(appId, fallbackDir, manifest.version, sender)
          return { ok: true, source: 'local' }
        } catch (fallbackError) {
          const fallbackMessage =
            fallbackError instanceof Error ? fallbackError.message : '本地素材同步失败'
          logAssetPack(`bundled/dev fallback failed: ${fallbackMessage}`)
        }
      }
    }
    return { ok: false, error: message }
  }
}

async function installAssetPackFromLocalZip(
  appId: string,
  zipPath: string,
  sender?: Electron.WebContents | null
): Promise<EnsureInitialAssetsResult> {
  sendProgress(sender, { phase: 'verify', percent: 20, label: '正在校验本地素材包…' })

  const destDir = getInstalledAssetsDir(appId)
  mkdirSync(destDir, { recursive: true })
  clearInstalledAssets(appId)
  await extractAssetPackZip(destDir, zipPath)

  const packManifestPath = join(destDir, ASSET_PACK_MARKER_PATH)
  let version = 'local'
  try {
    const packManifest = JSON.parse(readFileSync(packManifestPath, 'utf8')) as { version?: string | number }
    if (packManifest.version != null) version = String(packManifest.version)
  } catch {
    /* use default */
  }

  writeInstallState(appId, version)
  logAssetPack(`installed from local zip ${zipPath} -> ${destDir}`)

  sendProgress(sender, { phase: 'extract', percent: 100, label: '素材准备完成' })
  return { ok: true, source: 'local' }
}

export async function pickAndInstallAssetPackFromFile(
  appId: string,
  win: BrowserWindow | null,
  sender?: Electron.WebContents | null
): Promise<EnsureInitialAssetsResult & { canceled?: boolean }> {
  const picked = await dialog.showOpenDialog(win ?? undefined, {
    title: '选择素材包',
    properties: ['openFile'],
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  })
  if (picked.canceled || !picked.filePaths[0]) {
    return { ok: false, canceled: true, error: '已取消' }
  }
  return installAssetPackFromLocalZip(appId, picked.filePaths[0], sender)
}

/** 启动时不自动下载素材；由初始化向导或设置中心触发 */
export async function bootstrapInitialAssets(appId: string): Promise<EnsureInitialAssetsResult> {
  logAssetPack(`bootstrap skipped (user-initiated install only) appId=${appId}`)
  if (isInitialAssetsReady(appId)) {
    return { ok: true, skipped: true }
  }
  return { ok: true, skipped: true }
}

export function registerAssetPackScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'arena-asset',
      privileges: {
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        standard: true,
      },
    },
  ])
}

export function registerAssetPackHandlers(appId: string): void {
  protocol.handle('arena-asset', (request) => {
    const url = new URL(request.url)
    const relativePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''))
    const filePath = resolveAssetFilePath(relativePath, appId)
    if (!filePath) {
      logAssetPack(`404 ${relativePath}`)
      return new Response('Not Found', { status: 404 })
    }
    try {
      const body = readFileSync(filePath)
      const mime = MIME_BY_EXT[extname(filePath).toLowerCase()] || 'application/octet-stream'
      return new Response(body, { headers: { 'Content-Type': mime } })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })

  ipcMain.removeHandler('asset-pack:is-ready')
  ipcMain.handle('asset-pack:is-ready', () => ({
    ok: true,
    ready: isInitialAssetsReady(appId),
  }))

  ipcMain.removeHandler('asset-pack:get-manifest')
  ipcMain.handle('asset-pack:get-manifest', () => {
    const manifest = resolveAssetPackManifest()
    return { ok: Boolean(manifest), manifest }
  })

  ipcMain.removeHandler('asset-pack:get-status')
  ipcMain.handle('asset-pack:get-status', () => {
    const installed = readInstallState(appId)
    const manifest = resolveAssetPackManifest()
    return {
      ok: true,
      ready: isInitialAssetsReady(appId),
      installedVersion: installed?.version ?? null,
      installedAt: installed?.installedAt ?? null,
      manifestVersion: manifest?.version ?? null,
      manifestFileName: manifest?.fileName ?? null,
    }
  })

  ipcMain.removeHandler('asset-pack:install-from-file')
  ipcMain.handle('asset-pack:install-from-file', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return pickAndInstallAssetPackFromFile(appId, win, event.sender)
  })

  ipcMain.removeHandler('asset-pack:ensure')
  ipcMain.handle('asset-pack:ensure', async (event) => ensureInitialAssetsInstall(appId, event.sender))

  ipcMain.removeHandler('asset-pack:install-bundled-minimal')
  ipcMain.handle('asset-pack:install-bundled-minimal', async (event) =>
    installFromBundledMinimal(appId, event.sender)
  )
}

export { installAssetPackFromManifest, resolveAssetPackZip, verifyAssetPackZip } from './install-core'
