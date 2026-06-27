import type { InitialAssetPackManifest } from './initial-assets'
import manifestJson from './bundled-asset-pack-manifest.json'

/** 相对项目根目录，供 dev 环境从磁盘热读取 pack:assets 产物 */
export const BUNDLED_ASSET_PACK_MANIFEST_RELATIVE = 'src/shared/arena/bundled-asset-pack-manifest.json'

/** 打包进安装包的内置素材清单（随应用版本发布，不从 CDN 拉取） */
export const BUNDLED_ASSET_PACK_MANIFEST: InitialAssetPackManifest = manifestJson

export function isValidAssetPackManifest(value: unknown): value is InitialAssetPackManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<InitialAssetPackManifest>
  return Boolean(
    manifest.packId &&
      manifest.version &&
      manifest.fileName &&
      manifest.downloadUrl &&
      typeof manifest.sha256 === 'string' &&
      typeof manifest.sizeBytes === 'number'
  )
}
