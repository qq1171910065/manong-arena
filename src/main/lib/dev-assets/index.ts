import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { cp, readdir, stat, unlink } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'
import { ASSET_PACK_CONTENT_ROOTS, getAssetPackSourceDirs } from '@shared/arena/asset-pack-scope'
import {
  DEV_ASSETS_DIR_NAME,
  DEV_ASSETS_SYNC_DIRS,
  RENDERER_STATIC_ASSET_DIRS,
  flattenDevAssetsDirs,
} from '@shared/arena/dev-assets-catalog'
import {
  BUILTIN_GAME_MODE_IMAGE_KEYS,
  DEFAULT_GAME_MODE_PACK_ID,
  GAME_MODE_IMAGE_SLOTS,
  LEGACY_HOME_MODE_ASSET_FILES,
} from '@shared/arena/game-mode-visuals'
import { INITIAL_ASSET_PACK_ID, INITIAL_ASSET_PACK_VERSION, type InitialAssetInstallState } from '@shared/arena/initial-assets'
import { installAssetPackFromManifest } from '../asset-pack/install-core'
import { resolveAssetPackManifest } from '../asset-pack/manifest'
import {
  getInstalledAssetsDir,
  getInstallStatePath,
  hasPackContentAt,
} from '../asset-pack/paths'
import { BUNDLED_ASSET_PACK_MANIFEST_RELATIVE } from '@shared/arena/bundled-asset-pack-manifest'

import type {
  DevAssetsEntry,
  DevAssetsPackResult,
  DevAssetsTreeNode,
  DevAssetsEnsureResult,
  DevAssetsListResult,
} from '@shared/arena/dev-assets-types'

const DEV_ASSET_PACK_STATE_FILE = '.asset-pack-installed.json'

function logDevAssets(message: string): void {
  console.log(`[dev-assets] ${message}`)
}

function getProjectRoot(): string {
  const roots = [process.cwd(), app.getAppPath(), join(__dirname, '..', '..')]
  for (const root of roots) {
    const pkg = join(root, 'package.json')
    if (existsSync(pkg)) {
      try {
        const name = JSON.parse(readFileSync(pkg, 'utf8'))?.name
        if (name === 'arena') return root
      } catch {
        /* ignore */
      }
    }
  }
  return process.cwd()
}

export function getDevAssetsRoot(): string {
  return join(getProjectRoot(), DEV_ASSETS_DIR_NAME)
}

function getRendererAssetsRoot(): string {
  return join(getProjectRoot(), 'src/renderer/src/assets')
}

function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function resolveSafePath(relativePath: string): string | null {
  const root = getDevAssetsRoot()
  const normalized = normalizeRelativePath(relativePath)
  const abs = normalized ? join(root, normalized) : root
  const rel = relative(root, abs)
  if (rel.startsWith('..') || rel.includes('..\\') || rel.includes('../')) return null
  return abs
}

async function seedPackDirsFromUserData(appId: string): Promise<void> {
  const devRoot = getDevAssetsRoot()
  if (existsSync(join(devRoot, 'character-packs'))) return
  const userAssets = getInstalledAssetsDir(appId)
  if (!hasPackContentAt(userAssets)) return
  for (const dirName of DEV_ASSETS_SYNC_DIRS) {
    const src = join(userAssets, dirName)
    if (!existsSync(src)) continue
    await cp(src, join(devRoot, dirName), { recursive: true, force: true })
  }
}

function pruneStaticDirsFromDevWorkspace(root: string): void {
  for (const dirName of RENDERER_STATIC_ASSET_DIRS) {
    const abs = join(root, dirName)
    if (!existsSync(abs)) continue
    rmSync(abs, { recursive: true, force: true })
    logDevAssets(`removed static dir from workspace: ${dirName}/`)
  }
}

function getDevAssetsInstallStatePath(root: string): string {
  return join(root, DEV_ASSET_PACK_STATE_FILE)
}

function readDevAssetsInstallState(root: string): InitialAssetInstallState | null {
  const path = getDevAssetsInstallStatePath(root)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as InitialAssetInstallState
  } catch {
    return null
  }
}

function writeDevAssetsInstallState(root: string, version: string): void {
  const state: InitialAssetInstallState = {
    packId: INITIAL_ASSET_PACK_ID,
    version,
    installedAt: new Date().toISOString(),
  }
  writeFileSync(getDevAssetsInstallStatePath(root), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

export function hasDevAssetsPackContent(root = getDevAssetsRoot()): boolean {
  return hasPackContentAt(root)
}

function markDevAssetsPackInstalled(root: string): void {
  const manifest = resolveAssetPackManifest()
  writeDevAssetsInstallState(root, manifest?.version ?? INITIAL_ASSET_PACK_VERSION)
}

export function isDevAssetsPackReady(root = getDevAssetsRoot()): boolean {
  if (!hasDevAssetsPackContent(root)) return false

  const manifest = resolveAssetPackManifest()
  const installed = readDevAssetsInstallState(root)
  if (!installed || installed.packId !== INITIAL_ASSET_PACK_ID) return false
  if (!manifest) return true
  return installed.version === manifest.version
}

async function ensureDevAssetsFromManifest(
  appId: string,
  root: string,
  sender?: Electron.WebContents | null
): Promise<{ ok: boolean; source?: 'local' | 'remote'; error?: string }> {
  const manifest = resolveAssetPackManifest()
  if (!manifest) {
    return { ok: false, error: '未找到内置素材清单，请先执行 pnpm pack:assets' }
  }

  try {
    logDevAssets(`fetching asset pack v${manifest.version} -> ${root}`)
    const progress = (payload: import('@shared/arena/initial-assets').AssetPackProgressPayload) => {
      if (!sender || sender.isDestroyed()) return
      sender.send('asset-pack:progress', payload)
    }
    const { source } = await installAssetPackFromManifest(appId, root, manifest, progress)
    writeDevAssetsInstallState(root, manifest.version)
    logDevAssets(`asset pack installed from ${source}`)
    return { ok: true, source }
  } catch (error) {
    const message = error instanceof Error ? error.message : '素材包下载或解压失败'
    logDevAssets(`asset pack install failed: ${message}`)
    return { ok: false, error: message }
  }
}

function migrateLegacyGameModeAssets(root: string): void {
  const packRoot = join(root, 'game-mode-packs', DEFAULT_GAME_MODE_PACK_ID)
  mkdirSync(packRoot, { recursive: true })
  const homeDir = join(getRendererAssetsRoot(), 'home')

  for (const modeId of BUILTIN_GAME_MODE_IMAGE_KEYS) {
    const modeDir = join(packRoot, modeId)
    mkdirSync(modeDir, { recursive: true })
    const legacy = LEGACY_HOME_MODE_ASSET_FILES[modeId]

    for (const slot of GAME_MODE_IMAGE_SLOTS) {
      const dest = join(modeDir, slot.fileName)
      if (existsSync(dest)) continue
      const legacyName = slot.id === 'mode-cover' ? legacy.modeCover : legacy.matchBanner
      const legacyPath = join(homeDir, legacyName)
      if (existsSync(legacyPath)) copyFileSync(legacyPath, dest)
    }
  }

  const manifestPath = join(packRoot, 'manifest.json')
  if (!existsSync(manifestPath)) {
    const modes = BUILTIN_GAME_MODE_IMAGE_KEYS.map((id) => ({
      id,
      modeCover: `${id}/mode-cover.png`,
      matchBanner: `${id}/match-banner.png`,
    }))
    writeFileSync(
      manifestPath,
      `${JSON.stringify({ version: 1, packageId: DEFAULT_GAME_MODE_PACK_ID, modes }, null, 2)}\n`,
      'utf8'
    )
  }
}

export async function ensureDevAssetsWorkspace(
  appId = 'com.agentarena',
  sender?: Electron.WebContents | null
): Promise<{
  root: string
  created: boolean
  assetPackFetched?: boolean
  assetPackSource?: 'local' | 'remote'
  assetPackError?: string
}> {
  const root = getDevAssetsRoot()
  const existed = existsSync(root)
  mkdirSync(root, { recursive: true })

  pruneStaticDirsFromDevWorkspace(root)
  await seedPackDirsFromUserData(appId)
  migrateLegacyGameModeAssets(root)

  let assetPackFetched = false
  let assetPackSource: 'local' | 'remote' | undefined
  let assetPackError: string | undefined

  if (isDevAssetsPackReady(root)) {
    logDevAssets('dev workspace pack already ready')
  } else if (hasDevAssetsPackContent(root)) {
    markDevAssetsPackInstalled(root)
    logDevAssets('using existing .dev-assets pack content, skip remote fetch')
  } else {
    const fetchResult = await ensureDevAssetsFromManifest(appId, root, sender)
    if (fetchResult.ok) {
      assetPackFetched = true
      assetPackSource = fetchResult.source
    } else {
      await seedPackDirsFromUserData(appId)
      migrateLegacyGameModeAssets(root)
      if (hasDevAssetsPackContent(root)) {
        markDevAssetsPackInstalled(root)
        logDevAssets('remote fetch failed, using userData seed assets')
      } else {
        assetPackError = fetchResult.error
      }
    }
  }

  for (const node of flattenDevAssetsDirs()) {
    const dir = node.path ? join(root, node.path) : root
    mkdirSync(dir, { recursive: true })
    const readmePath = join(dir, 'README.md')
    if (!existsSync(readmePath)) {
      writeFileSync(readmePath, `${node.readme.trim()}\n`, 'utf8')
    }
  }

  return { root, created: !existed, assetPackFetched, assetPackSource, assetPackError }
}

function formatEntry(absPath: string, root: string): DevAssetsEntry {
  const st = statSync(absPath)
  const relativePath = normalizeRelativePath(relative(root, absPath))
  const name = basename(absPath)
  return {
    name,
    relativePath,
    kind: st.isDirectory() ? 'directory' : 'file',
    sizeBytes: st.isFile() ? st.size : undefined,
    updatedAt: st.mtime.toISOString(),
    isReadme: name.toLowerCase() === 'readme.md',
  }
}

async function listEntries(relativePath: string): Promise<DevAssetsEntry[]> {
  const abs = resolveSafePath(relativePath)
  if (!abs || !existsSync(abs)) return []
  const st = await stat(abs)
  if (!st.isDirectory()) return [formatEntry(abs, getDevAssetsRoot())]

  const entries = await readdir(abs, { withFileTypes: true })
  return entries
    .map((entry) => formatEntry(join(abs, entry.name), getDevAssetsRoot()))
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
}

function buildTree(relativePath = ''): DevAssetsTreeNode {
  const abs = resolveSafePath(relativePath)
  const label = relativePath ? basename(relativePath) : DEV_ASSETS_DIR_NAME
  if (!abs || !existsSync(abs)) {
    return { relativePath: normalizeRelativePath(relativePath), label, kind: 'directory', children: [] }
  }
  const st = statSync(abs)
  if (!st.isDirectory()) {
    return { relativePath: normalizeRelativePath(relativePath), label, kind: 'file' }
  }
  const children = readdirSync(abs, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => buildTree(join(relativePath, entry.name).replace(/\\/g, '/')))
  return {
    relativePath: normalizeRelativePath(relativePath),
    label,
    kind: 'directory',
    children,
  }
}

function countFiles(dir: string): { files: number; bytes: number } {
  let files = 0
  let bytes = 0
  const walk = (current: string) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const abs = join(current, entry.name)
      if (entry.isDirectory()) walk(abs)
      else if (entry.isFile()) {
        files += 1
        bytes += statSync(abs).size
      }
    }
  }
  if (existsSync(dir)) walk(dir)
  return { files, bytes }
}

function sha256File(filePath: string): string {
  const hash = createHash('sha256')
  hash.update(readFileSync(filePath))
  return hash.digest('hex')
}

function addDirectoryToArchive(archive: import('archiver').Archiver, dir: string, archivePrefix = ''): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absPath = join(dir, entry.name)
    const archivePath = archivePrefix ? `${archivePrefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirectoryToArchive(archive, absPath, archivePath)
      continue
    }
    if (!entry.isFile()) continue
    archive.file(absPath, { name: archivePath })
  }
}

async function createAssetZip(destPath: string): Promise<void> {
  const archiver = (await import('archiver')).default
  const packDirs = getAssetPackSourceDirs(getDevAssetsRoot())
  if (!packDirs.length) {
    throw new Error(`缺少 ${ASSET_PACK_CONTENT_ROOTS.join(' 或 ')} 目录，无法打包素材`)
  }
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(destPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', () => resolve())
    archive.on('error', reject)
    archive.pipe(output)
    for (const packDir of packDirs) {
      const rootName = basename(packDir)
      addDirectoryToArchive(archive, packDir, rootName)
    }
    void archive.finalize()
  })
}

export async function packDevAssetsExport(
  win: BrowserWindow | null,
  version = INITIAL_ASSET_PACK_VERSION
): Promise<DevAssetsPackResult> {
  await ensureDevAssetsWorkspace()
  const fileName = `arena-initial-assets-${version}.zip`
  const defaultPath = join(app.getPath('downloads'), fileName)
  const save = await dialog.showSaveDialog(win ?? undefined, {
    title: '导出素材包',
    defaultPath,
    filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
  })
  if (save.canceled || !save.filePath) return { ok: false, error: '已取消导出' }

  try {
    await createAssetZip(save.filePath)
    const sizeBytes = statSync(save.filePath).size
    const sha256 = sha256File(save.filePath)
    const baseUrl = (process.env.ARENA_ASSETS_BASE_URL || 'http://local.czmanong.com/upload/arena').replace(
      /\/+$/,
      ''
    )
    const manifest = {
      packId: 'initial',
      version,
      fileName,
      downloadUrl: `${baseUrl}/${fileName}`,
      sha256,
      sizeBytes,
      generatedAt: new Date().toISOString(),
    }
    const manifestPath = join(getProjectRoot(), BUNDLED_ASSET_PACK_MANIFEST_RELATIVE)
    mkdirSync(dirname(manifestPath), { recursive: true })
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    return { ok: true, zipPath: save.filePath, manifestPath, sizeBytes, sha256 }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '打包失败' }
  }
}

async function syncToUserData(appId: string): Promise<{ ok: boolean; error?: string }> {
  await ensureDevAssetsWorkspace(appId)
  const from = getDevAssetsRoot()
  const destDir = getInstalledAssetsDir(appId)
  const manifest = resolveAssetPackManifest()
  try {
    mkdirSync(destDir, { recursive: true })
    for (const dirName of DEV_ASSETS_SYNC_DIRS) {
      const src = join(from, dirName)
      if (!existsSync(src)) continue
      await cp(src, join(destDir, dirName), { recursive: true, force: true })
    }
    if (manifest) {
      const state: InitialAssetInstallState = {
        packId: INITIAL_ASSET_PACK_ID,
        version: manifest.version,
        installedAt: new Date().toISOString(),
      }
      writeFileSync(getInstallStatePath(appId), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : '同步失败' }
  }
}

async function importFiles(relativeDir: string, win: BrowserWindow | null): Promise<{ ok: boolean; imported: string[]; error?: string }> {
  const absDir = resolveSafePath(relativeDir)
  if (!absDir) return { ok: false, imported: [], error: '无效目录' }
  mkdirSync(absDir, { recursive: true })

  const picked = await dialog.showOpenDialog(win ?? undefined, {
    title: '导入素材文件',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] },
      { name: 'JSON', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (picked.canceled || !picked.filePaths.length) return { ok: false, imported: [], error: '已取消' }

  const imported: string[] = []
  for (const filePath of picked.filePaths) {
    const dest = join(absDir, basename(filePath))
    copyFileSync(filePath, dest)
    imported.push(normalizeRelativePath(relative(getDevAssetsRoot(), dest)))
  }
  return { ok: true, imported }
}

async function deleteEntry(relativePath: string): Promise<{ ok: boolean; error?: string }> {
  const abs = resolveSafePath(relativePath)
  if (!abs || abs === getDevAssetsRoot()) return { ok: false, error: '不能删除根目录' }
  if (!existsSync(abs)) return { ok: false, error: '路径不存在' }
  const st = await stat(abs)
  if (st.isDirectory()) await rmSync(abs, { recursive: true, force: true })
  else await unlink(abs)
  return { ok: true }
}

async function readReadme(relativePath: string): Promise<string | null> {
  const absDir = resolveSafePath(relativePath)
  if (!absDir) return null
  const readmePath = join(absDir, 'README.md')
  if (!existsSync(readmePath)) return null
  return readFileSync(readmePath, 'utf8')
}

async function readPreviewDataUrl(relativePath: string): Promise<{ ok: boolean; dataUrl?: string; error?: string }> {
  const abs = resolveSafePath(relativePath)
  if (!abs || !existsSync(abs)) return { ok: false, error: '文件不存在' }
  const st = await stat(abs)
  if (!st.isFile()) return { ok: false, error: '不是文件' }
  const ext = extname(abs).toLowerCase()
  const mimeByExt: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  }
  const mime = mimeByExt[ext]
  if (!mime) return { ok: false, error: '不支持预览' }
  const buf = readFileSync(abs)
  return { ok: true, dataUrl: `data:${mime};base64,${buf.toString('base64')}` }
}

export function registerDevAssetsHandlers(appId: string, getWindow: () => BrowserWindow | null): void {
  if (app.isPackaged) return

  ipcMain.removeHandler('dev-assets:is-available')
  ipcMain.handle('dev-assets:is-available', () => ({ ok: true, available: true }))

  ipcMain.removeHandler('dev-assets:ensure')
  ipcMain.handle('dev-assets:ensure', async (event) => {
    const result = await ensureDevAssetsWorkspace(appId, event.sender)
    const stats = countFiles(result.root)
    return {
      ok: true,
      root: result.root,
      created: result.created,
      assetPackFetched: result.assetPackFetched,
      assetPackSource: result.assetPackSource,
      assetPackError: result.assetPackError,
      ...stats,
    }
  })

  ipcMain.removeHandler('dev-assets:get-tree')
  ipcMain.handle('dev-assets:get-tree', async () => {
    await ensureDevAssetsWorkspace()
    return { ok: true, root: getDevAssetsRoot(), tree: buildTree('') }
  })

  ipcMain.removeHandler('dev-assets:list')
  ipcMain.handle('dev-assets:list', async (_event, relativePath: string) => {
    await ensureDevAssetsWorkspace()
    const entries = await listEntries(relativePath || '')
    const readme = await readReadme(relativePath || '')
    return { ok: true, relativePath: normalizeRelativePath(relativePath || ''), entries, readme }
  })

  ipcMain.removeHandler('dev-assets:open-path')
  ipcMain.handle('dev-assets:open-path', async (_event, relativePath: string) => {
    const abs = resolveSafePath(relativePath || '')
    if (!abs) return { ok: false, error: '无效路径' }
    const target = existsSync(abs) ? abs : dirname(abs)
    mkdirSync(target, { recursive: true })
    const err = await shell.openPath(target)
    return err ? { ok: false, error: err } : { ok: true }
  })

  ipcMain.removeHandler('dev-assets:show-item')
  ipcMain.handle('dev-assets:show-item', async (_event, relativePath: string) => {
    const abs = resolveSafePath(relativePath)
    if (!abs || !existsSync(abs)) return { ok: false, error: '文件不存在' }
    shell.showItemInFolder(abs)
    return { ok: true }
  })

  ipcMain.removeHandler('dev-assets:import')
  ipcMain.handle('dev-assets:import', async (_event, relativeDir: string) =>
    importFiles(relativeDir || '', getWindow())
  )

  ipcMain.removeHandler('dev-assets:delete')
  ipcMain.handle('dev-assets:delete', async (_event, relativePath: string) => deleteEntry(relativePath))

  ipcMain.removeHandler('dev-assets:sync-user-data')
  ipcMain.handle('dev-assets:sync-user-data', async () => syncToUserData(appId))

  ipcMain.removeHandler('dev-assets:pack-export')
  ipcMain.handle('dev-assets:pack-export', async () => packDevAssetsExport(getWindow()))

  ipcMain.removeHandler('dev-assets:preview')
  ipcMain.handle('dev-assets:preview', async (_event, relativePath: string) => readPreviewDataUrl(relativePath))
}
