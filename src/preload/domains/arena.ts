import { ipcRenderer } from 'electron'
import type {
  ArenaLogEntry,
  ArenaResult,
  ArenaSettings,
  ArenaStoreData,
  ArenaStoreStats,
  BehaviorChangeRecord,
  Character,
  CharacterChatMessage,
  CharacterGrowthRecord,
  GameModeOverride,
  Match,
  MatchSnapshot,
  GameMode,
} from '@shared/arena/types'
import type { GameScenarioDefinition, PromptPack } from '@shared/arena/game-scenario'
import { cloneJson } from '@shared/clone-json'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ArenaResult<T>
  if (!result.ok) {
    throw new Error(result.error || result.code || '请求失败')
  }
  return result.data as T
}

export const arenaDomain = {
  arenaInit: () => invoke<ArenaStoreData>('arena:init'),

  getCharacterPackCatalog: () =>
    invoke<Array<Record<string, unknown>>>('arena:assets:characterPackCatalog'),

  listCharacters: () => invoke<Character[]>('arena:characters:list'),
  getCharacter: (id: string) => invoke<Character>('arena:characters:get', id),
  saveCharacter: (character: Character) => invoke<Character>('arena:characters:save', cloneJson(character)),
  deleteCharacter: (id: string) => invoke<boolean>('arena:characters:delete', id),
  duplicateCharacter: (id: string) => invoke<Character>('arena:characters:duplicate', id),
  materializeCharacterFromPack: (character: Character, packId: string, packCharacterId: string) =>
    invoke<Character>('arena:characters:materializeFromPack', cloneJson(character), packId, packCharacterId),
  writeCharacterAsset: (
    characterId: string,
    slot: import('@shared/arena/character-visuals').CharacterImageSlot,
    expressionId: import('@shared/arena/character-visuals').CharacterExpressionId | null,
    dataUrl: string
  ) => invoke<string>('arena:characters:writeAsset', characterId, slot, expressionId, dataUrl),
  exportCharacterPack: (characterId: string, zipPath: string) =>
    invoke<boolean>('arena:characters:exportPack', characterId, zipPath),
  importCharacterPack: (zipPath: string, characterId: string) =>
    invoke<Character>('arena:characters:importPack', zipPath, characterId),
  importLegacyCharacterJson: (filePath: string, characterId: string) =>
    invoke<Character>('arena:characters:importLegacyJson', filePath, characterId),

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
  getStoreStats: () => invoke<ArenaStoreStats>('arena:store:stats'),
  clearStoreMatches: () => invoke<boolean>('arena:store:clearMatches'),
  clearStoreLogs: () => invoke<boolean>('arena:store:clearLogs'),
  pruneStoreExpired: (retentionDays: number) => invoke<number>('arena:store:pruneExpired', retentionDays),
  factoryResetStore: () => invoke<ArenaStoreStats>('arena:store:factoryReset'),

  seedStarterCharacter: (modelId: string) => invoke<Character>('arena:starter:seed', modelId),
  seedStarterGameMode: (modeId: string) => invoke<boolean>('arena:starter:seedGameMode', modeId),
  finalizeStarterInit: () => invoke<ArenaStoreStats>('arena:starter:finalize'),

  getGameModeOverrides: () => invoke<Record<string, GameModeOverride>>('arena:gameModes:getOverrides'),
  saveGameModeOverride: (modeId: string, override: GameModeOverride) =>
    invoke<Record<string, GameModeOverride>>('arena:gameModes:saveOverride', modeId, override),
  clearGameModeOverride: (modeId: string) =>
    invoke<Record<string, GameModeOverride>>('arena:gameModes:clearOverride', modeId),

  listCustomGameModes: () => invoke<GameMode[]>('arena:gameModes:listCustom'),
  saveCustomGameMode: (mode: GameMode) => invoke<GameMode>('arena:gameModes:saveCustom', mode),
  deleteCustomGameMode: (modeId: string) => invoke<boolean>('arena:gameModes:deleteCustom', modeId),

  getScenarioData: () =>
    invoke<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>('arena:scenarios:getData'),
  saveCustomScenario: (scenario: GameScenarioDefinition) =>
    invoke<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>('arena:scenarios:saveCustom', scenario),
  clearCustomScenario: (scenarioId: string) =>
    invoke<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>('arena:scenarios:clearCustom', scenarioId),
  saveCustomPromptPack: (pack: PromptPack) =>
    invoke<Pick<ArenaStoreData, 'customPromptPacks' | 'customScenarios'>>('arena:promptPacks:saveCustom', pack),
  listBehaviorChanges: () => invoke<BehaviorChangeRecord[]>('arena:behaviorChanges:list'),
  appendBehaviorChange: (record: BehaviorChangeRecord) => invoke<BehaviorChangeRecord>('arena:behaviorChanges:append', record),
  updateBehaviorChange: (record: BehaviorChangeRecord) => invoke<BehaviorChangeRecord>('arena:behaviorChanges:update', record),

  listCharacterChat: (characterId: string) => invoke<CharacterChatMessage[]>('arena:characterChat:list', characterId),
  appendCharacterChat: (characterId: string, message: CharacterChatMessage) =>
    invoke<CharacterChatMessage[]>('arena:characterChat:append', characterId, message),
  clearCharacterChat: (characterId: string) => invoke<boolean>('arena:characterChat:clear', characterId),
  listCharacterGrowth: (characterId: string) => invoke<CharacterGrowthRecord[]>('arena:characterGrowth:list', characterId),
  appendCharacterGrowth: (record: CharacterGrowthRecord) => invoke<CharacterGrowthRecord>('arena:characterGrowth:append', record),

  listGameModeQA: (gameModeId: string) => invoke<CharacterChatMessage[]>('arena:gameModeQA:list', gameModeId),
  appendGameModeQA: (gameModeId: string, message: CharacterChatMessage) =>
    invoke<CharacterChatMessage[]>('arena:gameModeQA:append', gameModeId, message),
  clearGameModeQA: (gameModeId: string) => invoke<boolean>('arena:gameModeQA:clear', gameModeId),

  listHelpChat: () => invoke<CharacterChatMessage[]>('arena:helpChat:list'),
  appendHelpChat: (message: CharacterChatMessage) => invoke<CharacterChatMessage[]>('arena:helpChat:append', message),
  clearHelpChat: () => invoke<boolean>('arena:helpChat:clear'),

  getWindowKind: () => ipcRenderer.invoke('window:getKind') as Promise<'login' | 'main' | 'match-room'>,
  openMatchRoomWindow: (matchId: string) =>
    ipcRenderer.invoke('arena:matchWindow:open', matchId) as Promise<{ ok: boolean; error?: string }>,
  closeMatchRoomWindow: (matchId: string) =>
    ipcRenderer.invoke('arena:matchWindow:close', matchId) as Promise<{ ok: boolean }>,
  focusMainWindow: () => ipcRenderer.invoke('arena:matchWindow:focusMain') as Promise<{ ok: boolean }>,
  toggleDevTools: () => ipcRenderer.invoke('window:toggleDevTools') as Promise<{ ok: boolean; opened?: boolean }>,
}
