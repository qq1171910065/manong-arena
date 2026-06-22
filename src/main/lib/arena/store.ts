import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
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
  Character,
  GameModeOverride,
  Match,
  MatchSnapshot,
} from '@shared/arena/types'

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
    gameModeOverrides: {},
  }
}

export class ArenaStore {
  private readonly filePath: string
  private data: ArenaStoreData
  private writeQueue: Promise<void> = Promise.resolve()

  constructor(appId: string) {
    const dir = join(app.getPath('userData'), appId, 'arena')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    this.filePath = join(dir, `${ARENA_STORE_KEY}.json`)
    this.data = this.loadFromDisk()
  }

  private loadFromDisk(): ArenaStoreData {
    try {
      if (!existsSync(this.filePath)) return createEmptyStore()
      const raw = readFileSync(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as ArenaStoreData
      return {
        ...createEmptyStore(),
        ...parsed,
        introducedSeedKeys: parsed.introducedSeedKeys ?? [],
        gameModeOverrides: parsed.gameModeOverrides ?? {},
        settings: {
          ...DEFAULT_ARENA_SETTINGS,
          ...parsed.settings,
          matchDefaults: {
            ...DEFAULT_ARENA_SETTINGS.matchDefaults,
            ...parsed.settings?.matchDefaults,
          },
        },
      }
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
      gameModeOverrides: next.gameModeOverrides ?? {},
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
}

export function ok<T>(data: T): ArenaResult<T> {
  return { ok: true, data }
}

export function fail(code: string, error: string): ArenaResult {
  return { ok: false, code, error }
}
