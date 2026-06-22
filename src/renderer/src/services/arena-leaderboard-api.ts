/** Arena Agent Labs 排行榜 — 来源 arena.ai/agent?rankBy=labs */

import bundledSignals from '../data/agent-signals-snapshot.json'

const CACHE_STORAGE_KEY = 'arena_agent_labs_leaderboard_cache'
const CACHE_TTL_MS = 6 * 60 * 60_000
const AGENT_LABS_SOURCE_URL = 'https://arena.ai/leaderboard/agent?rankBy=labs'
const GITHUB_LATEST_URL =
  'https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data/latest.json'
const GITHUB_AGENT_URL = (date: string) =>
  `https://raw.githubusercontent.com/oolong-tea-2026/arena-ai-leaderboards/main/data/${date}/agent.json`
const WULONG_AGENT_URL = 'https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard?name=agent'

export interface AgentSignalMetric {
  value: number
  ci: number | null
}

export interface ArenaAgentModelEntry {
  rank: number
  model: string
  vendor: string
  license?: string
  sessions: number
  netImprovement: AgentSignalMetric
  confirmedSuccess: AgentSignalMetric
  praiseVsComplaint: AgentSignalMetric
  steerability: AgentSignalMetric
  bashRecovery: AgentSignalMetric
  toolHallucination: AgentSignalMetric
}

export interface ArenaAgentLabEntry {
  rank: number
  lab: string
  topModel: string
  modelCount: number
  sessions: number
  netImprovement: AgentSignalMetric
  confirmedSuccess: AgentSignalMetric
  praiseVsComplaint: AgentSignalMetric
  steerability: AgentSignalMetric
  bashRecovery: AgentSignalMetric
  toolHallucination: AgentSignalMetric
  models: ArenaAgentModelEntry[]
}

export interface AgentSignalLeader {
  signal: AgentSignalKey
  label: string
  lab: string
  model: string
  metric: AgentSignalMetric
  higherIsBetter: boolean
}

export interface ArenaAgentLeaderboard {
  syncedAt: number
  date: string
  fetchedAt: string
  lastUpdated?: string
  signalsVersion: string
  totalSessions?: number
  sourceUrl: string
  modelCount: number
  labs: ArenaAgentLabEntry[]
  signalLeaders: AgentSignalLeader[]
}

export type AgentSignalKey =
  | 'netImprovement'
  | 'confirmedSuccess'
  | 'praiseVsComplaint'
  | 'steerability'
  | 'bashRecovery'
  | 'toolHallucination'

export const AGENT_SIGNAL_LABELS: Record<AgentSignalKey, { label: string; short: string; higherIsBetter: boolean }> = {
  netImprovement: { label: 'Net Improvement', short: '综合提升', higherIsBetter: true },
  confirmedSuccess: { label: 'Confirmed Success', short: '任务确认成功', higherIsBetter: true },
  praiseVsComplaint: { label: 'Praise vs Complaint', short: '正负反馈比', higherIsBetter: true },
  steerability: { label: 'Steerability', short: '可 steer 性', higherIsBetter: true },
  bashRecovery: { label: 'Bash Recovery', short: '终端恢复', higherIsBetter: true },
  toolHallucination: { label: 'Tool Hallucination', short: '工具幻觉', higherIsBetter: false },
}

type BundledSignalRow = {
  model: string
  vendor: string
  netImprovement: AgentSignalMetric
  confirmedSuccess: AgentSignalMetric
  praiseVsComplaint: AgentSignalMetric
  steerability: AgentSignalMetric
  bashRecovery: AgentSignalMetric
  toolHallucination: AgentSignalMetric
}

const SIGNALS_BY_MODEL = new Map<string, BundledSignalRow>(
  (bundledSignals.models as BundledSignalRow[]).map((row) => [normalizeModelName(row.model), row])
)

function readCache(): ArenaAgentLeaderboard | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ArenaAgentLeaderboard
  } catch {
    return null
  }
}

function writeCache(cache: ArenaAgentLeaderboard): void {
  try {
    localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache))
  } catch {
    /* ignore quota */
  }
}

async function fetchJson(url: string, timeoutMs = 25_000): Promise<unknown> {
  const result = await window.api.fetchUrl(
    url,
    'GET',
    { Accept: 'application/json' },
    undefined,
    { timeoutMs }
  )
  if (!result.success) throw new Error(result.error || '请求失败')
  if (typeof result.data === 'string') {
    try {
      return JSON.parse(result.data)
    } catch {
      throw new Error('响应不是有效 JSON')
    }
  }
  return result.data
}

function normalizeModelName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function parseMetric(raw: unknown): AgentSignalMetric | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const value = Number(row.value)
  if (!Number.isFinite(value)) return null
  const ciRaw = row.ci
  const ci = ciRaw == null ? null : Number(ciRaw)
  return { value, ci: Number.isFinite(ci) ? ci : null }
}

function metricFromRemote(row: Record<string, unknown>, keys: string[]): AgentSignalMetric | null {
  for (const key of keys) {
    const parsed = parseMetric(row[key])
    if (parsed) return parsed
  }
  return null
}

function emptyMetric(): AgentSignalMetric {
  return { value: 0, ci: null }
}

function resolveModelSignals(
  model: string,
  vendor: string,
  remote?: Record<string, unknown>
): Omit<ArenaAgentModelEntry, 'rank' | 'sessions' | 'license'> {
  const bundled = SIGNALS_BY_MODEL.get(normalizeModelName(model))
  const pick = (key: AgentSignalKey, remoteKeys: string[]): AgentSignalMetric => {
    const fromRemote = remote ? metricFromRemote(remote, remoteKeys) : null
    if (fromRemote) return fromRemote
    if (bundled?.[key]) return bundled[key]
    return emptyMetric()
  }

  return {
    model,
    vendor: vendor || bundled?.vendor || '—',
    netImprovement: pick('netImprovement', ['netImprovement', 'net_improvement']),
    confirmedSuccess: pick('confirmedSuccess', ['confirmedSuccess', 'confirmed_success']),
    praiseVsComplaint: pick('praiseVsComplaint', ['praiseVsComplaint', 'praise_vs_complaint']),
    steerability: pick('steerability', ['steerability']),
    bashRecovery: pick('bashRecovery', ['bashRecovery', 'bash_recovery']),
    toolHallucination: pick('toolHallucination', ['toolHallucination', 'tool_hallucination']),
  }
}

function parseAgentModels(payload: unknown): ArenaAgentModelEntry[] {
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const modelsRaw = Array.isArray(obj.models) ? obj.models : []
  return modelsRaw.map((item, index) => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const model = String(row.model || row.modelDisplayName || '—')
    const vendor = String(row.vendor || row.modelOrganization || '—').trim() || '—'
    const sessions =
      row.votes != null
        ? Number(row.votes)
        : row.sessions != null
          ? Number(row.sessions)
          : 0
    const signals = resolveModelSignals(model, vendor, row)
    return {
      rank: Number(row.rank ?? index + 1),
      license: row.license ? String(row.license) : undefined,
      sessions: Number.isFinite(sessions) ? sessions : 0,
      ...signals,
    }
  })
}

function weightedMetric(models: ArenaAgentModelEntry[], key: AgentSignalKey): AgentSignalMetric {
  const totalSessions = models.reduce((sum, m) => sum + Math.max(0, m.sessions), 0)
  if (totalSessions <= 0) return emptyMetric()
  let value = 0
  let ci = 0
  let ciWeight = 0
  for (const model of models) {
    const weight = Math.max(0, model.sessions)
    if (!weight) continue
    const metric = model[key]
    value += metric.value * weight
    if (metric.ci != null) {
      ci += metric.ci * weight
      ciWeight += weight
    }
  }
  return {
    value: value / totalSessions,
    ci: ciWeight > 0 ? ci / ciWeight : null,
  }
}

export function aggregateAgentLabs(models: ArenaAgentModelEntry[]): ArenaAgentLabEntry[] {
  const grouped = new Map<string, ArenaAgentModelEntry[]>()
  for (const model of models) {
    const lab = model.vendor || '—'
    const list = grouped.get(lab) || []
    list.push(model)
    grouped.set(lab, list)
  }

  const labs = [...grouped.entries()]
    .map(([lab, labModels]) => {
      const sorted = [...labModels].sort((a, b) => a.rank - b.rank)
      const top = sorted[0]
      const sessions = labModels.reduce((sum, m) => sum + m.sessions, 0)
      return {
        rank: 0,
        lab,
        topModel: top?.model || '—',
        modelCount: labModels.length,
        sessions,
        netImprovement: weightedMetric(labModels, 'netImprovement'),
        confirmedSuccess: weightedMetric(labModels, 'confirmedSuccess'),
        praiseVsComplaint: weightedMetric(labModels, 'praiseVsComplaint'),
        steerability: weightedMetric(labModels, 'steerability'),
        bashRecovery: weightedMetric(labModels, 'bashRecovery'),
        toolHallucination: weightedMetric(labModels, 'toolHallucination'),
        models: sorted,
      }
    })
    .sort((a, b) => b.netImprovement.value - a.netImprovement.value)

  return labs.map((lab, index) => ({ ...lab, rank: index + 1 }))
}

export function buildSignalLeaders(models: ArenaAgentModelEntry[]): AgentSignalLeader[] {
  const keys = Object.keys(AGENT_SIGNAL_LABELS) as AgentSignalKey[]
  return keys.map((signal) => {
    const meta = AGENT_SIGNAL_LABELS[signal]
    const sorted = [...models].sort((a, b) => {
      const av = a[signal].value
      const bv = b[signal].value
      return meta.higherIsBetter ? bv - av : av - bv
    })
    const best = sorted[0]
    return {
      signal,
      label: meta.short,
      lab: best?.vendor || '—',
      model: best?.model || '—',
      metric: best?.[signal] || emptyMetric(),
      higherIsBetter: meta.higherIsBetter,
    }
  })
}

export function formatAgentMetric(metric: AgentSignalMetric | null | undefined): string {
  if (!metric) return '—'
  const value = `${metric.value >= 0 ? '+' : ''}${metric.value.toFixed(2)}%`
  return metric.ci != null ? `${value} ±${metric.ci.toFixed(2)}%` : value
}

async function resolveLatestDate(): Promise<string> {
  const latest = (await fetchJson(GITHUB_LATEST_URL, 15_000)) as { date?: string; path?: string }
  const date = String(latest.date || latest.path || '').trim()
  if (!date) throw new Error('无法解析排行榜日期')
  return date
}

async function fetchRemoteAgentPayload(date: string): Promise<unknown> {
  try {
    return await fetchJson(WULONG_AGENT_URL, 12_000)
  } catch {
    return fetchJson(GITHUB_AGENT_URL(date))
  }
}

async function fetchAgentLeaderboard(date: string): Promise<ArenaAgentLeaderboard> {
  const payload = await fetchRemoteAgentPayload(date)
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const meta = (obj.meta && typeof obj.meta === 'object' ? obj.meta : {}) as Record<string, unknown>
  const models = parseAgentModels(payload)
  const labs = aggregateAgentLabs(models)

  return {
    syncedAt: Date.now(),
    date,
    fetchedAt: String(meta.fetched_at || new Date().toISOString()),
    lastUpdated: meta.last_updated ? String(meta.last_updated) : bundledSignals.version,
    signalsVersion: bundledSignals.version,
    totalSessions: bundledSignals.totalSessions,
    sourceUrl: AGENT_LABS_SOURCE_URL,
    modelCount: models.length,
    labs,
    signalLeaders: buildSignalLeaders(models),
  }
}

export function getCachedAgentLeaderboard(): ArenaAgentLeaderboard | null {
  return readCache()
}

export function isLeaderboardCacheStale(): boolean {
  const cache = readCache()
  if (!cache) return true
  return Date.now() - cache.syncedAt > CACHE_TTL_MS
}

export async function syncAgentLeaderboard(force = false): Promise<ArenaAgentLeaderboard> {
  const existing = readCache()
  if (!force && existing && Date.now() - existing.syncedAt <= CACHE_TTL_MS) {
    return existing
  }

  const date = await resolveLatestDate()
  const leaderboard = await fetchAgentLeaderboard(date)
  writeCache(leaderboard)
  return leaderboard
}

export async function getAgentLeaderboard(force = false): Promise<ArenaAgentLeaderboard> {
  if (!force && !isLeaderboardCacheStale()) {
    const cached = readCache()
    if (cached) return cached
  }
  return syncAgentLeaderboard(force)
}
