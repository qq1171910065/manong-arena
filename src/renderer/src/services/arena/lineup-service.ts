import { randomUUID } from '@renderer/utils/id'
import { LINEUP_MAX_SIZE } from '@shared/arena/character-growth'
import { arenaInvoke, ensureArenaReady } from './client'
import { ArenaError } from './errors'
import type { CharacterLineup, LineupGrowthRecord, Match } from '@shared/arena/types'

function defaultLineupStats() {
  return { matchCount: 0, winCount: 0, lastMatchAt: null as string | null }
}

export const lineupService = {
  async list(): Promise<CharacterLineup[]> {
    await ensureArenaReady()
    return arenaInvoke('character', 'listLineups', () => window.api.listLineups())
  },

  async getActiveId(): Promise<string | null> {
    await ensureArenaReady()
    return arenaInvoke('character', 'getActiveLineupId', () => window.api.getActiveLineupId())
  },

  async setActiveId(id: string | null): Promise<string | null> {
    await ensureArenaReady()
    return arenaInvoke('character', 'setActiveLineupId', () => window.api.setActiveLineupId(id))
  },

  async save(input: Partial<CharacterLineup> & { name: string; characterIds: string[] }): Promise<CharacterLineup> {
    if (!input.name.trim()) throw new ArenaError('VALIDATION', '阵容名称不能为空', 'character')
    const ids = [...new Set(input.characterIds.filter(Boolean))].slice(0, LINEUP_MAX_SIZE)
    const now = new Date().toISOString()
    const lineup: CharacterLineup = {
      id: input.id || randomUUID(),
      name: input.name.trim(),
      characterIds: ids,
      createdAt: input.createdAt || now,
      updatedAt: now,
      stats: input.stats || defaultLineupStats(),
    }
    await ensureArenaReady()
    return arenaInvoke('character', 'saveLineup', () => window.api.saveLineup(lineup))
  },

  async remove(id: string): Promise<boolean> {
    await ensureArenaReady()
    return arenaInvoke('character', 'deleteLineup', () => window.api.deleteLineup(id))
  },

  async ensureDefault(): Promise<CharacterLineup> {
    const items = await this.list()
    if (items.length) return items[0]
    return this.save({ name: '我的阵容', characterIds: [] })
  },

  async listGrowth(lineupId: string): Promise<LineupGrowthRecord[]> {
    await ensureArenaReady()
    return arenaInvoke('character', 'listLineupGrowth', () => window.api.listLineupGrowth(lineupId))
  },

  async applyMatchResult(match: Match): Promise<void> {
    if (match.status !== 'completed') return
    const lineups = await this.list()
    if (!lineups.length) return

    const participantIds = new Set(match.participantIds)
    const now = match.endedAt || new Date().toISOString()

    for (const lineup of lineups) {
      if (!lineup.characterIds.length) continue
      const allPresent = lineup.characterIds.every((id) => participantIds.has(id))
      if (!allPresent) continue

      const winners = match.participants.filter(
        (item) => lineup.characterIds.includes(item.characterId) && item.roleCamp && item.roleCamp === match.winnerCamp
      )
      const won = Boolean(match.winnerCamp && winners.length > 0)

      lineup.stats.matchCount += 1
      if (won) lineup.stats.winCount += 1
      lineup.stats.lastMatchAt = now
      await this.save(lineup)

      const record: LineupGrowthRecord = {
        id: randomUUID(),
        lineupId: lineup.id,
        matchId: match.id,
        createdAt: now,
        summary: won
          ? `阵容全员参战 · ${match.gameModeName} · 有成员随胜方阵营获胜`
          : `阵容全员参战 · ${match.gameModeName} · 已记录`,
        won,
        participantCount: match.participants.length,
        gameModeName: match.gameModeName,
      }
      await ensureArenaReady()
      await arenaInvoke('character', 'appendLineupGrowth', () => window.api.appendLineupGrowth(record))
    }
  },
}
