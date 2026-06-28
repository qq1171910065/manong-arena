import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  getAssetPackCacheDir as getAppAssetPackCacheDir,
  getInstalledAssetsDir as getAppInstalledAssetsDir,
} from '../app-home'
import {
  BUNDLED_MINIMAL_ASSET_VERSION,
  INITIAL_ASSET_PACK_ID,
  type InitialAssetInstallState,
  type InitialAssetPackManifest,
} from '@shared/arena/initial-assets'
import { resolveAssetPackManifest } from './manifest'
import { getProjectRoots } from './project-roots'

export { getProjectRoots } from './project-roots'

export const ASSET_PACK_MARKER_PATH = 'character-packs/manifest.json'
export const ASSET_PACK_GAME_MARKER_PATH = 'game-mode-packs/manifest.json'
export const ASSET_PACK_SYNC_DIRS = ['character-packs', 'game-mode-packs'] as const

export function hasPackContentAt(dir: string): boolean {
  if (!dir) return false
  return (
    existsSync(join(dir, ASSET_PACK_MARKER_PATH)) && existsSync(join(dir, ASSET_PACK_GAME_MARKER_PATH))
  )
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
    if (hasPackContentAt(resourceDir)) return resourceDir
  }
  for (const root of getProjectRoots()) {
    const dir = join(root, 'bundled-assets')
    if (hasPackContentAt(dir)) return dir
  }
  return null
}

export function resolveAssetFilePath(relativePath: string, appId: string): string | null {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
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

export function isInitialAssetsReady(appId: string): boolean {
  const marker = join(getInstalledAssetsDir(appId), ASSET_PACK_MARKER_PATH)
  const installed = readInstallState(appId)
  if (!existsSync(marker) || installed?.packId !== INITIAL_ASSET_PACK_ID) {
    return hasPackContentAt(findBundledAssetsDir() || '')
  }

  const manifest = resolveAssetPackManifest()
  if (!manifest) return true
  if (installed.version === BUNDLED_MINIMAL_ASSET_VERSION) return true
  return installed.version === manifest.version
}

export function resolveDownloadUrl(manifest: InitialAssetPackManifest): string {
  const override = String(process.env.ARENA_ASSETS_DOWNLOAD_URL || '').trim()
  if (override.startsWith('http://') || override.startsWith('https://')) return override
  return manifest.downloadUrl
}

export function findDevAssetsDir(): string | null {
  if (app.isPackaged) return null
  for (const root of getProjectRoots()) {
    const dir = join(root, '.dev-assets')
    if (hasPackContentAt(dir)) return dir
  }
  return null
}
