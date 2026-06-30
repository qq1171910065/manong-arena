import type { AssetPackProgressPayload, InitialAssetPackManifest } from '@shared/arena/initial-assets'

export interface AssetPackStatus {
  ok: boolean
  ready?: boolean
  installedVersion?: string | null
  installedAt?: string | null
  manifestVersion?: string | null
  manifestFileName?: string | null
}

export interface AssetPackApi {
  isInitialAssetsReady: () => Promise<{ ok: boolean; ready?: boolean }>
  isUserAssetPackInstalled: () => Promise<{ ok: boolean; installed?: boolean }>
  getInitialAssetManifest: () => Promise<{ ok: boolean; manifest?: InitialAssetPackManifest | null }>
  getAssetPackStatus: () => Promise<AssetPackStatus>
  ensureInitialAssets: () => Promise<{
    ok: boolean
    skipped?: boolean
    source?: 'local' | 'remote'
    error?: string
  }>
  installAssetPackFromFile: () => Promise<{
    ok: boolean
    skipped?: boolean
    source?: 'local' | 'remote'
    canceled?: boolean
    error?: string
  }>
  onAssetPackProgress: (callback: (payload: AssetPackProgressPayload) => void) => () => void
}
