import { getApiBaseUrl } from './config'
import { isSuccessBusinessCode, parseCoolApiEnvelope } from './api'
import { getProductCode } from '@renderer/composables/runtime-config'

export interface ClientReleaseLatest {
  productCode: string
  currentVersion: string
  latestVersion: string | null
  hasUpdate: boolean
  downloadUrl: string | null
  releaseNotes: string | null
}

export interface ClientReleaseHistoryItem {
  version: string
  releaseNotes: string | null
  publishedAt: string
}

async function publicGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  if (!base) throw new Error('未配置平台服务地址')

  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v))
  }
  const url = `${base}${path}?${qs.toString()}`
  const result = await window.api.fetchUrl(url, 'GET', { 'Content-Type': 'application/json' }, undefined, {
    timeoutMs: 12_000,
  })
  const envelope = parseCoolApiEnvelope(result.data)
  if (!envelope || !isSuccessBusinessCode(envelope.code)) {
    throw new Error(envelope?.message || '请求失败')
  }
  return envelope.data as T
}

export const clientReleaseApi = {
  checkLatest(
    platform: string,
    currentVersion: string,
    product = getProductCode()
  ): Promise<ClientReleaseLatest> {
    return publicGet<ClientReleaseLatest>('/app/client-release/latest', {
      product,
      platform,
      currentVersion,
    })
  },

  listHistory(platform: string, limit = 30, product = getProductCode()): Promise<ClientReleaseHistoryItem[]> {
    return publicGet<ClientReleaseHistoryItem[]>('/app/client-release/history', {
      product,
      platform,
      limit,
    })
  },
}
