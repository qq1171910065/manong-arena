import { existsSync } from 'node:fs'

/** initial 素材 zip：图片包 + 初始化数据包（与 .dev-assets 顶层目录一致） */
export const ASSET_PACK_CONTENT_ROOTS = [
  'character-packs',
  'game-mode-packs',
  'character-data-packs',
  'game-mode-data-packs',
] as const

export type AssetPackContentRoot = (typeof ASSET_PACK_CONTENT_ROOTS)[number]

/** @deprecated 使用 ASSET_PACK_CONTENT_ROOTS */
export const ASSET_PACK_CONTENT_ROOT: AssetPackContentRoot = 'character-packs'

export function normalizeAssetRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
}

export function shouldIncludeInInitialAssetPack(relativePath: string): boolean {
  const normalized = normalizeAssetRelativePath(relativePath)
  return ASSET_PACK_CONTENT_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`)
  )
}

export function getAssetPackSourceDirs(assetsRoot: string): string[] {
  const base = assetsRoot.replace(/[/\\]+$/, '')
  return ASSET_PACK_CONTENT_ROOTS
    .map((root) => `${base}/${root}`)
    .filter((dir) => existsSync(dir))
}

/** @deprecated 使用 getAssetPackSourceDirs */
export function getAssetPackSourceDir(assetsRoot: string): string {
  return `${assetsRoot.replace(/[/\\]+$/, '')}/${ASSET_PACK_CONTENT_ROOT}`
}
