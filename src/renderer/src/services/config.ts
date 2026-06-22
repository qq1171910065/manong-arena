/** localStorage 键：用户在本机覆盖的平台 API 根地址 */
export const API_BASE_URL_STORAGE_KEY = 'mntools-api-base-url'

export function getDefaultApiBaseUrl(): string {
  const env =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_PLATFORM_API_URL
      ? String(import.meta.env.VITE_PLATFORM_API_URL).trim()
      : ''
  return env || 'http://127.0.0.1:8010'
}

function normalizeApiBaseUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, '')
}

function isHttpBaseUrl(s: string): boolean {
  return /^https?:\/\/.+/i.test(s)
}

export function getApiBaseUrl(): string {
  const fallback = getDefaultApiBaseUrl()
  if (typeof localStorage === 'undefined') return fallback
  try {
    const stored = localStorage.getItem(API_BASE_URL_STORAGE_KEY)
    if (!stored?.trim()) return fallback
    const n = normalizeApiBaseUrl(stored)
    if (!isHttpBaseUrl(n)) return fallback
    return n
  } catch {
    return fallback
  }
}

export function saveApiBaseUrlFromInput(raw: string): { ok: true; value: string } | { ok: false } {
  const trimmed = raw.trim()
  if (!trimmed) {
    try {
      localStorage.removeItem(API_BASE_URL_STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return { ok: true, value: getDefaultApiBaseUrl() }
  }
  const n = normalizeApiBaseUrl(trimmed)
  if (!isHttpBaseUrl(n)) return { ok: false }
  try {
    localStorage.setItem(API_BASE_URL_STORAGE_KEY, n)
  } catch {
    return { ok: false }
  }
  return { ok: true, value: n }
}
