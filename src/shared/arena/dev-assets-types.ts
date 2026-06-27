export type DevAssetsEntryKind = 'directory' | 'file'

export interface DevAssetsEntry {
  name: string
  relativePath: string
  kind: DevAssetsEntryKind
  sizeBytes?: number
  updatedAt?: string
  isReadme?: boolean
}

export interface DevAssetsTreeNode {
  relativePath: string
  label: string
  kind: DevAssetsEntryKind
  children?: DevAssetsTreeNode[]
}

export interface DevAssetsPackResult {
  ok: boolean
  zipPath?: string
  manifestPath?: string
  sizeBytes?: number
  sha256?: string
  error?: string
}

export interface DevAssetsEnsureResult {
  ok: boolean
  root?: string
  created?: boolean
  files?: number
  bytes?: number
  /** 本次是否从 manifest 拉取并解压了素材包 */
  assetPackFetched?: boolean
  assetPackSource?: 'local' | 'remote'
  assetPackError?: string
}

export interface DevAssetsListResult {
  ok: boolean
  relativePath?: string
  entries?: DevAssetsEntry[]
  readme?: string | null
  error?: string
}
