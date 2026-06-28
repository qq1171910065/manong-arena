import { ipcRenderer } from 'electron'
import type { AssetPackProgressPayload, InitialAssetPackManifest } from '@shared/arena/initial-assets'
import type { AssetPackStatus } from '@shared/arena/asset-pack-api'

export const assetPackDomain = {
  isInitialAssetsReady: () =>
    ipcRenderer.invoke('asset-pack:is-ready') as Promise<{
      ok: boolean
      ready?: boolean
    }>,

  getInitialAssetManifest: () =>
    ipcRenderer.invoke('asset-pack:get-manifest') as Promise<{
      ok: boolean
      manifest?: InitialAssetPackManifest | null
    }>,

  getAssetPackStatus: () => ipcRenderer.invoke('asset-pack:get-status') as Promise<AssetPackStatus>,

  ensureInitialAssets: () =>
    ipcRenderer.invoke('asset-pack:ensure') as Promise<{
      ok: boolean
      skipped?: boolean
      source?: 'local' | 'remote'
      error?: string
    }>,

  installAssetPackFromFile: () =>
    ipcRenderer.invoke('asset-pack:install-from-file') as Promise<{
      ok: boolean
      skipped?: boolean
      source?: 'local' | 'remote'
      canceled?: boolean
      error?: string
    }>,

  installBundledMinimalAssets: () =>
    ipcRenderer.invoke('asset-pack:install-bundled-minimal') as Promise<{
      ok: boolean
      skipped?: boolean
      source?: 'local' | 'remote'
      error?: string
    }>,

  onAssetPackProgress: (callback: (payload: AssetPackProgressPayload) => void) => {
    const handler = (_event: unknown, data: AssetPackProgressPayload) => callback(data)
    ipcRenderer.on('asset-pack:progress', handler)
    return () => ipcRenderer.removeListener('asset-pack:progress', handler)
  },
}
