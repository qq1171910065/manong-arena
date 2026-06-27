import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  BUNDLED_ASSET_PACK_MANIFEST,
  BUNDLED_ASSET_PACK_MANIFEST_RELATIVE,
  isValidAssetPackManifest,
} from '@shared/arena/bundled-asset-pack-manifest'
import type { InitialAssetPackManifest } from '@shared/arena/initial-assets'
import { getProjectRoots } from './project-roots'

function readManifestFile(path: string): InitialAssetPackManifest | null {
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'))
    return isValidAssetPackManifest(parsed) ? parsed : null
  } catch {
    return null
  }
}

/** 静态内置清单：随安装包版本发布，不从 CDN 拉取 */
export function resolveAssetPackManifest(): InitialAssetPackManifest | null {
  if (!app.isPackaged) {
    for (const root of getProjectRoots()) {
      const fromDisk = readManifestFile(join(root, BUNDLED_ASSET_PACK_MANIFEST_RELATIVE))
      if (fromDisk) return fromDisk
    }
  }

  return isValidAssetPackManifest(BUNDLED_ASSET_PACK_MANIFEST) ? BUNDLED_ASSET_PACK_MANIFEST : null
}
