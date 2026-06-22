import { ipcRenderer } from 'electron'
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

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ArenaResult<T>
  if (!result.ok) {
    throw new Error(result.error || result.code || '请求失败')
  }
  return result.data as T
}

export const arenaDomain = {
  arenaInit: () => invoke<ArenaStoreData>('arena:init'),

  listCharacters: () => invoke<Character[]>('arena:characters:list'),
  getCharacter: (id: string) => invoke<Character>('arena:characters:get', id),
  saveCharacter: (character: Character) => invoke<Character>('arena:characters:save', character),
  deleteCharacter: (id: string) => invoke<boolean>('arena:characters:delete', id),
  duplicateCharacter: (id: string) => invoke<Character>('arena:characters:duplicate', id),

  listMatches: () => invoke<Match[]>('arena:matches:list'),
  getMatch: (id: string) => invoke<Match>('arena:matches:get', id),
  saveMatch: (match: Match) => invoke<Match>('arena:matches:save', match),
  deleteMatch: (id: string) => invoke<boolean>('arena:matches:delete', id),

  saveSnapshot: (snapshot: MatchSnapshot) => invoke<MatchSnapshot>('arena:snapshots:save', snapshot),
  listSnapshots: (matchId: string) => invoke<MatchSnapshot[]>('arena:snapshots:list', matchId),
  getLatestSnapshot: (matchId: string) => invoke<MatchSnapshot | null>('arena:snapshots:latest', matchId),

  getSettings: () => invoke<ArenaSettings>('arena:settings:get'),
  saveSettings: (settings: Partial<ArenaSettings>) => invoke<ArenaSettings>('arena:settings:save', settings),

  appendLog: (entry: Omit<ArenaLogEntry, 'id' | 'createdAt'>) =>
    invoke<ArenaLogEntry>('arena:logs:append', entry),
  listLogs: (limit?: number) => invoke<ArenaLogEntry[]>('arena:logs:list', limit),

  exportStore: () => invoke<ArenaStoreData>('arena:store:export'),

  getGameModeOverrides: () => invoke<Record<string, GameModeOverride>>('arena:gameModes:getOverrides'),
  saveGameModeOverride: (modeId: string, override: GameModeOverride) =>
    invoke<Record<string, GameModeOverride>>('arena:gameModes:saveOverride', modeId, override),
  clearGameModeOverride: (modeId: string) =>
    invoke<Record<string, GameModeOverride>>('arena:gameModes:clearOverride', modeId),

  getWindowKind: () => ipcRenderer.invoke('window:getKind') as Promise<'login' | 'main' | 'match-room'>,
  openMatchRoomWindow: (matchId: string) =>
    ipcRenderer.invoke('arena:matchWindow:open', matchId) as Promise<{ ok: boolean; error?: string }>,
  closeMatchRoomWindow: (matchId: string) =>
    ipcRenderer.invoke('arena:matchWindow:close', matchId) as Promise<{ ok: boolean }>,
  focusMainWindow: () => ipcRenderer.invoke('arena:matchWindow:focusMain') as Promise<{ ok: boolean }>,
}
