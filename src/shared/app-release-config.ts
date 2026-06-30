import releaseConfig from './app-release-config.json'

/** 生产构建内置 Platform API 根地址（开发环境可用 .env 的 VITE_PLATFORM_API_URL 覆盖） */
export const BUILTIN_PLATFORM_API_URL = String(releaseConfig.platformApiUrl || '').trim()

/**
 * 生产构建内置初始素材包下载地址。
 * 留空时初始化向导不展示「从远程下载」，用户需本地 zip 或跳过内置占位。
 */
export const BUILTIN_INITIAL_ASSET_PACK_DOWNLOAD_URL = String(
  releaseConfig.initialAssetPackDownloadUrl || ''
).trim()

export function resolveAssetPackDownloadUrl(
  manifestDownloadUrl = '',
  options?: { allowManifestFallback?: boolean }
): string {
  if (BUILTIN_INITIAL_ASSET_PACK_DOWNLOAD_URL) {
    return BUILTIN_INITIAL_ASSET_PACK_DOWNLOAD_URL
  }
  if (options?.allowManifestFallback) {
    return String(manifestDownloadUrl || '').trim()
  }
  return ''
}

export function isRemoteAssetDownloadConfigured(
  manifestDownloadUrl = '',
  options?: { allowManifestFallback?: boolean }
): boolean {
  const url = resolveAssetPackDownloadUrl(manifestDownloadUrl, options)
  return /^https?:\/\//i.test(url)
}
