import { getApiBaseUrl } from './config'

export type RefreshSessionResult = 'ok' | 'invalid' | 'unavailable' | 'no_refresh_token'

export interface ApiResponse<T = unknown> {
  code: number
  data: T
  message?: string
}

export function isSuccessBusinessCode(code: unknown): boolean {
  const n = Number(code)
  return n === 0 || n === 1000
}

export function parseCoolApiEnvelope(raw: unknown): ApiResponse<unknown> | null {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw) && 'code' in raw) {
    return raw as ApiResponse<unknown>
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    if (t.startsWith('{') || t.startsWith('[')) {
      try {
        const o = JSON.parse(t) as unknown
        if (o != null && typeof o === 'object' && !Array.isArray(o) && 'code' in o) {
          return o as ApiResponse<unknown>
        }
      } catch {
        return null
      }
    }
  }
  return null
}

const REFRESH_PATH = '/portal/open/refreshToken'

export async function refreshSessionFromStorage(): Promise<RefreshSessionResult> {
  const hasPortalSession =
    typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('wb_portal_session'))
  if (!hasPortalSession) {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    return 'no_refresh_token'
  }

  const rt = localStorage.getItem('refreshToken')
  if (!rt) return 'no_refresh_token'

  const url = `${getApiBaseUrl()}${REFRESH_PATH}?refreshToken=${encodeURIComponent(rt)}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  try {
    const result = await window.api.fetchUrl(url, 'GET', headers, undefined, { timeoutMs: 8_000 })
    if (!result.success) return 'unavailable'
    const respBody = parseCoolApiEnvelope(result.data)
    if (!respBody) return 'unavailable'
    if (!isSuccessBusinessCode(respBody.code)) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      localStorage.removeItem('userInfo')
      return 'invalid'
    }
    const data = respBody.data as {
      token?: string
      refreshToken?: string
      expire?: number
      refreshExpire?: number
    }
    if (data?.token) localStorage.setItem('token', data.token)
    if (data?.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
    try {
      const raw = localStorage.getItem('wb_portal_session')
      if (raw && data?.token) {
        const session = JSON.parse(raw) as Record<string, unknown>
        session.token = data.token
        if (data.refreshToken) session.refreshToken = data.refreshToken
        if (data.expire != null) session.expire = data.expire
        if (data.refreshExpire != null) session.refreshExpire = data.refreshExpire
        localStorage.setItem('wb_portal_session', JSON.stringify(session))
      }
    } catch {
      /* ignore */
    }
    return 'ok'
  } catch {
    return 'unavailable'
  }
}
