import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getAssetPackCacheDir as getAppAssetPackCacheDir,
  getInstalledAssetsDir as getAppInstalledAssetsDir,
} from '../app-home'
import {
  INITIAL_ASSET_PACK_ID,
  type InitialAssetInstallState,
  type InitialAssetPackManifest,
} from '@shared/arena/initial-assets'
import { resolveAssetPackDownloadUrl } from '@shared/app-release-config'
import { getProjectRoots } from './project-roots'

export { getProjectRoots } from './project-roots'

export const ASSET_PACK_MARKER_PATH = 'character-packs/manifest.json'
export const ASSET_PACK_GAME_MARKER_PATH = 'game-mode-packs/manifest.json'
export const ASSET_PACK_SYNC_DIRS = [
  'character-packs',
  'game-mode-packs',
  'character-data-packs',
  'game-mode-data-packs',
] as const

export function hasPackContentAt(dir: string): boolean {
  if (!dir) return false
  if (
    existsSync(join(dir, ASSET_PACK_MARKER_PATH)) &&
    existsSync(join(dir, ASSET_PACK_GAME_MARKER_PATH))
  ) {
    return true
  }
  return hasBundledDefaultAssets(dir)
}

/** 解压后的素材目录（安装目录） */
export function getInstalledAssetsDir(appId: string): string {
  return getAppInstalledAssetsDir(appId)
}

/** 已下载/缓存的 zip 包目录（安装目录，不在项目内） */
export function getAssetPackCacheDir(appId: string): string {
  return getAppAssetPackCacheDir(appId)
}

export function getAssetPackZipPath(appId: string, manifest: InitialAssetPackManifest): string {
  return join(getAssetPackCacheDir(appId), manifest.fileName)
}

export function getInstallStatePath(appId: string): string {
  return join(getInstalledAssetsDir(appId), 'installed.json')
}

/** 仅在 userData 安装目录查找已下载的 zip，不扫描项目目录 */
export function findLocalAssetZipPath(appId: string, manifest: InitialAssetPackManifest): string | null {
  const candidate = getAssetPackZipPath(appId, manifest)
  return existsSync(candidate) ? candidate : null
}

export function readInstallState(appId: string): InitialAssetInstallState | null {
  const path = getInstallStatePath(appId)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as InitialAssetInstallState
  } catch {
    return null
  }
}

export function findBundledAssetsDir(): string | null {
  if (app.isPackaged) {
    const resourceDir = join(process.resourcesPath, 'bundled-assets')
    if (hasBundledDefaultAssets(resourceDir)) return resourceDir
  }
  for (const root of getProjectRoots()) {
    const dir = join(root, 'src/bundled-assets')
    if (hasBundledDefaultAssets(dir)) return dir
    const legacyDir = join(root, 'bundled-assets')
    if (hasBundledDefaultAssets(legacyDir)) return legacyDir
  }
  return null
}

/** 内置默认占位图（仅 default 角色 + custom 玩法封面，无 manifest） */
export function hasBundledDefaultAssets(dir: string): boolean {
  if (!dir) return false
  return (
    existsSync(join(dir, 'character-packs/default/portrait.png')) &&
    existsSync(join(dir, 'game-mode-packs/custom/mode-cover.png'))
  )
}

const DEFAULT_CHARACTER_PACK_ID = 'default'
const DEFAULT_GAME_MODE_PACK_ID = 'custom'
const CHARACTER_PACK_ASSET_RE = /^character-packs\/([^/]+)\/(.+)$/
const GAME_MODE_PACK_ASSET_RE = /^game-mode-packs\/([^/]+)\/(.+)$/

function resolveAssetFilePathExact(normalized: string, appId: string): string | null {
  const installed = join(getInstalledAssetsDir(appId), normalized)
  if (existsSync(installed)) return installed

  if (!app.isPackaged) {
    const devDir = findDevAssetsDir()
    if (devDir) {
      const devPath = join(devDir, normalized)
      if (existsSync(devPath)) return devPath
    }
  }

  const bundledDir = findBundledAssetsDir()
  if (bundledDir) {
    const bundledPath = join(bundledDir, normalized)
    if (existsSync(bundledPath)) return bundledPath
  }
  return null
}

export function resolveAssetFilePath(relativePath: string, appId: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  const direct = resolveAssetFilePathExact(normalized, appId)
  if (direct) return direct

  const match = normalized.match(CHARACTER_PACK_ASSET_RE)
  if (match && match[1] !== DEFAULT_CHARACTER_PACK_ID) {
    return resolveAssetFilePathExact(`character-packs/${DEFAULT_CHARACTER_PACK_ID}/${match[2]}`, appId)
  }

  const modeMatch = normalized.match(GAME_MODE_PACK_ASSET_RE)
  if (modeMatch && modeMatch[1] !== DEFAULT_GAME_MODE_PACK_ID) {
    return resolveAssetFilePathExact(`game-mode-packs/${DEFAULT_GAME_MODE_PACK_ID}/${modeMatch[2]}`, appId)
  }
  return null
}

/** userData 中是否已写入素材安装记录（不含 bundled / dev 回退） */
export function isUserAssetPackInstalled(appId: string): boolean {
  const installedDir = getInstalledAssetsDir(appId)
  const marker = join(installedDir, ASSET_PACK_MARKER_PATH)
  const installed = readInstallState(appId)
  return (
    existsSync(marker) &&
    installed?.packId === INITIAL_ASSET_PACK_ID &&
    hasPackContentAt(installedDir)
  )
}

export function isInitialAssetsReady(appId: string): boolean {
  if (isUserAssetPackInstalled(appId)) return true
  return hasBundledDefaultAssets(findBundledAssetsDir() || '')
}

export function resolveDownloadUrl(manifest: InitialAssetPackManifest): string {
  if (!app.isPackaged) {
    const override = String(process.env.ARENA_ASSETS_DOWNLOAD_URL || '').trim()
    if (/^https?:\/\//i.test(override)) return override
    return resolveAssetPackDownloadUrl(manifest.downloadUrl, { allowManifestFallback: true })
  }
  return resolveAssetPackDownloadUrl(manifest.downloadUrl, { allowManifestFallback: false })
}

export function findDevAssetsDir(): string | null {
  if (app.isPackaged) return null
  for (const root of getProjectRoots()) {
    const dir = join(root, '.dev-assets')
    if (hasPackContentAt(dir)) return dir
  }
  return null
}
