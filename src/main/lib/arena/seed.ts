import { randomUUID } from 'node:crypto'
import type { ArenaStore } from './store'
import type { Character } from '@shared/arena/types'
import {
  isLegacyCharacterName,
} from '@shared/arena/character-display-names'
import { DEFAULT_ARENA_MODEL_ID } from '@shared/arena/constants'
import {
  STARTER_CHARACTER_MODEL_IDS,
  type StarterCharacterModelId,
} from '@shared/arena/starter-characters'
import {
  STARTER_GAME_MODE_IDS,
  type StarterGameModeId,
} from '@shared/arena/starter-game-modes'
import { STARTER_SEED_CHARACTERS } from '@shared/init-data/starter-seed-characters'
import type { StarterSeedCharacter } from '@shared/init-data/types'
import { loadStarterCharacterData, loadStarterGameModeIds } from './init-data-loader'

type SeedCharacter = StarterSeedCharacter

const SEED_CHARACTERS = STARTER_SEED_CHARACTERS

function resolveDefaultModelId(store: ArenaStore): string {
  return store.getSettings().defaultModelId?.trim() || DEFAULT_ARENA_MODEL_ID
}

const DEFAULT_STATS = { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null }

const LEGACY_SEED_MODEL_IDS = new Set(SEED_CHARACTERS.map((seed) => seed.seedKey))

function shouldUseDefaultModel(store: ArenaStore, character: Character, seed: SeedCharacter): boolean {
  const id = character.modelId?.trim()
  if (!id) return true
  const defaultId = resolveDefaultModelId(store)
  if (id === defaultId) return false
  return LEGACY_SEED_MODEL_IDS.has(id) || id === seed.seedKey
}

function defaultBySeedKey(seedKey: string): SeedCharacter | undefined {
  return SEED_CHARACTERS.find((item) => item.seedKey === seedKey)
}

function hasMojibake(value: string): boolean {
  return /[�]|璞|鐞|闅|鍏|鎺|瑙|瀵|閫|锛|銆/.test(value)
}

function shouldSyncCharacter(character: Character, seed: SeedCharacter): boolean {
  return (
    !character.avatarUrl ||
    !character.portraitUrl ||
    character.avatarUrl === character.portraitUrl ||
    character.avatarUrl !== seed.avatarUrl ||
    character.portraitUrl !== seed.portraitUrl ||
    isLegacyCharacterName(seed.seedKey, character.name) ||
    hasMojibake(character.name + character.subtitle + character.bio + character.speechStyle)
  )
}

function saveSeedCharacter(store: ArenaStore, seed: SeedCharacter, now = new Date().toISOString()): void {
  store.saveCharacter({
    ...seed,
    modelId: resolveDefaultModelId(store),
    id: randomUUID(),
    stats: { ...DEFAULT_STATS },
    createdAt: now,
    updatedAt: now,
  })
  store.addIntroducedSeedKeys([seed.seedKey])
}

function matchesSeed(character: Character, seed: SeedCharacter): boolean {
  return (
    character.name === seed.name ||
    character.avatarUrl === seed.avatarUrl ||
    character.portraitUrl === seed.portraitUrl
  )
}

function pickSeedKeeper(group: Character[]): Character {
  const edited = group.filter(
    (c) => new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000
  )
  if (edited.length) {
    return edited.sort(
      (a, b) =>
        b.stats.matchCount - a.stats.matchCount ||
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )[0]
  }
  const used = group.filter((c) => c.stats.matchCount > 0)
  if (used.length) {
    return used.sort((a, b) => b.stats.matchCount - a.stats.matchCount)[0]
  }
  return group.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]
}

function dedupeSeedCharacterDuplicates(store: ArenaStore): number {
  const characters = store.listCharacters()
  const toDelete = new Set<string>()

  for (const seed of SEED_CHARACTERS) {
    const group = characters.filter((c) => matchesSeed(c, seed))
    if (group.length <= 1) continue
    const keeper = pickSeedKeeper(group)
    for (const c of group) {
      if (c.id !== keeper.id) toDelete.add(c.id)
    }
  }

  let removed = 0
  for (const id of toDelete) {
    if (store.deleteCharacter(id)) removed += 1
  }
  return removed
}

function migrateIntroducedSeedKeys(store: ArenaStore): void {
  if (store.getIntroducedSeedKeys().length > 0) return
  if (!store.isSeeded()) return

  const keys: string[] = []
  const characters = store.listCharacters()
  for (const seed of SEED_CHARACTERS) {
    if (characters.some((c) => matchesSeed(c, seed))) keys.push(seed.seedKey)
  }
  store.setIntroducedSeedKeys(keys)
}

export function seedDefaultCharacters(store: ArenaStore): void {
  if (!store.isSeeded()) {
    migrateLegacyInstalledGameModes(store)
    return
  }

  migrateLegacyInstalledGameModes(store)
  migrateIntroducedSeedKeys(store)
  const removed = dedupeSeedCharacterDuplicates(store)
  if (removed > 0) {
    store.appendLog({
      level: 'info',
      scope: 'storage',
      message: `已清理 ${removed} 个重复默认角色`,
    })
  }

  syncDefaultCharacterAssets(store)
  ensureStarterCharacters(store)
  ensureMissingSeedCharacters(store)
}

function ensureStarterCharacters(store: ArenaStore): void {
  if (!store.getStats().seededAt) return

  const now = new Date().toISOString()
  let added = 0
  for (const seedKey of STARTER_CHARACTER_MODEL_IDS) {
    const seed = defaultBySeedKey(seedKey)
    if (!seed) continue
    const existing = store.listCharacters().find((c) => c.name === seed.name)
    if (existing) continue
    saveSeedCharacter(store, seed, now)
    added += 1
  }
  if (added > 0) {
    store.appendLog({
      level: 'info',
      scope: 'storage',
      message: `已补全 ${added} 个入门角色`,
    })
  }
}

function ensureMissingSeedCharacters(store: ArenaStore): void {
  const now = new Date().toISOString()
  const introduced = new Set(store.getIntroducedSeedKeys())
  let added = 0
  for (const seed of SEED_CHARACTERS) {
    if (introduced.has(seed.seedKey)) continue
    saveSeedCharacter(store, seed, now)
    added += 1
  }
  if (added > 0) {
    store.appendLog({
      level: 'info',
      scope: 'storage',
      message: `已补全 ${added} 个默认 AI 角色`,
    })
  }
}

export function syncDefaultCharacterAssets(store: ArenaStore): void {
  for (const character of store.listCharacters()) {
    const seed =
      SEED_CHARACTERS.find((item) => matchesSeed(character, item)) ||
      defaultBySeedKey(character.modelId)
    if (!seed || !shouldSyncCharacter(character, seed)) continue

    store.saveCharacter({
      ...character,
      ...(shouldUseDefaultModel(store, character, seed)
        ? { modelId: resolveDefaultModelId(store) }
        : {}),
      name: isLegacyCharacterName(seed.seedKey, character.name) ? seed.name : character.name,
      subtitle: hasMojibake(character.subtitle) || !character.subtitle ? seed.subtitle : character.subtitle,
      avatarUrl: !character.avatarUrl || hasMojibake(character.avatarUrl) ? seed.avatarUrl : character.avatarUrl,
      portraitUrl: !character.portraitUrl || hasMojibake(character.portraitUrl) ? seed.portraitUrl : character.portraitUrl,
      bio: hasMojibake(character.bio) || !character.bio ? seed.bio : character.bio,
      tags: character.tags.length && !character.tags.some(hasMojibake) ? character.tags : seed.tags,
      commonPhrases: character.commonPhrases.length && !character.commonPhrases.some(hasMojibake) ? character.commonPhrases : seed.commonPhrases,
      behaviorPrinciples:
        character.behaviorPrinciples.length && !character.behaviorPrinciples.some(hasMojibake)
          ? character.behaviorPrinciples
          : seed.behaviorPrinciples,
      tabooBehaviors:
        character.tabooBehaviors.length && !character.tabooBehaviors.some(hasMojibake)
          ? character.tabooBehaviors
          : seed.tabooBehaviors,
      gameModePreferences: character.gameModePreferences.length ? character.gameModePreferences : seed.gameModePreferences,
      roleStrategies: character.roleStrategies.length ? character.roleStrategies : seed.roleStrategies,
      accentColor: character.accentColor || seed.accentColor,
    })
  }
}

export function seedStarterByModelId(store: ArenaStore, modelId: string): Character {
  const key = modelId.trim() as StarterCharacterModelId
  if (!STARTER_CHARACTER_MODEL_IDS.includes(key)) {
    throw new Error('非入门角色')
  }

  const seed = defaultBySeedKey(key)
  if (!seed) throw new Error('角色模板不存在')

  const existing = store.listCharacters().find((c) => c.name === seed.name)
  if (existing) return existing

  saveSeedCharacter(store, seed)
  const created = store.listCharacters().find((c) => c.name === seed.name)
  if (!created) throw new Error('角色创建失败')
  return created
}

export function seedStarterGameMode(store: ArenaStore, modeId: string): void {
  const key = modeId.trim() as StarterGameModeId
  if (!STARTER_GAME_MODE_IDS.includes(key)) {
    throw new Error('非入门玩法')
  }
  store.installGameMode(key)
}

/** 批量导入入门初始化数据（从已安装素材包的 data-packs 读取，与 zip 内容一致） */
export function importStarterInitBundle(
  store: ArenaStore,
  appId: string
): { characters: number; gameModes: number; seedKeys: string[] } {
  const characterSeeds = loadStarterCharacterData(appId)
  const gameModeIds = loadStarterGameModeIds(appId)

  let characters = 0
  const seedKeys: string[] = []
  for (const seed of characterSeeds) {
    seedKeys.push(seed.seedKey)
    const existing = store.listCharacters().find((c) => c.name === seed.name)
    if (existing) continue
    saveSeedCharacter(store, seed)
    characters += 1
  }

  let gameModes = 0
  for (const modeId of gameModeIds) {
    if (store.getInstalledGameModeIds().includes(modeId)) continue
    store.installGameMode(modeId)
    gameModes += 1
  }

  return { characters, gameModes, seedKeys }
}

/** 旧数据：已初始化但未记录 installedGameModeIds 时补全默认玩法 */
function migrateLegacyInstalledGameModes(store: ArenaStore): void {
  if (!store.getStats().seededAt) return
  if (store.getInstalledGameModeIds().length > 0) return
  for (const modeId of STARTER_GAME_MODE_IDS) {
    store.installGameMode(modeId)
  }
}

/** 入门初始化完成：标记已播种，并阻止后续自动补全其余默认角色 */
export function finalizeStarterInit(store: ArenaStore, introducedSeedKeys?: string[]): void {
  const keys = introducedSeedKeys?.length
    ? introducedSeedKeys
    : SEED_CHARACTERS.map((seed) => seed.seedKey)
  store.addIntroducedSeedKeys(keys)
  store.markSeeded()
  store.appendLog({
    level: 'info',
    scope: 'storage',
    message: '已完成入门数据初始化（角色与玩法）',
  })
}

export type UserProfileCharacterInput = {
  displayName: string
  speechStyle?: string
  gender?: 'female' | 'male' | 'other'
  bio?: string
}

/** 创建用户 AI 分身（全局唯一，初始化后调用） */
export function createUserProfileCharacter(store: ArenaStore, input: UserProfileCharacterInput): Character {
  const existingId = store.getUserProfileCharacterId()
  if (existingId) {
    const existing = store.getCharacter(existingId)
    if (existing) return existing
  }

  const name = input.displayName.trim() || '我的分身'
  const speechStyle = input.speechStyle?.trim() || '理性'
  const gender = input.gender || 'other'
  const now = new Date().toISOString()

  const character: Character = {
    name,
    subtitle: '你的 AI 分身 · 可替你参与对局',
    modelId: resolveDefaultModelId(store),
    avatarUrl: 'asset://avatar/default',
    portraitUrl: 'asset://portrait/default',
    gender,
    ageLabel: '—',
    bio: input.bio?.trim() || `这是 ${name} 的 AI 分身，会按你的风格参与狼人杀与圆桌讨论；你也可以随时亲自接管发言。`,
    tags: ['用户分身', '可接管', speechStyle],
    speechStyle,
    commonPhrases: ['让我想想…', '这局我有自己的判断。'],
    behaviorPrinciples: ['尊重发言顺序', '先听完全场再下结论'],
    tabooBehaviors: ['无依据指控', '泄露隐藏身份'],
    strategy: { empathyVsLogic: 55, cautiousVsBold: 50, leadVsFollow: 55 },
    strengths: ['真人可接管', '灵活表达'],
    weaknesses: [],
    roleStrategies: [],
    gameSkills: [],
    status: 'enabled',
    accentColor: '#7c5cff',
    isUserProfile: true,
    visualPackId: 'default',
    id: randomUUID(),
    stats: { ...DEFAULT_STATS },
    createdAt: now,
    updatedAt: now,
  }

  store.saveCharacter(character)
  store.setUserProfileCharacterId(character.id)
  store.appendLog({
    level: 'info',
    scope: 'character',
    message: `已创建用户 AI 分身「${name}」`,
  })
  return character
}
