import { portalApi } from '../portal-api'
import { arenaLog } from './logger'

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
  },

  estimateCallCostCents(
    usage?: { prompt_tokens?: number; completion_tokens?: number },
    fallback?: { promptChars?: number; completionChars?: number }
  ): number {
    let prompt = usage?.prompt_tokens || 0
    let completion = usage?.completion_tokens || 0
    if (!prompt && !completion && fallback) {
      prompt = Math.ceil((fallback.promptChars || 0) / 2.5)
      completion = Math.ceil((fallback.completionChars || 0) / 2.5)
    }
    const totalTokens = prompt + completion
    if (totalTokens <= 0) return 1
    return Math.max(1, Math.round(totalTokens * 0.02))
  },

  formatBalance(cents: number | null): string {
    if (cents === null) return '--'
    return `¥${(cents / 100).toFixed(2)}`
  },
}
