import { ipcMain } from 'electron'

const TIMEOUT_MS = 30_000
const TIMEOUT_MS_MAX = 600_000

function formatFetchError(err: unknown): string {
  const e = err as Error & { cause?: unknown }
  const parts: string[] = []
  let cur: unknown = e
  const seen = new Set<unknown>()
  for (let i = 0; i < 5 && cur && !seen.has(cur); i++) {
    seen.add(cur)
    const msg = cur instanceof Error ? cur.message : String(cur)
    if (msg) parts.push(msg)
    cur = cur instanceof Error ? cur.cause : undefined
  }
  return parts.length ? parts.join(' — ') : '请求失败'
}

function parseJsonLikeResponseBody(
  rawText: string,
  contentType: string,
  httpStatus: number
): { ok: true; data: unknown } | { ok: false; error: string } {
  const trimmed = rawText.trim()
  const ct = (contentType || '').toLowerCase()
  const looksJsonByHeader =
    ct.includes('application/json') || ct.includes('+json')
  const first = trimmed.charAt(0)
  const looksJsonByBody = first === '{' || first === '['

  if (looksJsonByHeader || looksJsonByBody) {
    if (!trimmed) return { ok: true, data: {} }
    try {
      return { ok: true, data: JSON.parse(trimmed) as unknown }
    } catch {
      return { ok: false, error: `响应正文非合法 JSON（HTTP ${httpStatus}）` }
    }
  }
  return { ok: true, data: rawText }
}

export function registerRequestHandlers(): void {
  ipcMain.handle(
    'request:fetch',
    async (
      _event,
      payload: {
        url: string
        method?: string
        headers?: Record<string, string>
        body?: string
        timeoutMs?: number
      }
    ) => {
      const { url, method = 'GET', headers: customHeaders, body, timeoutMs: rawTimeout } = payload

      if (!url || !url.startsWith('http')) {
        return { success: false, error: '请输入合法的 HTTP/HTTPS 地址' }
      }

      const startAt = Date.now()
      const timeoutMs = Math.min(
        Math.max(1000, Number(rawTimeout) > 0 ? Number(rawTimeout) : TIMEOUT_MS),
        TIMEOUT_MS_MAX
      )

      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)

        const headers: Record<string, string> = {
          'User-Agent': 'mntools-electron/1.0',
          ...customHeaders,
        }

        const fetchOptions: RequestInit = {
          method,
          signal: controller.signal,
          headers,
        }

        if (body && method !== 'GET') {
          fetchOptions.body = body
        }

        const response = await fetch(url, fetchOptions)
        clearTimeout(timer)

        const elapsed = Date.now() - startAt
        const contentType = response.headers.get('content-type') ?? ''
        const rawText = await response.text()
        const parsed = parseJsonLikeResponseBody(rawText, contentType, response.status)
        if (!parsed.ok) {
          return { success: false, elapsed, error: parsed.error }
        }

        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          elapsed,
          data: parsed.data,
        }
      } catch (err) {
        const elapsed = Date.now() - startAt
        const sec = Math.round(timeoutMs / 1000)
        const message =
          (err as Error).name === 'AbortError'
            ? `请求超时（超过 ${sec}s）`
            : formatFetchError(err)
        return { success: false, elapsed, error: message }
      }
    }
  )
}
