import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { portalApi } from './portal-api'
import type { PortalGatewayConfig } from './portal-api'

const GATEWAY_KEY_STORAGE = 'wb_gateway_api_key'

export interface GatewayEndpointConfig {
  configured: boolean
  mode: 'direct' | 'proxy'
  baseUrl: string
  chatBaseUrl: string
  pricingUrl: string
  hint?: string
}

export interface GatewayModelInfo {
  id: string
  tags: string[]
  endpointTypes: string[]
}

export interface ModelTestResult {
  model: string
  ok: boolean
  latencyMs?: number
  message?: string
  replyPreview?: string
}

export interface GatewayTokenUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

export interface GatewayChatResult {
  content: string
  usage?: GatewayTokenUsage
}

export interface GatewayConnectivityReport {
  ok: boolean
  baseUrl: string
  modelCount: number
  testedCount: number
  successCount: number
  results: ModelTestResult[]
  message?: string
}

let modelsCache: { expires: number; models: GatewayModelInfo[] } | null = null
let endpointCache: { expires: number; config: GatewayEndpointConfig } | null = null

function mapGatewayConfig(cfg: PortalGatewayConfig): GatewayEndpointConfig {
  const baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '')
  return {
    configured: Boolean(cfg.configured && baseUrl),
    mode: cfg.mode === 'proxy' ? 'proxy' : 'direct',
    baseUrl,
    chatBaseUrl: String(cfg.chatBaseUrl || (baseUrl ? `${baseUrl}/v1` : '')).replace(/\/+$/, ''),
    pricingUrl: String(cfg.pricingUrl || (baseUrl ? `${baseUrl}/api/pricing` : '')).replace(/\/+$/, ''),
    hint: cfg.hint,
  }
}

export async function resolveGatewayEndpoints(force = false): Promise<GatewayEndpointConfig> {
  const now = Date.now()
  if (!force && endpointCache && endpointCache.expires > now) {
    return endpointCache.config
  }
  const raw = await portalApi.gatewayConfig()
  const config = mapGatewayConfig(raw)
  if (!config.configured) {
    throw new Error('模型网关未配置，请在 Platform 运营后台「New API → 网关配置」中启用')
  }
  endpointCache = { expires: now + 5 * 60_000, config }
  return config
}

/** 上游 New API 根地址（Platform 配置） */
export function getGatewayRootUrl(): string {
  return endpointCache?.config.baseUrl || ''
}

/** OpenAI 兼容对话基址，通常为 {baseUrl}/v1 */
export function getGatewayBaseUrl(): string {
  return endpointCache?.config.chatBaseUrl || ''
}

export function getStoredGatewayKey(): string {
  return localStorage.getItem(GATEWAY_KEY_STORAGE) || ''
}

export function setStoredGatewayKey(key: string): void {
  const k = String(key || '').trim()
  if (k) localStorage.setItem(GATEWAY_KEY_STORAGE, k)
  else localStorage.removeItem(GATEWAY_KEY_STORAGE)
}

export function clearStoredGatewayKey(): void {
  localStorage.removeItem(GATEWAY_KEY_STORAGE)
  modelsCache = null
}

export function invalidateGatewayModelCache(): void {
  modelsCache = null
  endpointCache = null
}

export function getAppKeyName(): string {
  return getRuntimeConfig().appId
}

export async function ensureGatewayKey(appKeyName = getAppKeyName(), forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const existing = getStoredGatewayKey()
    if (existing) return existing
  } else {
    clearStoredGatewayKey()
    invalidateGatewayModelCache()
  }

  const ensured = await portalApi.ensureDefaultKey(appKeyName)
  const plain = String(ensured.keyPlaintext || '').trim()
  if (!plain) throw new Error('获取 API Key 失败，请在用户中心手动创建')
  setStoredGatewayKey(plain)
  return plain
}

function buildGatewayUrl(subPath: string, endpoints: GatewayEndpointConfig): string {
  const normalized = subPath.replace(/^\/+/, '')
  if (normalized === 'api/pricing') return endpoints.pricingUrl
  return `${endpoints.chatBaseUrl}/${normalized}`
}

async function gatewayFetch(
  subPath: string,
  opts: {
    method?: 'GET' | 'POST'
    body?: unknown
    auth?: boolean
    timeoutMs?: number
  } = {}
): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  let endpoints: GatewayEndpointConfig
  try {
    endpoints = await resolveGatewayEndpoints()
  } catch (e) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: e instanceof Error ? e.message : '获取模型网关配置失败',
    }
  }

  const method = opts.method || 'GET'
  const url = buildGatewayUrl(subPath, endpoints)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (opts.auth !== false) {
    const key = await ensureGatewayKey()
    headers.Authorization = `Bearer ${key}`
  }

  const result = await window.api.fetchUrl(
    url,
    method,
    headers,
    method === 'POST' && opts.body != null ? JSON.stringify(opts.body) : undefined,
    { timeoutMs: opts.timeoutMs ?? 120_000 }
  )

  if (!result.success) {
    return { ok: false, status: result.status ?? 0, data: null, error: result.error || '请求失败' }
  }

  let data: unknown = result.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch {
      data = result.data
    }
  }
  const status = result.status ?? 200
  if (status === 402) {
    const msg =
      (data as { error?: { message?: string } })?.error?.message || '钱包余额不足，请先充值'
    return { ok: false, status, data, error: msg }
  }
  if (status === 401) {
    return { ok: false, status, data, error: 'API Key 无效，请在用户中心重新创建' }
  }
  if (status >= 400) {
    const msg =
      (data as { error?: { message?: string }; message?: string })?.error?.message ||
      (data as { message?: string })?.message ||
      `HTTP ${status}`
    return { ok: false, status, data, error: msg }
  }
  return { ok: true, status, data }
}

function parsePricingRows(data: unknown): GatewayModelInfo[] {
  const rows: GatewayModelInfo[] = []
  if (!data || typeof data !== 'object') return rows
  const obj = data as Record<string, unknown>
  const candidates = [obj.data, obj.models, obj]
  for (const c of candidates) {
    if (Array.isArray(c)) {
      for (const item of c) {
        if (!item || typeof item !== 'object') continue
        const rec = item as Record<string, unknown>
        const id = String(rec.model_name || rec.model || rec.id || '').trim()
        if (!id) continue
        const tagsRaw = rec.tags
        const tags =
          typeof tagsRaw === 'string'
            ? tagsRaw
                .split(/[,，;；|]/)
                .map((t) => t.trim())
                .filter(Boolean)
            : Array.isArray(tagsRaw)
              ? tagsRaw.map((t) => String(t).trim()).filter(Boolean)
              : []
        const endpointRaw = rec.supported_endpoint_types ?? rec.endpoint_types
        const endpointTypes = Array.isArray(endpointRaw)
          ? endpointRaw.map((t) => String(t).trim()).filter(Boolean)
          : []
        rows.push({ id, tags, endpointTypes })
      }
      if (rows.length) break
    }
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      for (const [id] of Object.entries(c as Record<string, unknown>)) {
        const name = String(id || '').trim()
        if (name) rows.push({ id: name, tags: [], endpointTypes: [] })
      }
      if (rows.length) break
    }
  }
  const seen = new Set<string>()
  return rows
    .filter((row) => {
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
    .sort((a, b) => a.id.localeCompare(b.id))
}

export async function listGatewayModels(force = false): Promise<GatewayModelInfo[]> {
  const now = Date.now()
  if (!force && modelsCache && modelsCache.expires > now) {
    return modelsCache.models
  }
  const res = await gatewayFetch('api/pricing', { auth: false, timeoutMs: 30_000 })
  if (!res.ok) throw new Error(res.error || '获取模型列表失败')
  const models = parsePricingRows(res.data)
  modelsCache = { expires: now + 5 * 60_000, models }
  return models
}

export async function listGatewayModelIds(force = false): Promise<string[]> {
  const models = await listGatewayModels(force)
  return models.map((m) => m.id)
}

function isLikelyChatModel(model: GatewayModelInfo): boolean {
  const hay = `${model.id} ${model.tags.join(' ')} ${model.endpointTypes.join(' ')}`.toLowerCase()
  if (/image|video|audio|tts|whisper|embedding|rerank|dall|midjourney|flux|sdxl|suno/.test(hay)) {
    return false
  }
  return true
}

export async function testGatewayModel(
  model: string,
  opts: { prompt?: string; maxTokens?: number } = {}
): Promise<ModelTestResult> {
  const started = Date.now()
  const prompt = opts.prompt || 'ping'
  const maxTokens = opts.maxTokens ?? 8
  try {
    const res = await gatewayFetch('chat/completions', {
      method: 'POST',
      timeoutMs: 45_000,
      body: {
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        max_tokens: maxTokens,
      },
    })
    const latencyMs = Date.now() - started
    if (!res.ok) {
      return { model, ok: false, latencyMs, message: res.error || '调用失败' }
    }
    const choice = (res.data as { choices?: Array<{ message?: { content?: string } }> })?.choices?.[0]
    const replyPreview = String(choice?.message?.content || '').slice(0, 120)
    return { model, ok: true, latencyMs, replyPreview: replyPreview || '(空回复)' }
  } catch (e) {
    return {
      model,
      ok: false,
      latencyMs: Date.now() - started,
      message: e instanceof Error ? e.message : '调用失败',
    }
  }
}

export async function testGatewayConnectivity(
  modelIds?: string[],
  maxCount = 3
): Promise<GatewayConnectivityReport> {
  let endpoints: GatewayEndpointConfig
  try {
    endpoints = await resolveGatewayEndpoints()
  } catch (e) {
    return {
      ok: false,
      baseUrl: '',
      modelCount: 0,
      testedCount: 0,
      successCount: 0,
      results: [],
      message: e instanceof Error ? e.message : '获取模型网关配置失败',
    }
  }

  let models: GatewayModelInfo[] = []
  try {
    models = await listGatewayModels()
  } catch (e) {
    return {
      ok: false,
      baseUrl: endpoints.baseUrl,
      modelCount: 0,
      testedCount: 0,
      successCount: 0,
      results: [],
      message: e instanceof Error ? e.message : '获取模型列表失败',
    }
  }

  const chatModels = models.filter(isLikelyChatModel)
  const pool = modelIds?.length
    ? modelIds.filter((id) => models.some((m) => m.id === id))
    : chatModels.map((m) => m.id)
  const targets = pool.slice(0, Math.max(1, maxCount))
  const results: ModelTestResult[] = []

  for (const model of targets) {
    results.push(await testGatewayModel(model))
  }

  const successCount = results.filter((r) => r.ok).length
  return {
    ok: successCount > 0,
    baseUrl: endpoints.baseUrl,
    modelCount: models.length,
    testedCount: results.length,
    successCount,
    results,
    message:
      successCount === 0
        ? '所选模型均不可用，请检查 Key、余额或网关配置'
        : undefined,
  }
}

export async function gatewayChatCompletion(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<GatewayChatResult> {
  const res = await gatewayFetch('chat/completions', {
    method: 'POST',
    body: { model, messages, stream: false },
  })
  if (!res.ok) throw new Error(res.error || '对话失败')
  const data = res.data as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: GatewayTokenUsage
  }
  const choice = data?.choices?.[0]
  return {
    content: String(choice?.message?.content || ''),
    usage: data?.usage,
  }
}

export type StreamChatHandlers = {
  onChunk: (text: string) => void
  onUsage?: (usage: GatewayTokenUsage) => void
  onEnd: () => void
  onError: (err: string) => void
}

export function gatewayChatStreamCollect(
  model: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ text: string; usage?: GatewayTokenUsage; cancel: () => void }> {
  return new Promise((resolve, reject) => {
    let text = ''
    let usage: GatewayTokenUsage | undefined
    let cancel: (() => void) | null = null
    let settled = false

    void gatewayChatStream(model, messages, {
      onChunk: (chunk) => {
        text += chunk
      },
      onUsage: (u) => {
        usage = { ...usage, ...u }
      },
      onEnd: () => {
        if (settled) return
        settled = true
        resolve({ text, usage, cancel: cancel || (() => undefined) })
      },
      onError: (err) => {
        if (settled) return
        settled = true
        reject(new Error(err))
      },
    })
      .then((c) => {
        cancel = c
      })
      .catch((err) => {
        if (settled) return
        settled = true
        reject(err instanceof Error ? err : new Error(String(err)))
      })
  })
}

export async function gatewayChatStream(
  model: string,
  messages: Array<{ role: string; content: string }>,
  handlers: StreamChatHandlers
): Promise<() => void> {
  let cancelled = false
  let cleanupFns: Array<() => void> = []

  async function runStream(forceRefreshKey: boolean): Promise<void> {
    cleanupFns.forEach((fn) => fn())
    cleanupFns = []

    const endpoints = await resolveGatewayEndpoints(forceRefreshKey)
    const key = await ensureGatewayKey(getAppKeyName(), forceRefreshKey)
    const url = `${endpoints.chatBaseUrl}/chat/completions`
    const body = JSON.stringify({ model, messages, stream: true })

    const offChunk = window.api.onSSEChunk((line: string) => {
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>
          usage?: GatewayTokenUsage
        }
        const delta = parsed.choices?.[0]?.delta?.content
        if (delta) handlers.onChunk(delta)
        if (parsed.usage) handlers.onUsage?.(parsed.usage)
      } catch {
        /* ignore partial json */
      }
    })
    const offEnd = window.api.onSSEEnd(() => {
      cleanup()
      handlers.onEnd()
    })
    const offError = window.api.onSSEError((err: string) => {
      cleanup()
      if (!cancelled && !forceRefreshKey && /401/.test(err)) {
        void runStream(true).catch((e) => {
          handlers.onError(e instanceof Error ? e.message : '流式请求失败')
        })
        return
      }
      handlers.onError(
        /401/.test(err)
          ? 'API Key 无效或已过期，已尝试自动刷新。请在用户中心检查 Key 与邮箱验证状态'
          : err
      )
    })

    function cleanup() {
      offChunk()
      offEnd()
      offError()
    }

    cleanupFns = [cleanup]

    try {
      await window.api.fetchSSE({ url, method: 'POST', body, token: key })
    } catch (err) {
      cleanup()
      const msg = err instanceof Error ? err.message : '流式请求失败'
      if (!cancelled && !forceRefreshKey && /401/.test(msg)) {
        await runStream(true)
        return
      }
      handlers.onError(
        /401/.test(msg)
          ? 'API Key 无效或已过期，已尝试自动刷新。请在用户中心检查 Key 与邮箱验证状态'
          : msg
      )
    }
  }

  await runStream(false)

  return () => {
    cancelled = true
    void window.api.cancelSSE()
    cleanupFns.forEach((fn) => fn())
    cleanupFns = []
  }
}
