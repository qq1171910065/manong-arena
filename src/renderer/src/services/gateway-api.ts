import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { portalApi } from './portal-api'
import { DEFAULT_SYSTEM_ROLE_MODEL_ID, MIMO_TTS_MODEL_ID } from '@shared/arena/constants'
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
      (status === 503
        ? '模型网关暂时不可用（503），请确认 Platform「New API → 网关配置」上游已启动，且对应模型渠道已启用'
        : `HTTP ${status}`)
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

export async function listChatGatewayModels(force = false): Promise<GatewayModelInfo[]> {
  const models = await listGatewayModels(force)
  return models.filter(isLikelyChatModel)
}

/** 从网关可用模型中解析对话模型。
 * 优先级：explicit（玩法/角色已选）> preferred > 设置中的默认模型（兜底）> 内置常量 > 网关列表 */
export interface ResolveChatModelOptions {
  /** 玩法或角色已绑定的模型 ID，优先级最高 */
  explicit?: string
  /** 额外候选，排在 explicit 之后、默认模型之前 */
  preferred?: string[]
}

export async function resolveChatModelId(
  options?: string[] | ResolveChatModelOptions
): Promise<string> {
  let explicit: string | undefined
  let preferred: string[] | undefined
  if (Array.isArray(options)) {
    preferred = options
  } else if (options) {
    explicit = options.explicit?.trim() || undefined
    preferred = options.preferred
  }

  let fallbackDefault: string
  try {
    const { settingsService } = await import('./arena/settings-service')
    fallbackDefault = await settingsService.getDefaultModelId()
  } catch {
    fallbackDefault = DEFAULT_SYSTEM_ROLE_MODEL_ID
  }

  const chatModels = await listChatGatewayModels()
  if (!chatModels.length) {
    throw new Error('网关暂无可用对话模型，请在「模型概览」中确认连接与余额')
  }
  const available = chatModels.map((m) => m.id)
  const availableSet = new Set(available)
  const dedupe = (ids: string[]) => {
    const seen = new Set<string>()
    return ids.filter((id) => {
      const key = id.trim()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const candidates = dedupe([
    ...(explicit ? [explicit] : []),
    ...(preferred || []),
    fallbackDefault,
    DEFAULT_SYSTEM_ROLE_MODEL_ID,
    ...available.slice(0, 8),
  ])

  for (const id of candidates) {
    if (availableSet.has(id)) return id
  }

  for (const id of candidates) {
    const needle = id.toLowerCase()
    const hit = available.find(
      (modelId) =>
        modelId.toLowerCase() === needle ||
        modelId.toLowerCase().endsWith(`/${needle}`) ||
        modelId.toLowerCase().includes(needle)
    )
    if (hit) return hit
  }

  return available[0]!
}

function isLikelyChatModel(model: GatewayModelInfo): boolean {
  const hay = `${model.id} ${model.tags.join(' ')} ${model.endpointTypes.join(' ')}`.toLowerCase()
  if (/image|video|audio|tts|whisper|embedding|rerank|dall|midjourney|flux|sdxl|suno/.test(hay)) {
    return false
  }
  return true
}

export interface GatewayTtsOptions {
  text: string
  voice: string
  styleInstruction?: string
}

function normalizeBase64(input: string): string {
  let s = input.trim()
  const match = s.match(/^data:[^;,]+;base64,(.+)$/is)
  if (match) s = match[1]
  s = s.replace(/\s/g, '')
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = s.length % 4
  if (pad) s += '='.repeat(4 - pad)
  return s
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = normalizeBase64(base64)
  try {
    const binary = atob(normalized)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes.buffer
  } catch {
    throw new Error('语音数据解码失败，网关返回格式异常')
  }
}

function isWavBuffer(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 12) return false
  return new DataView(buffer).getUint32(0, false) === 0x52494646
}

function isLikelyMp3(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 3) return false
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return true
  return bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0
}

function pcm16LeToWav(pcm: ArrayBuffer, sampleRate = 24000, channels = 1): ArrayBuffer {
  const pcmBytes = new Uint8Array(pcm)
  const dataSize = pcmBytes.length
  const blockAlign = channels * 2
  const byteRate = sampleRate * blockAlign
  const wav = new ArrayBuffer(44 + dataSize)
  const view = new DataView(wav)
  const bytes = new Uint8Array(wav)

  const writeTag = (offset: number, tag: string) => {
    for (let i = 0; i < tag.length; i++) bytes[offset + i] = tag.charCodeAt(i)
  }

  writeTag(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeTag(8, 'WAVE')
  writeTag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true)
  writeTag(36, 'data')
  view.setUint32(40, dataSize, true)
  bytes.set(pcmBytes, 44)
  return wav
}

function normalizeTtsAudioBuffer(buffer: ArrayBuffer): ArrayBuffer {
  if (buffer.byteLength < 2) {
    throw new Error('语音数据无效或过小，请检查网关 TTS 配置')
  }
  if (isWavBuffer(buffer) || isLikelyMp3(buffer)) return buffer
  if (buffer.byteLength % 2 === 0) return pcm16LeToWav(buffer)
  throw new Error('语音数据格式无法识别，请确认网关 TTS 返回 WAV 或 PCM')
}

function decodeGatewayAudio(data: unknown): ArrayBuffer | null {
  if (!data || typeof data !== 'object') return null
  const root = data as Record<string, unknown>
  const choice = (root.choices as Array<{ message?: Record<string, unknown> }> | undefined)?.[0]
  const message = choice?.message
  if (!message) return null

  const audio = message.audio
  if (typeof audio === 'string' && audio.trim()) {
    return base64ToArrayBuffer(audio)
  }
  if (audio && typeof audio === 'object') {
    const audioData = (audio as { data?: string; b64?: string }).data ?? (audio as { b64?: string }).b64
    if (typeof audioData === 'string' && audioData.trim()) return base64ToArrayBuffer(audioData)
  }
  if (typeof message.content === 'string') {
    const content = message.content.trim()
    if (content.startsWith('data:audio')) {
      const comma = content.indexOf(',')
      if (comma >= 0) return base64ToArrayBuffer(content.slice(comma + 1))
    }
  }
  return null
}

/** MiMo-V2.5-TTS 非流式合成，返回 WAV ArrayBuffer */
export async function gatewayTtsSynthesize(options: GatewayTtsOptions): Promise<ArrayBuffer> {
  const text = String(options.text || '').trim()
  if (!text) throw new Error('TTS 文本为空')

  const res = await gatewayFetch('chat/completions', {
    method: 'POST',
    timeoutMs: 90_000,
    body: {
      model: MIMO_TTS_MODEL_ID,
      messages: [
        {
          role: 'user',
          content: options.styleInstruction || '用自然清晰的中文语调朗读以下内容，语速偏快，节奏紧凑。',
        },
        { role: 'assistant', content: text },
      ],
      audio: {
        format: 'wav',
        voice: options.voice,
      },
    },
  })

  if (!res.ok) throw new Error(res.error || '语音合成失败')
  const raw = decodeGatewayAudio(res.data)
  if (!raw) {
    const hint = (res.data as { error?: { message?: string } })?.error?.message
    throw new Error(hint || '语音合成响应缺少音频数据，请确认网关已启用 mimo-v2.5-tts')
  }
  return normalizeTtsAudioBuffer(raw)
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
  messages: Array<{ role: string; content: string }>,
  params?: import('@shared/arena/character-model-params').GatewayGenerationParams
): Promise<GatewayChatResult> {
  const body: Record<string, unknown> = { model, messages, stream: false }
  if (params?.temperature != null) body.temperature = params.temperature
  if (params?.top_p != null) body.top_p = params.top_p
  if (params?.presence_penalty != null) body.presence_penalty = params.presence_penalty
  if (params?.frequency_penalty != null) body.frequency_penalty = params.frequency_penalty
  if (params?.max_tokens != null) body.max_tokens = params.max_tokens
  const res = await gatewayFetch('chat/completions', {
    method: 'POST',
    body,
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
  onReasoningChunk?: (text: string) => void
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
  handlers: StreamChatHandlers,
  params?: import('@shared/arena/character-model-params').GatewayGenerationParams
): Promise<() => void> {
  let cancelled = false
  let cleanupFns: Array<() => void> = []

  async function runStream(forceRefreshKey: boolean): Promise<void> {
    cleanupFns.forEach((fn) => fn())
    cleanupFns = []

    const endpoints = await resolveGatewayEndpoints(forceRefreshKey)
    const key = await ensureGatewayKey(getAppKeyName(), forceRefreshKey)
    const url = `${endpoints.chatBaseUrl}/chat/completions`
    const bodyPayload: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }
    if (params?.temperature != null) bodyPayload.temperature = params.temperature
    if (params?.top_p != null) bodyPayload.top_p = params.top_p
    if (params?.presence_penalty != null) bodyPayload.presence_penalty = params.presence_penalty
    if (params?.frequency_penalty != null) bodyPayload.frequency_penalty = params.frequency_penalty
    if (params?.max_tokens != null) bodyPayload.max_tokens = params.max_tokens
    const body = JSON.stringify(bodyPayload)

    const offChunk = window.api.onSSEChunk((line: string) => {
      if (!line.startsWith('data:')) return
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
          usage?: GatewayTokenUsage
        }
        const delta = parsed.choices?.[0]?.delta
        if (delta?.content) handlers.onChunk(delta.content)
        if (delta?.reasoning_content) handlers.onReasoningChunk?.(delta.reasoning_content)
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
          : /503|网关暂时不可用|无可用渠道|no available channel/i.test(err)
            ? (err.includes('503') && err.length < 80
              ? '模型网关暂时不可用（503），请确认 Platform「New API → 网关配置」上游已启动，且对应模型渠道已启用'
              : err)
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
      await window.api.fetchSSE({ url, method: 'POST', body, token: key, timeoutMs: 120_000 })
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
