import { portalApi } from './portal-api'

/** 与 Platform server/src/comm/gateway-quota.ts 保持一致 */
export const DEFAULT_QUOTA_PER_YUAN = 500_000

export interface GatewayPricingRow {
  id: string
  modelRatio?: number
  completionRatio?: number
  modelPrice?: number
  quotaType?: number
}

interface PricingSnapshot {
  expires: number
  quotaPerYuan: number
  rows: GatewayPricingRow[]
}

let cache: PricingSnapshot | null = null
const CACHE_MS = 5 * 60_000

function calcQuotaFromTokens(
  row: GatewayPricingRow | null | undefined,
  promptTokens: number,
  completionTokens: number,
  groupRatio = 1
): number {
  const prompt = Math.max(0, Math.floor(Number(promptTokens) || 0))
  const completion = Math.max(0, Math.floor(Number(completionTokens) || 0))
  const group = Number(groupRatio) > 0 ? Number(groupRatio) : 1

  if (row?.modelPrice && row.modelPrice > 0 && row.quotaType === 1) {
    return Math.max(1, Math.round(row.modelPrice * DEFAULT_QUOTA_PER_YUAN * group))
  }

  const modelRatio = row?.modelRatio && row.modelRatio > 0 ? row.modelRatio : 1
  const completionRatio = row?.completionRatio && row.completionRatio > 0 ? row.completionRatio : 1
  const weighted = prompt + completion * completionRatio
  const quota = Math.round(weighted * modelRatio * group)
  if (modelRatio > 0 && weighted > 0 && quota <= 0) return 1
  return Math.max(0, quota)
}

function quotaToYuan(quota: number, quotaPerYuan: number): number {
  const q = Number(quota)
  const rate = Number(quotaPerYuan) || DEFAULT_QUOTA_PER_YUAN
  if (!Number.isFinite(q) || q <= 0 || rate <= 0) return 0
  return Number((q / rate).toFixed(6))
}

function findPricingRow(rows: GatewayPricingRow[], modelName: string): GatewayPricingRow | null {
  const target = String(modelName || '').trim().toLowerCase()
  if (!target) return null
  const exact = rows.find((row) => row.id.toLowerCase() === target)
  if (exact) return exact
  return rows.find((row) => target.includes(row.id.toLowerCase())) ?? null
}

async function loadSnapshot(force = false): Promise<PricingSnapshot> {
  const now = Date.now()
  if (!force && cache && cache.expires > now) return cache

  const catalog = await portalApi.gatewayModels()
  const snapshot: PricingSnapshot = {
    expires: now + CACHE_MS,
    quotaPerYuan: Number(catalog.quotaPerYuan) || DEFAULT_QUOTA_PER_YUAN,
    rows: (catalog.models || []).map((item) => ({
      id: item.id,
      modelRatio: item.modelRatio,
      completionRatio: item.completionRatio,
      modelPrice: item.modelPrice,
      quotaType: item.quotaType,
    })),
  }
  cache = snapshot
  return snapshot
}

export const gatewayPricingService = {
  invalidate() {
    cache = null
  },

  async refresh(force = false) {
    return loadSnapshot(force)
  },

  async estimateCostYuan(
    modelId: string,
    usage?: { prompt_tokens?: number; completion_tokens?: number },
    fallback?: { promptChars?: number; completionChars?: number }
  ): Promise<number> {
    let prompt = usage?.prompt_tokens || 0
    let completion = usage?.completion_tokens || 0
    if (!prompt && !completion && fallback) {
      prompt = Math.ceil((fallback.promptChars || 0) / 2.5)
      completion = Math.ceil((fallback.completionChars || 0) / 2.5)
    }
    if (!prompt && !completion) return 0

    try {
      const { quotaPerYuan, rows } = await loadSnapshot()
      const row = findPricingRow(rows, modelId)
      const quota = calcQuotaFromTokens(row, prompt, completion)
      return quotaToYuan(quota, quotaPerYuan)
    } catch {
      return 0
    }
  },

  async estimateCostCents(
    modelId: string,
    usage?: { prompt_tokens?: number; completion_tokens?: number },
    fallback?: { promptChars?: number; completionChars?: number }
  ): Promise<number> {
    const yuan = await this.estimateCostYuan(modelId, usage, fallback)
    if (yuan > 0) return Math.max(1, Math.round(yuan * 100))
    const total =
      (usage?.prompt_tokens || 0) +
      (usage?.completion_tokens || 0) +
      Math.ceil(((fallback?.promptChars || 0) + (fallback?.completionChars || 0)) / 2.5)
    if (total <= 0) return 0
    return 1
  },
}
