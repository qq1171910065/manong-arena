import { ipcRenderer } from 'electron'
import type {
  DevAssetsEnsureResult,
  DevAssetsListResult,
  DevAssetsPackResult,
} from '@shared/arena/dev-assets-types'

export const devAssetsDomain = {
  isDevAssetsAvailable: () =>
    ipcRenderer.invoke('dev-assets:is-available') as Promise<{ ok: boolean; available: boolean }>,
  ensureDevAssets: () => ipcRenderer.invoke('dev-assets:ensure') as Promise<DevAssetsEnsureResult>,
  getDevAssetsTree: () =>
    ipcRenderer.invoke('dev-assets:get-tree') as Promise<{
      ok: boolean
      root: string
      tree: import('@shared/arena/dev-assets-types').DevAssetsTreeNode
    }>,
  listDevAssets: (relativePath: string) =>
    ipcRenderer.invoke('dev-assets:list', relativePath) as Promise<DevAssetsListResult>,
  openDevAssetsPath: (relativePath: string) =>
    ipcRenderer.invoke('dev-assets:open-path', relativePath) as Promise<{ ok: boolean; error?: string }>,
  showDevAssetsItem: (relativePath: string) =>
    ipcRenderer.invoke('dev-assets:show-item', relativePath) as Promise<{ ok: boolean; error?: string }>,
  importDevAssets: (relativeDir: string) =>
    ipcRenderer.invoke('dev-assets:import', relativeDir) as Promise<{
      ok: boolean
      imported?: string[]
      error?: string
    }>,
  deleteDevAsset: (relativePath: string) =>
    ipcRenderer.invoke('dev-assets:delete', relativePath) as Promise<{ ok: boolean; error?: string }>,
  syncDevAssetsToUserData: () =>
    ipcRenderer.invoke('dev-assets:sync-user-data') as Promise<{ ok: boolean; error?: string }>,
  packExportDevAssets: () => ipcRenderer.invoke('dev-assets:pack-export') as Promise<DevAssetsPackResult>,
  previewDevAsset: (relativePath: string) =>
    ipcRenderer.invoke('dev-assets:preview', relativePath) as Promise<{ ok: boolean; dataUrl?: string; error?: string }>,
}

export type DevAssetsApi = typeof devAssetsDomain
