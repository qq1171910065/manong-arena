import { billingService } from './billing-service'
import { arenaInvoke } from './client'
import { characterService } from './character-service'
import { matchService } from './match-service'
import type { DashboardSummary } from '@shared/arena/types'

export const dashboardService = {
  async load(): Promise<DashboardSummary> {
    const allCharacters = await characterService.list({ sort: 'updated' })
    const [recentMatches, resumableMatch, walletBalanceCents, behaviorChanges, growthGroups, snapshotGroups] =
      await Promise.all([
        matchService.listRecent(30),
        matchService.findResumable(),
        billingService.getBalanceCents(),
        arenaInvoke('storage', 'listBehaviorChanges', () => window.api.listBehaviorChanges()),
        Promise.all(
          allCharacters.map((character) =>
            arenaInvoke('storage', 'listCharacterGrowth', () => window.api.listCharacterGrowth(character.id))
          )
        ),
        Promise.all(
          allCharacters.map((character) =>
            arenaInvoke('storage', 'listCharacterGrowthSnapshots', () =>
              window.api.listCharacterGrowthSnapshots(character.id)
            )
          )
        ),
      ])

    const recentCostCents = recentMatches.reduce((sum, m) => sum + m.totalCostCents, 0)

    return {
      characters: allCharacters.filter((c) => c.status === 'enabled').slice(0, 6),
      allCharacters,
      recentMatches,
      resumableMatch,
      walletBalanceCents,
      recentCostCents,
      behaviorChanges,
      growthRecords: growthGroups.flat(),
      growthSnapshots: snapshotGroups.flat(),
    }
  },
}
