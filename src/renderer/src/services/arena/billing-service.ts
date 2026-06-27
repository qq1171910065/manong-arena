import { portalApi } from '../portal-api'
import { arenaLog } from './logger'
import { gatewayPricingService } from '../gateway-pricing'

let cachedBalanceCents: number | null = null
let cachedAt = 0
const CACHE_MS = 15_000

export const billingService = {
  async getBalanceCents(force = false): Promise<number | null> {
    const now = Date.now()
    if (!force && cachedBalanceCents !== null && now - cachedAt < CACHE_MS) {
      return cachedBalanceCents
    }
    try {
      const wallet = await portalApi.wallet()
      const cents = Math.round(Number(wallet.balanceYuan || wallet.remainYuan || 0) * 100)
      cachedBalanceCents = Number.isFinite(cents) ? cents : 0
      cachedAt = now
      return cachedBalanceCents
    } catch (error) {
      await arenaLog('warn', 'billing', '获取钱包余额失败', String(error))
      return cachedBalanceCents
    }
  },

  invalidateCache(): void {
    cachedBalanceCents = null
    cachedAt = 0
    gatewayPricingService.invalidate()
  },

  /** 按网关定价表 + 实际 token 估算费用（与 New API 计费公式一致） */
  async estimateCallCostCents(
    modelId: string,
    usage?: { prompt_tokens?: number; completion_tokens?: number },
    fallback?: { promptChars?: number; completionChars?: number }
  ): Promise<number> {
    return gatewayPricingService.estimateCostCents(modelId, usage, fallback)
  },

  formatBalance(cents: number | null): string {
    if (cents === null) return '--'
    return `¥${(cents / 100).toFixed(2)}`
  },
}
