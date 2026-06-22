import { randomUUID } from '@renderer/utils/id'
import { BUILTIN_GAME_MODES } from '@shared/arena/constants'
import { arenaInvoke, ensureArenaReady } from './client'
import { ArenaError } from './errors'
import type { Character, CharacterFilter, CreateMatchInput, GameMode, GameModeOverride } from '@shared/arena/types'

let gameModeOverrides: Record<string, GameModeOverride> = {}

function mergeGameMode(mode: GameMode): GameMode {
  const override = gameModeOverrides[mode.id]
  if (!override) return structuredClone(mode)
  return { ...structuredClone(mode), ...override }
}

export async function loadGameModeOverrides(): Promise<void> {
  await ensureArenaReady()
  gameModeOverrides = await arenaInvoke('storage', 'getGameModeOverrides', () => window.api.getGameModeOverrides())
}

export function getBuiltinGameMode(id: string): GameMode | undefined {
  const base = BUILTIN_GAME_MODES.find((m) => m.id === id)
  return base ? structuredClone(base) : undefined
}

function sortCharacters(items: Character[], sort: CharacterFilter['sort']): Character[] {
  const next = [...items]
  switch (sort) {
    case 'name':
      return next.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    case 'created':
      return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'matches':
      return next.sort((a, b) => b.stats.matchCount - a.stats.matchCount)
    case 'updated':
    default:
      return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
}

function toPlainCharacter(character: Character): Character {
  return JSON.parse(JSON.stringify(character)) as Character
}

function filterCharacters(items: Character[], filter: CharacterFilter = {}): Character[] {
  let next = items
  const query = filter.query?.trim().toLowerCase()
  if (query) {
    next = next.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.subtitle.toLowerCase().includes(query) ||
        c.tags.some((t) => t.toLowerCase().includes(query))
    )
  }
  if (filter.modelId && filter.modelId !== 'all') {
    next = next.filter((c) => c.modelId === filter.modelId)
  }
  if (filter.status && filter.status !== 'all') {
    next = next.filter((c) => c.status === filter.status)
  }
  if (filter.tag) {
    next = next.filter((c) => c.tags.includes(filter.tag!))
  }
  return sortCharacters(next, filter.sort)
}

export function createEmptyCharacter(partial?: Partial<Character>): Character {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    name: '新角色',
    subtitle: '一句话设定',
    modelId: 'doubao',
    avatarUrl: 'asset://avatar/doubao',
    portraitUrl: 'asset://portrait/doubao',
    gender: 'female',
    ageLabel: '18岁',
    bio: '',
    tags: [],
    speechStyle: '温柔',
    commonPhrases: [],
    behaviorPrinciples: [],
    tabooBehaviors: [],
    strategy: { empathyVsLogic: 50, cautiousVsBold: 50, leadVsFollow: 50 },
    strengths: [],
    weaknesses: [],
    gameModePreferences: [],
    roleStrategies: [],
    status: 'enabled',
    accentColor: '#6366f1',
    stats: { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null },
    createdAt: now,
    updatedAt: now,
    ...partial,
  }
}

export const characterService = {
  async list(filter?: CharacterFilter): Promise<Character[]> {
    await ensureArenaReady()
    const items = await arenaInvoke('character', 'listCharacters', () => window.api.listCharacters())
    return filterCharacters(items, filter)
  },

  async get(id: string): Promise<Character> {
    await ensureArenaReady()
    return arenaInvoke('character', 'getCharacter', () => window.api.getCharacter(id))
  },

  async save(character: Character): Promise<Character> {
    if (!character.name.trim()) throw new ArenaError('VALIDATION', '角色名称不能为空', 'character')
    await ensureArenaReady()
    const plain = toPlainCharacter(character)
    return arenaInvoke('character', 'saveCharacter', () => window.api.saveCharacter(plain))
  },

  async remove(id: string): Promise<void> {
    await ensureArenaReady()
    await arenaInvoke('character', 'deleteCharacter', () => window.api.deleteCharacter(id))
  },

  async duplicate(id: string): Promise<Character> {
    await ensureArenaReady()
    return arenaInvoke('character', 'duplicateCharacter', () => window.api.duplicateCharacter(id))
  },

  async toggleStatus(id: string): Promise<Character> {
    const character = await this.get(id)
    character.status = character.status === 'enabled' ? 'disabled' : 'enabled'
    return this.save(character)
  },
}

export const gameModeService = {
  list(): GameMode[] {
    return BUILTIN_GAME_MODES.map(mergeGameMode)
  },

  get(id: string): GameMode | undefined {
    const base = BUILTIN_GAME_MODES.find((m) => m.id === id)
    return base ? mergeGameMode(base) : undefined
  },

  estimateCost(modeId: string, playerCount: number): number {
    const mode = this.get(modeId)
    if (!mode) return 0
    return mode.estimatedCostPerPlayerCents * playerCount
  },

  async saveOverride(modeId: string, override: GameModeOverride): Promise<GameMode> {
    await ensureArenaReady()
    gameModeOverrides = await arenaInvoke('storage', 'saveGameModeOverride', () =>
      window.api.saveGameModeOverride(modeId, override)
    )
    const base = BUILTIN_GAME_MODES.find((m) => m.id === modeId)
    if (!base) throw new ArenaError('NOT_FOUND', '玩法不存在', 'match')
    return mergeGameMode(base)
  },

  async clearOverride(modeId: string): Promise<GameMode> {
    await ensureArenaReady()
    gameModeOverrides = await arenaInvoke('storage', 'clearGameModeOverride', () =>
      window.api.clearGameModeOverride(modeId)
    )
    const base = BUILTIN_GAME_MODES.find((m) => m.id === modeId)
    if (!base) throw new ArenaError('NOT_FOUND', '玩法不存在', 'match')
    return structuredClone(base)
  },

  hasOverride(modeId: string): boolean {
    return Boolean(gameModeOverrides[modeId] && Object.keys(gameModeOverrides[modeId]!).length > 0)
  },
}

export function buildMatchTitle(mode: GameMode, participantCount: number): string {
  return `${mode.name} · ${participantCount} 人局`
}

export function validateCreateMatchInput(input: CreateMatchInput): void {
  const mode = gameModeService.get(input.gameModeId)
  if (!mode) throw new ArenaError('VALIDATION', '玩法不存在', 'match')
  if (input.characterIds.length < mode.minPlayers) {
    throw new ArenaError('VALIDATION', `至少需要 ${mode.minPlayers} 名角色`, 'match')
  }
  if (input.characterIds.length > mode.maxPlayers) {
    throw new ArenaError('VALIDATION', `最多支持 ${mode.maxPlayers} 名角色`, 'match')
  }
}
