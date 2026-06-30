import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { getArenaStoreDir } from '../app-home'
import {
  ARENA_LOG_MAX,
  ARENA_STORE_KEY,
  ARENA_STORE_VERSION,
  DEFAULT_ARENA_SETTINGS,
} from '@shared/arena/constants'
import type {
  ArenaLogEntry,
  ArenaResult,
  ArenaSettings,
  ArenaStoreData,
  BehaviorChangeRecord,
  Character,
  CharacterChatMessage,
  CharacterGameSkill,
  CharacterGrowthRecord,
  CharacterGrowthSnapshot,
  CharacterLineup,
  LineupGrowthRecord,
  GameMode,
  GameModeOverride,
  Match,
  MatchSnapshot,
  ArenaStoreStats,
} from '@shared/arena/types'
import type { GameScenarioDefinition, PromptPack } from '@shared/arena/game-scenario'
import {
  createDefaultGrowthState,
  growthStateFromTotalExp,
  retroactiveTotalExp,
} from '@shared/arena/character-growth'

function migrateCharacter(character: Character): Character {
  const next = { ...character }
  if (!next.gameSkills) {
    next.gameSkills = (next.gameModePreferences || []).map(
      (pref): CharacterGameSkill => ({
        scenarioId: pref.modeId,
        learned: pref.modeId === 'werewolf',
        examPassed: pref.modeId === 'werewolf',
        examBypassed: false,
        notes: pref.notes,
      })
    )
  }
  if (!next.growth) {
    const totalExp = retroactiveTotalExp(next)
    next.growth = totalExp > 0 ? growthStateFromTotalExp(totalExp) : createDefaultGrowthState()
  }
  return next
}

function migrateStore(parsed: ArenaStoreData): ArenaStoreData {
  const settings = {
    ...DEFAULT_ARENA_SETTINGS,
    ...parsed.settings,
    matchDefaults: {
      ...DEFAULT_ARENA_SETTINGS.matchDefaults,
      ...parsed.settings?.matchDefaults,
    },
    characterEvolution: {
      ...DEFAULT_ARENA_SETTINGS.characterEvolution,
      ...parsed.settings?.characterEvolution,
    },
  }
  return {
    ...createEmptyStore(),
    ...parsed,
    version: ARENA_STORE_VERSION,
    characters: (parsed.characters || []).map(migrateCharacter),
    introducedSeedKeys: parsed.introducedSeedKeys ?? [],
    installedGameModeIds: parsed.installedGameModeIds ?? [],
    gameModeOverrides: parsed.gameModeOverrides ?? {},
    customGameModes: parsed.customGameModes ?? [],
    customScenarios: parsed.customScenarios ?? [],
    customPromptPacks: parsed.customPromptPacks ?? [],
    behaviorChangeLog: parsed.behaviorChangeLog ?? [],
    characterChatLogs: parsed.characterChatLogs ?? {},
    gameModeQALogs: parsed.gameModeQALogs ?? {},
    helpChatLog: parsed.helpChatLog ?? [],
    characterGrowthLog: parsed.characterGrowthLog ?? [],
    userProfileCharacterId: parsed.userProfileCharacterId ?? null,
    characterLineups: parsed.characterLineups ?? [],
    activeLineupId: parsed.activeLineupId ?? null,
    characterGrowthSnapshots: parsed.characterGrowthSnapshots ?? [],
    lineupGrowthLog: parsed.lineupGrowthLog ?? [],
    settings,
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

function createEmptyStore(): ArenaStoreData {
  return {
    version: ARENA_STORE_VERSION,
    characters: [],
    matches: [],
    snapshots: [],
    settings: structuredClone(DEFAULT_ARENA_SETTINGS),
    logs: [],
    seededAt: null,
    introducedSeedKeys: [],
    installedGameModeIds: [],
    gameModeOverrides: {},
    customGameModes: [],
    customScenarios: [],
    customPromptPacks: [],
    behaviorChangeLog: [],
    characterChatLogs: {},
    gameModeQALogs: {},
    helpChatLog: [],
    characterGrowthLog: [],
    userProfileCharacterId: null,
    characterLineups: [],
    activeLineupId: null,
    characterGrowthSnapshots: [],
    lineupGrowthLog: [],
  }
}

export class ArenaStore {
  private readonly filePath: string
  private data: ArenaStoreData
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(appId: string) {
    const dir = getArenaStoreDir(appId)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, `${ARENA_STORE_KEY}.json`)
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): ArenaStoreData {
    try {
      if (!existsSync(this.filePath)) return createEmptyStore()
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as ArenaStoreData
      return migrateStore(parsed)
    } catch (error) {
      console.error('[arena-store] load failed, using empty store', error)
      return createEmptyStore()
    }
  }

  private enqueuePersist(): void {
    this.writeQueue = this.writeQueue.then(() => this.persistNow()).catch((error) => {
      console.error('[arena-store] persist failed', error)
    })
  }

  private persistNow(): void {
    const tmp = `${this.filePath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
    renameSync(tmp, this.filePath)
  }

  async flush(): Promise<void> {
    await this.writeQueue
  }

  getSnapshot(): ArenaStoreData {
    return structuredClone(this.data)
  }

  replaceAll(next: ArenaStoreData): void {
    this.data = {
      ...createEmptyStore(),
      ...next,
      introducedSeedKeys: next.introducedSeedKeys ?? [],
      installedGameModeIds: next.installedGameModeIds ?? [],
      gameModeOverrides: next.gameModeOverrides ?? {},
      customGameModes: next.customGameModes ?? [],
      customScenarios: next.customScenarios ?? [],
      settings: { ...DEFAULT_ARENA_SETTINGS, ...next.settings },
    }
    this.enqueuePersist()
  }

  getIntroducedSeedKeys(): string[] {
    return [...(this.data.introducedSeedKeys ?? [])]
  }

  addIntroducedSeedKeys(keys: string[]): void {
    const set = new Set(this.data.introducedSeedKeys ?? [])
    for (const key of keys) {
      if (key) set.add(key)
    }
    this.data.introducedSeedKeys = [...set]
    this.enqueuePersist()
  }

  setIntroducedSeedKeys(keys: string[]): void {
    this.data.introducedSeedKeys = [...new Set(keys.filter(Boolean))]
    this.enqueuePersist()
  }

  markSeeded(): void {
    this.data.seededAt = nowIso()
    this.enqueuePersist()
  }

  isSeeded(): boolean {
    return Boolean(this.data.seededAt) && this.data.characters.length > 0
  }

  getInstalledGameModeIds(): string[] {
    return [...(this.data.installedGameModeIds ?? [])]
  }

  installGameMode(modeId: string): void {
    const id = String(modeId || '').trim()
    if (!id) return
    const set = new Set(this.data.installedGameModeIds ?? [])
    set.add(id)
    this.data.installedGameModeIds = [...set]
    this.enqueuePersist()
  }

  clearInstalledGameModes(): void {
    if (!this.data.installedGameModeIds?.length) return
    this.data.installedGameModeIds = []
    this.enqueuePersist()
  }

  listCharacters(): Character[] {
    return structuredClone(this.data.characters)
  }

  getCharacter(id: string): Character | null {
    const found = this.data.characters.find((c) => c.id === id)
    return found ? structuredClone(found) : null
  }

  saveCharacter(character: Character): Character {
    const idx = this.data.characters.findIndex((c) => c.id === character.id)
    const next = { ...character, updatedAt: nowIso() }
    if (idx >= 0) this.data.characters[idx] = next
    else this.data.characters.unshift(next)
    this.enqueuePersist()
    return structuredClone(next)
  }

  deleteCharacter(id: string): boolean {
    const before = this.data.characters.length
    this.data.characters = this.data.characters.filter((c) => c.id !== id)
    if (this.data.characters.length === before) return false
    this.enqueuePersist()
    return true
  }

  listMatches(): Match[] {
    return structuredClone(this.data.matches)
  }

  getMatch(id: string): Match | null {
    const found = this.data.matches.find((m) => m.id === id)
    return found ? structuredClone(found) : null
  }

  saveMatch(match: Match): Match {
    const idx = this.data.matches.findIndex((m) => m.id === match.id)
    const next = { ...match, updatedAt: nowIso() }
    if (idx >= 0) this.data.matches[idx] = next
    else this.data.matches.unshift(next)
    this.enqueuePersist()
    return structuredClone(next)
  }

  deleteMatch(id: string): boolean {
    const before = this.data.matches.length
    this.data.matches = this.data.matches.filter((m) => m.id !== id)
    this.data.snapshots = this.data.snapshots.filter((s) => s.matchId !== id)
    if (this.data.matches.length === before) return false
    this.enqueuePersist()
    return true
  }

  saveSnapshot(snapshot: MatchSnapshot): MatchSnapshot {
    this.data.snapshots.unshift(snapshot)
    if (this.data.snapshots.length > 200) {
      this.data.snapshots = this.data.snapshots.slice(0, 200)
    }
    this.enqueuePersist()
    return structuredClone(snapshot)
  }

  listSnapshots(matchId: string): MatchSnapshot[] {
    return structuredClone(this.data.snapshots.filter((s) => s.matchId === matchId))
  }

  getLatestSnapshot(matchId: string): MatchSnapshot | null {
    const found = this.data.snapshots.find((s) => s.matchId === matchId)
    return found ? structuredClone(found) : null
  }

  getSettings(): ArenaSettings {
    return structuredClone(this.data.settings)
  }

  saveSettings(settings: Partial<ArenaSettings>): ArenaSettings {
    const next: ArenaSettings = {
      ...this.data.settings,
      ...settings,
      matchDefaults: {
        ...this.data.settings.matchDefaults,
        ...settings.matchDefaults,
      },
      characterEvolution: {
        ...this.data.settings.characterEvolution,
        ...settings.characterEvolution,
      },
    }
    this.data.settings = next
    this.enqueuePersist()
    return this.getSettings()
  }

  appendLog(entry: Omit<ArenaLogEntry, 'id' | 'createdAt'>): ArenaLogEntry {
    const full: ArenaLogEntry = {
      ...entry,
      id: randomUUID(),
      createdAt: nowIso(),
    }
    this.data.logs.unshift(full)
    if (this.data.logs.length > ARENA_LOG_MAX) {
      this.data.logs = this.data.logs.slice(0, ARENA_LOG_MAX)
    }
    this.enqueuePersist()
    return structuredClone(full)
  }

  listLogs(limit = 100): ArenaLogEntry[] {
    return structuredClone(this.data.logs.slice(0, limit))
  }

  getGameModeOverrides(): Record<string, GameModeOverride> {
    return structuredClone(this.data.gameModeOverrides ?? {})
  }

  saveGameModeOverride(modeId: string, override: GameModeOverride | null): Record<string, GameModeOverride> {
    const next = { ...(this.data.gameModeOverrides ?? {}) }
    if (!override || Object.keys(override).length === 0) {
      delete next[modeId]
    } else {
      next[modeId] = { ...next[modeId], ...override }
    }
    this.data.gameModeOverrides = next
    this.enqueuePersist()
    return this.getGameModeOverrides()
  }

  clearGameModeOverride(modeId: string): Record<string, GameModeOverride> {
    const next = { ...(this.data.gameModeOverrides ?? {}) }
    delete next[modeId]
    this.data.gameModeOverrides = next
    this.enqueuePersist()
    return this.getGameModeOverrides()
  }

  listCustomGameModes(): GameMode[] {
    return structuredClone(this.data.customGameModes ?? [])
  }

  getCustomGameMode(modeId: string): GameMode | null {
    const found = (this.data.customGameModes ?? []).find((mode) => mode.id === modeId)
    return found ? structuredClone(found) : null
  }

  saveCustomGameMode(mode: GameMode): GameMode {
    const list = [...(this.data.customGameModes ?? [])]
    const idx = list.findIndex((item) => item.id === mode.id)
    const next = structuredClone(mode)
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    this.data.customGameModes = list
    this.installGameMode(mode.id)
    this.enqueuePersist()
    return structuredClone(next)
  }

  deleteCustomGameMode(modeId: string): boolean {
    const before = this.data.customGameModes?.length ?? 0
    this.data.customGameModes = (this.data.customGameModes ?? []).filter((mode) => mode.id !== modeId)
    if ((this.data.customGameModes?.length ?? 0) === before) return false

    const installed = new Set(this.data.installedGameModeIds ?? [])
    installed.delete(modeId)
    this.data.installedGameModeIds = [...installed]

    const overrides = { ...(this.data.gameModeOverrides ?? {}) }
    delete overrides[modeId]
    this.data.gameModeOverrides = overrides

    const scenarioIds = new Set(
      (this.data.customScenarios ?? [])
        .filter((scenario) => scenario.gameModeId === modeId)
        .map((scenario) => scenario.id)
    )
    this.data.customScenarios = (this.data.customScenarios ?? []).filter((scenario) => scenario.gameModeId !== modeId)
    this.data.customPromptPacks = (this.data.customPromptPacks ?? []).filter((pack) => !scenarioIds.has(pack.scenarioId))

    const qaLogs = { ...(this.data.gameModeQALogs ?? {}) }
    delete qaLogs[modeId]
    this.data.gameModeQALogs = qaLogs

    this.enqueuePersist()
    return true
  }

  getScenarioData(): Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'> {
    return {
      customScenarios: structuredClone(this.data.customScenarios ?? []),
      customPromptPacks: structuredClone(this.data.customPromptPacks ?? []),
    }
  }

  saveCustomScenario(scenario: GameScenarioDefinition): Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'> {
    const list = [...(this.data.customScenarios ?? [])]
    const idx = list.findIndex((s) => s.id === scenario.id)
    const next = { ...scenario, updatedAt: nowIso(), isBuiltin: false }
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    this.data.customScenarios = list
    this.enqueuePersist()
    return this.getScenarioData()
  }

  clearCustomScenario(scenarioId: string): Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'> {
    this.data.customScenarios = (this.data.customScenarios ?? []).filter((s) => s.id !== scenarioId)
    this.enqueuePersist()
    return this.getScenarioData()
  }

  saveCustomPromptPack(pack: PromptPack): Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'> {
    const list = [...(this.data.customPromptPacks ?? [])]
    const idx = list.findIndex((p) => p.id === pack.id)
    const next = { ...pack, updatedAt: nowIso(), isBuiltin: false }
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    this.data.customPromptPacks = list
    this.enqueuePersist()
    return this.getScenarioData()
  }

  listBehaviorChanges(): BehaviorChangeRecord[] {
    return structuredClone(this.data.behaviorChangeLog ?? [])
  }

  appendBehaviorChange(record: BehaviorChangeRecord): BehaviorChangeRecord {
    this.data.behaviorChangeLog = [record, ...(this.data.behaviorChangeLog ?? [])]
    if (this.data.behaviorChangeLog.length > 500) {
      this.data.behaviorChangeLog = this.data.behaviorChangeLog.slice(0, 500)
    }
    this.enqueuePersist()
    return structuredClone(record)
  }

  updateBehaviorChange(record: BehaviorChangeRecord): BehaviorChangeRecord {
    const list = this.data.behaviorChangeLog ?? []
    const idx = list.findIndex((r) => r.id === record.id)
    if (idx >= 0) list[idx] = record
    else list.unshift(record)
    this.data.behaviorChangeLog = list
    this.enqueuePersist()
    return structuredClone(record)
  }

  listCharacterChat(characterId: string): CharacterChatMessage[] {
    return structuredClone(this.data.characterChatLogs?.[characterId] ?? [])
  }

  appendCharacterChat(characterId: string, message: CharacterChatMessage): CharacterChatMessage[] {
    const logs = { ...(this.data.characterChatLogs ?? {}) }
    const list = [...(logs[characterId] ?? []), message]
    if (list.length > 200) list.splice(0, list.length - 200)
    logs[characterId] = list
    this.data.characterChatLogs = logs
    this.enqueuePersist()
    return structuredClone(list)
  }

  clearCharacterChat(characterId: string): void {
    const logs = { ...(this.data.characterChatLogs ?? {}) }
    delete logs[characterId]
    this.data.characterChatLogs = logs
    this.enqueuePersist()
  }

  listGameModeQA(gameModeId: string): CharacterChatMessage[] {
    return structuredClone(this.data.gameModeQALogs?.[gameModeId] ?? [])
  }

  appendGameModeQA(gameModeId: string, message: CharacterChatMessage): CharacterChatMessage[] {
    const logs = { ...(this.data.gameModeQALogs ?? {}) }
    const list = [...(logs[gameModeId] ?? []), message]
    if (list.length > 200) list.splice(0, list.length - 200)
    logs[gameModeId] = list
    this.data.gameModeQALogs = logs
    this.enqueuePersist()
    return structuredClone(list)
  }

  clearGameModeQA(gameModeId: string): void {
    const logs = { ...(this.data.gameModeQALogs ?? {}) }
    delete logs[gameModeId]
    this.data.gameModeQALogs = logs
    this.enqueuePersist()
  }

  listHelpChat(): CharacterChatMessage[] {
    return structuredClone(this.data.helpChatLog ?? [])
  }

  appendHelpChat(message: CharacterChatMessage): CharacterChatMessage[] {
    const list = [...(this.data.helpChatLog ?? []), message]
    if (list.length > 200) list.splice(0, list.length - 200)
    this.data.helpChatLog = list
    this.enqueuePersist()
    return structuredClone(list)
  }

  clearHelpChat(): void {
    this.data.helpChatLog = []
    this.enqueuePersist()
  }

  listCharacterGrowth(characterId: string): CharacterGrowthRecord[] {
    return structuredClone((this.data.characterGrowthLog ?? []).filter((r) => r.characterId === characterId))
  }

  appendCharacterGrowth(record: CharacterGrowthRecord): CharacterGrowthRecord {
    this.data.characterGrowthLog = [record, ...(this.data.characterGrowthLog ?? [])]
    if (this.data.characterGrowthLog.length > 300) {
      this.data.characterGrowthLog = this.data.characterGrowthLog.slice(0, 300)
    }
    this.enqueuePersist()
    return structuredClone(record)
  }

  listCharacterGrowthSnapshots(characterId: string): CharacterGrowthSnapshot[] {
    return structuredClone(
      (this.data.characterGrowthSnapshots ?? [])
        .filter((item) => item.characterId === characterId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    )
  }

  appendCharacterGrowthSnapshot(snapshot: CharacterGrowthSnapshot): CharacterGrowthSnapshot {
    this.data.characterGrowthSnapshots = [snapshot, ...(this.data.characterGrowthSnapshots ?? [])]
    if (this.data.characterGrowthSnapshots.length > 600) {
      this.data.characterGrowthSnapshots = this.data.characterGrowthSnapshots.slice(0, 600)
    }
    this.enqueuePersist()
    return structuredClone(snapshot)
  }

  listLineups(): CharacterLineup[] {
    return structuredClone(this.data.characterLineups ?? [])
  }

  getLineup(id: string): CharacterLineup | null {
    const found = (this.data.characterLineups ?? []).find((item) => item.id === id)
    return found ? structuredClone(found) : null
  }

  saveLineup(lineup: CharacterLineup): CharacterLineup {
    const list = [...(this.data.characterLineups ?? [])]
    const idx = list.findIndex((item) => item.id === lineup.id)
    const next = { ...lineup, updatedAt: nowIso() }
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    this.data.characterLineups = list
    if (!this.data.activeLineupId && list.length === 1) {
      this.data.activeLineupId = next.id
    }
    this.enqueuePersist()
    return structuredClone(next)
  }

  deleteLineup(id: string): boolean {
    const before = this.data.characterLineups?.length ?? 0
    this.data.characterLineups = (this.data.characterLineups ?? []).filter((item) => item.id !== id)
    if ((this.data.characterLineups?.length ?? 0) === before) return false
    if (this.data.activeLineupId === id) {
      this.data.activeLineupId = this.data.characterLineups?.[0]?.id ?? null
    }
    this.enqueuePersist()
    return true
  }

  setActiveLineupId(id: string | null): string | null {
    this.data.activeLineupId = id?.trim() || null
    this.enqueuePersist()
    return this.data.activeLineupId
  }

  getActiveLineupId(): string | null {
    return this.data.activeLineupId ?? null
  }

  listLineupGrowth(lineupId: string): LineupGrowthRecord[] {
    return structuredClone(
      (this.data.lineupGrowthLog ?? [])
        .filter((item) => item.lineupId === lineupId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    )
  }

  appendLineupGrowth(record: LineupGrowthRecord): LineupGrowthRecord {
    this.data.lineupGrowthLog = [record, ...(this.data.lineupGrowthLog ?? [])]
    if (this.data.lineupGrowthLog.length > 400) {
      this.data.lineupGrowthLog = this.data.lineupGrowthLog.slice(0, 400)
    }
    this.enqueuePersist()
    return structuredClone(record)
  }

  getUserProfileCharacterId(): string | null {
    return this.data.userProfileCharacterId ?? null
  }

  setUserProfileCharacterId(characterId: string | null): void {
    this.data.userProfileCharacterId = characterId?.trim() || null
    this.enqueuePersist()
  }

  getStats(): ArenaStoreStats {
    const installedGameModeIds = this.getInstalledGameModeIds()
    return {
      characterCount: this.data.characters.length,
      matchCount: this.data.matches.length,
      snapshotCount: this.data.snapshots.length,
      logCount: this.data.logs.length,
      gameModeOverrideCount: Object.keys(this.data.gameModeOverrides ?? {}).length,
      customGameModeCount: (this.data.customGameModes ?? []).length,
      installedGameModeCount: installedGameModeIds.length,
      installedGameModeIds,
      seededAt: this.data.seededAt,
      userProfileCharacterId: this.data.userProfileCharacterId ?? null,
    }
  }

  clearMatches(): void {
    this.data.matches = []
    this.data.snapshots = []
    this.enqueuePersist()
  }

  clearLogs(): void {
    this.data.logs = []
    this.enqueuePersist()
  }

  clearGameModeOverrides(): void {
    this.data.gameModeOverrides = {}
    this.enqueuePersist()
  }

  clearCustomGameModes(): void {
    const ids = (this.data.customGameModes ?? []).map((mode) => mode.id)
    for (const id of ids) {
      this.deleteCustomGameMode(id)
    }
  }

  pruneExpiredData(retentionDays: number): number {
    const days = Math.max(1, Math.floor(retentionDays))
    const cutoff = Date.now() - days * 86_400_000
    const removedIds = new Set<string>()
    const kept = this.data.matches.filter((match) => {
      if (match.status === 'active' || match.status === 'paused') return true
      const updatedAt = new Date(match.updatedAt).getTime()
      if (Number.isNaN(updatedAt) || updatedAt >= cutoff) return true
      removedIds.add(match.id)
      return false
    })
    const removedCount = this.data.matches.length - kept.length
    this.data.matches = kept
    if (removedIds.size > 0) {
      this.data.snapshots = this.data.snapshots.filter((snapshot) => !removedIds.has(snapshot.matchId))
    }
    if (removedCount > 0) this.enqueuePersist()
    return removedCount
  }

  factoryReset(): void {
    this.data = createEmptyStore()
    this.persistNow()
  }
}

export function ok<T>(data: T): ArenaResult<T> {
  return { ok: true, data }
}

export function fail(code: string, error: string): ArenaResult {
  return { ok: false, code, error }
}
