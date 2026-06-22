import type {
  ArenaLogEntry,
  ArenaSettings,
  ArenaStoreData,
  Character,
  GameModeOverride,
  Match,
  MatchSnapshot,
} from '@shared/arena/types'

export interface ArenaApi {
  arenaInit: () => Promise<ArenaStoreData>
  listCharacters: () => Promise<Character[]>
  getCharacter: (id: string) => Promise<Character>
  saveCharacter: (character: Character) => Promise<Character>
  deleteCharacter: (id: string) => Promise<boolean>
  duplicateCharacter: (id: string) => Promise<Character>
  listMatches: () => Promise<Match[]>
  getMatch: (id: string) => Promise<Match>
  saveMatch: (match: Match) => Promise<Match>
  deleteMatch: (id: string) => Promise<boolean>
  saveSnapshot: (snapshot: MatchSnapshot) => Promise<MatchSnapshot>
  listSnapshots: (matchId: string) => Promise<MatchSnapshot[]>
  getLatestSnapshot: (matchId: string) => Promise<MatchSnapshot | null>
  getSettings: () => Promise<ArenaSettings>
  saveSettings: (settings: Partial<ArenaSettings>) => Promise<ArenaSettings>
  appendLog: (entry: Omit<ArenaLogEntry, 'id' | 'createdAt'>) => Promise<ArenaLogEntry>
  listLogs: (limit?: number) => Promise<ArenaLogEntry[]>
  exportStore: () => Promise<ArenaStoreData>
  getGameModeOverrides: () => Promise<Record<string, GameModeOverride>>
  saveGameModeOverride: (modeId: string, override: GameModeOverride) => Promise<Record<string, GameModeOverride>>
  clearGameModeOverride: (modeId: string) => Promise<Record<string, GameModeOverride>>
  getWindowKind: () => Promise<'login' | 'main' | 'match-room'>
  openMatchRoomWindow: (matchId: string) => Promise<{ ok: boolean; error?: string }>
  closeMatchRoomWindow: (matchId: string) => Promise<{ ok: boolean }>
  focusMainWindow: () => Promise<{ ok: boolean }>
}
