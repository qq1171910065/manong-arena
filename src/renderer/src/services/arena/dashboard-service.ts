import { billingService } from './billing-service'
import { characterService, gameModeService } from './character-service'
import { matchService } from './match-service'
import type { DashboardSummary } from '@shared/arena/types'

export const dashboardService = {
  async load(): Promise<DashboardSummary> {
    const [characters, recentMatches, resumableMatch, walletBalanceCents] = await Promise.all([
      characterService.list({ status: 'enabled', sort: 'updated' }),
      matchService.listRecent(5),
      matchService.findResumable(),
      billingService.getBalanceCents(),
    ])

    const recentCostCents = recentMatches.reduce((sum, m) => sum + m.totalCostCents, 0)

    return {
      characters: characters.slice(0, 6),
      recentMatches,
      resumableMatch,
      gameModes: gameModeService.list(),
      walletBalanceCents,
      recentCostCents,
    }
  },
}
