import type {
  DevAssetsEnsureResult,
  DevAssetsListResult,
  DevAssetsPackResult,
  DevAssetsTreeNode,
} from './dev-assets-types'

export interface DevAssetsApi {
  isDevAssetsAvailable: () => Promise<{ ok: boolean; available: boolean }>
  ensureDevAssets: () => Promise<DevAssetsEnsureResult>
  getDevAssetsTree: () => Promise<{ ok: boolean; root: string; tree: DevAssetsTreeNode }>
  listDevAssets: (relativePath: string) => Promise<DevAssetsListResult>
  openDevAssetsPath: (relativePath: string) => Promise<{ ok: boolean; error?: string }>
  showDevAssetsItem: (relativePath: string) => Promise<{ ok: boolean; error?: string }>
  importDevAssets: (relativeDir: string) => Promise<{ ok: boolean; imported?: string[]; error?: string }>
  deleteDevAsset: (relativePath: string) => Promise<{ ok: boolean; error?: string }>
  syncDevAssetsToUserData: () => Promise<{ ok: boolean; error?: string }>
  packExportDevAssets: () => Promise<DevAssetsPackResult>
  previewDevAsset: (relativePath: string) => Promise<{ ok: boolean; dataUrl?: string; error?: string }>
}

export type { DevAssetsPackResult }
