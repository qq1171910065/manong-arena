/** 初始素材包 ID 与版本（pack:assets 会同步写入 bundled-asset-pack-manifest.json） */
export const INITIAL_ASSET_PACK_ID = 'initial'
export const INITIAL_ASSET_PACK_VERSION = '1.0.0'
/** 仓库内置最小素材包版本（纯色占位，随客户端分发） */
export const BUNDLED_MINIMAL_ASSET_VERSION = 'bundled-minimal-1'

export interface InitialAssetPackManifest {
  packId: string
  version: string
  fileName: string
  downloadUrl: string
  sha256: string
  sizeBytes: number
  generatedAt: string
}

export interface InitialAssetInstallState {
  packId: string
  version: string
  installedAt: string
}

export type AssetPackProgressPhase = 'download' | 'extract' | 'verify'

export interface AssetPackProgressPayload {
  phase: AssetPackProgressPhase
  percent?: number
  receivedBytes?: number
  totalBytes?: number | null
  label?: string
}
