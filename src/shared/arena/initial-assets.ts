/** 初始素材包 ID 与版本（pack:assets 会同步写入 bundled-asset-pack-manifest.json） */
export const INITIAL_ASSET_PACK_ID = 'initial'
export const INITIAL_ASSET_PACK_VERSION = '0.1.2'
/** 仓库内置默认素材版本（default 角色 + custom 玩法封面，随客户端分发） */
export const BUNDLED_MINIMAL_ASSET_VERSION = 'bundled-minimal-1'

export interface InitialAssetPackManifest {
  packId: string
  version: string
  fileName: string
  downloadUrl: string
  sha256: string
  sizeBytes: number
  generatedAt: string
  /** 安装完整包后初始化向导将导入的角色 modelId 列表 */
  starterCharacterModelIds?: string[]
  /** 安装完整包后初始化向导将安装的玩法 id 列表 */
  starterGameModeIds?: string[]
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
