import { randomUUID } from '@renderer/utils/id'
import { BUILTIN_GAME_MODES, DEFAULT_ARENA_MODEL_ID } from '@shared/arena/constants'
import { isUserGameModeId } from '@shared/arena/export-packages'
import { buildPackVisualPatch, normalizeCharacterVisuals } from '@shared/arena/character-visuals'
import { resolveTtsVoiceId } from '@shared/arena/voice-presets'
import { createDefaultGrowthState, resolveCharacterGrowth } from '@shared/arena/character-growth'
import { arenaInvoke, ensureArenaReady } from './client'
import { estimateMatchCost } from './match-cost-estimator'
import { ArenaError } from './errors'
import type { Character, CharacterFilter, CreateMatchInput, GameMode, GameModeOverride } from '@shared/arena/types'

let gameModeOverrides: Record<string, GameModeOverride> = {}
let customGameModes: GameMode[] = []
let installedGameModeIds: string[] = []
let storeSeededAt: string | null = null

function mergeGameMode(mode: GameMode): GameMode {
  const override = gameModeOverrides[mode.id]
  if (!override) return structuredClone(mode)
  return { ...structuredClone(mode), ...override }
}

export async function loadGameModeOverrides(): Promise<void> {
  await ensureArenaReady()
  const [overrides, stats, customModes] = await Promise.all([
    arenaInvoke('storage', 'getGameModeOverrides', () => window.api.getGameModeOverrides()),
    arenaInvoke('storage', 'getStoreStats', () => window.api.getStoreStats()),
    arenaInvoke('storage', 'listCustomGameModes', () => window.api.listCustomGameModes()),
  ])
  gameModeOverrides = overrides
  customGameModes = customModes
  storeSeededAt = stats.seededAt
  installedGameModeIds = [...stats.installedGameModeIds]
}

function listInstalledBuiltinModes(): GameMode[] {
  if (!storeSeededAt || installedGameModeIds.length === 0) return []
  const allowed = new Set(installedGameModeIds)
  return BUILTIN_GAME_MODES.filter((mode) => allowed.has(mode.id)).map(mergeGameMode)
}

function listInstalledCustomModes(): GameMode[] {
  return customGameModes.filter((mode) => installedGameModeIds.includes(mode.id)).map(mergeGameMode)
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
    case 'level':
      return next.sort(
        (a, b) => resolveCharacterGrowth(b).level - resolveCharacterGrowth(a).level ||
          resolveCharacterGrowth(b).totalExp - resolveCharacterGrowth(a).totalExp
      )
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
  const visualDefaults = buildPackVisualPatch('doubao', '#6366f1')
  const speechStyle = partial?.speechStyle || '温柔'
  const gender = partial?.gender || 'female'
  return normalizeCharacterVisuals({
    id: randomUUID(),
    name: '新角色',
    subtitle: '一句话设定',
    modelId: partial?.modelId || DEFAULT_ARENA_MODEL_ID,
    gender,
    ageLabel: '18岁',
    bio: '',
    tags: [],
    speechStyle,
    ttsVoiceId: partial?.ttsVoiceId || resolveTtsVoiceId({ speechStyle, gender }),
    ttsOpeningStyleTags: partial?.ttsOpeningStyleTags || [],
    ttsAutoStyleTags: partial?.ttsAutoStyleTags ?? true,
    ttsAutoStyleInstruction: partial?.ttsAutoStyleInstruction ?? true,
    commonPhrases: [],
    behaviorPrinciples: [],
    tabooBehaviors: [],
    strategy: { empathyVsLogic: 50, cautiousVsBold: 50, leadVsFollow: 50 },
    strengths: [],
    weaknesses: [],
    gameModePreferences: [],
    roleStrategies: [],
    gameSkills: [],
    status: 'enabled',
    accentColor: '#6366f1',
    stats: { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null },
    growth: createDefaultGrowthState(),
    createdAt: now,
    updatedAt: now,
    ...visualDefaults,
    ...partial,
  }) as Character
}

export const characterService = {
  async list(filter?: CharacterFilter): Promise<Character[]> {
    await ensureArenaReady()
    const items = await arenaInvoke('character', 'listCharacters', () => window.api.listCharacters())
    return filterCharacters(items, filter)
  },

  async get(id: string): Promise<Character> {
    await ensureArenaReady()
    const character = await arenaInvoke('character', 'getCharacter', () => window.api.getCharacter(id))
    return normalizeCharacterVisuals(character)
  },

  async save(character: Character): Promise<Character> {
    if (!character.name.trim()) throw new ArenaError('VALIDATION', '角色名称不能为空', 'character')
    await ensureArenaReady()
    const plain = toPlainCharacter(normalizeCharacterVisuals(character))
    const saved = await arenaInvoke('character', 'saveCharacter', () => window.api.saveCharacter(plain))
    return normalizeCharacterVisuals(saved)
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
    return [...listInstalledBuiltinModes(), ...listInstalledCustomModes()]
  },

  get(id: string): GameMode | undefined {
    const custom = customGameModes.find((mode) => mode.id === id)
    if (custom) return mergeGameMode(custom)
    if (!storeSeededAt || !installedGameModeIds.includes(id)) return undefined
    const base = BUILTIN_GAME_MODES.find((m) => m.id === id)
    return base ? mergeGameMode(base) : undefined
  },

  isCustom(modeId: string): boolean {
    return isUserGameModeId(modeId) || customGameModes.some((mode) => mode.id === modeId)
  },

  estimateCost(modeId: string, playerCount: number): number {
    return estimateMatchCost(modeId, playerCount).totalCents
  },

  estimateCostDetail(modeId: string, playerCount: number) {
    return estimateMatchCost(modeId, playerCount)
  },

  async saveOverride(modeId: string, override: GameModeOverride): Promise<GameMode> {
    await ensureArenaReady()
    gameModeOverrides = await arenaInvoke('storage', 'saveGameModeOverride', () =>
      window.api.saveGameModeOverride(modeId, override)
    )
    const base = BUILTIN_GAME_MODES.find((m) => m.id === modeId) || customGameModes.find((m) => m.id === modeId)
    if (!base) throw new ArenaError('NOT_FOUND', '玩法不存在', 'match')
    return mergeGameMode(base)
  },

  async clearOverride(modeId: string): Promise<GameMode> {
    await ensureArenaReady()
    gameModeOverrides = await arenaInvoke('storage', 'clearGameModeOverride', () =>
      window.api.clearGameModeOverride(modeId)
    )
    const base = BUILTIN_GAME_MODES.find((m) => m.id === modeId) || customGameModes.find((m) => m.id === modeId)
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
