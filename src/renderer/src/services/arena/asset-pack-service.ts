import { isRemoteAssetDownloadConfigured } from '@shared/app-release-config'
import type { AssetPackProgressPayload } from '@shared/arena/initial-assets'
import type { AssetPackStatus } from '@shared/arena/asset-pack-api'

export async function isInitialAssetsReady(): Promise<boolean> {
  if (typeof window.api?.isInitialAssetsReady !== 'function') return false
  const result = await window.api.isInitialAssetsReady()
  return Boolean(result.ready)
}

export async function isUserAssetPackInstalled(): Promise<boolean> {
  if (typeof window.api?.isUserAssetPackInstalled !== 'function') return false
  const result = await window.api.isUserAssetPackInstalled()
  return Boolean(result.installed)
}

export async function isRemoteAssetDownloadAvailable(): Promise<boolean> {
  if (typeof window.api?.getInitialAssetManifest !== 'function') return false
  const result = await window.api.getInitialAssetManifest()
  const manifestUrl = result.manifest?.downloadUrl ?? ''
  const isDev = import.meta.env.DEV
  return isRemoteAssetDownloadConfigured(manifestUrl, { allowManifestFallback: isDev })
}

export async function getAssetPackStatus(): Promise<AssetPackStatus | null> {
  if (typeof window.api?.getAssetPackStatus !== 'function') return null
  return window.api.getAssetPackStatus()
}

export async function ensureInitialAssets(
  onProgress?: (progress: AssetPackProgressPayload) => void
): Promise<void> {
  if (typeof window.api?.ensureInitialAssets !== 'function') return

  const unsubscribe = onProgress
    ? window.api.onAssetPackProgress((payload) => onProgress(payload))
    : undefined

  try {
    const result = await window.api.ensureInitialAssets()
    if (!result.ok) {
      throw new Error(result.error || '初始素材准备失败')
    }
  } finally {
    unsubscribe?.()
  }
}

export async function installBundledMinimalAssets(
  onProgress?: (progress: AssetPackProgressPayload) => void
): Promise<void> {
  if (typeof window.api?.installBundledMinimalAssets !== 'function') {
    throw new Error('当前环境不支持内置默认素材')
  }

  const unsubscribe = onProgress
    ? window.api.onAssetPackProgress((payload) => onProgress(payload))
    : undefined

  try {
    const result = await window.api.installBundledMinimalAssets()
    if (!result.ok) {
      throw new Error(result.error || '内置默认素材准备失败')
    }
  } finally {
    unsubscribe?.()
  }
}

export async function installAssetPackFromFile(
  onProgress?: (progress: AssetPackProgressPayload) => void
): Promise<void> {
  if (typeof window.api?.installAssetPackFromFile !== 'function') {
    throw new Error('当前环境不支持从本地载入素材包')
  }

  const unsubscribe = onProgress
    ? window.api.onAssetPackProgress((payload) => onProgress(payload))
    : undefined

  try {
    const result = await window.api.installAssetPackFromFile()
    if (result.canceled) {
      throw new Error('CANCELED')
    }
    if (!result.ok) {
      throw new Error(result.error || '本地素材包载入失败')
    }
  } finally {
    unsubscribe?.()
  }
}
