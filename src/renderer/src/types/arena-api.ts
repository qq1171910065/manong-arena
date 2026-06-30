import type {
  ArenaLogEntry,
  ArenaSettings,
  ArenaStoreData,
  ArenaStoreStats,
  BehaviorChangeRecord,
  Character,
  CharacterChatMessage,
  CharacterGrowthRecord,
  CharacterGrowthSnapshot,
  CharacterLineup,
  LineupGrowthRecord,
  GameModeOverride,
  Match,
  MatchSnapshot,
  GameMode,
} from '@shared/arena/types'
import type { GameScenarioDefinition, PromptPack } from '@shared/arena/game-scenario'
import type { DevAssetsApi } from '@shared/arena/dev-assets-api'
import type { AssetPackProgressPayload, InitialAssetPackManifest } from '@shared/arena/initial-assets'

export interface AssetPackApi {
  isInitialAssetsReady: () => Promise<{ ok: boolean; ready?: boolean }>
  isUserAssetPackInstalled: () => Promise<{ ok: boolean; installed?: boolean }>
  getInitialAssetManifest: () => Promise<{ ok: boolean; manifest?: InitialAssetPackManifest | null }>
  ensureInitialAssets: () => Promise<{
    ok: boolean
    skipped?: boolean
    source?: 'local' | 'remote'
    error?: string
  }>
  installAssetPackFromFile: () => Promise<{
    ok: boolean
    skipped?: boolean
    source?: 'local' | 'remote'
    canceled?: boolean
    error?: string
  }>
  installBundledMinimalAssets: () => Promise<{
    ok: boolean
    skipped?: boolean
    source?: 'local' | 'remote'
    error?: string
  }>
  onAssetPackProgress: (callback: (payload: AssetPackProgressPayload) => void) => () => void
}

export interface ArenaApi {
  arenaInit: () => Promise<ArenaStoreData>
  getCharacterPackCatalog: () => Promise<Array<Record<string, unknown>>>
  listCharacters: () => Promise<Character[]>
  getCharacter: (id: string) => Promise<Character>
  saveCharacter: (character: Character) => Promise<Character>
  deleteCharacter: (id: string) => Promise<boolean>
  duplicateCharacter: (id: string) => Promise<Character>
  materializeCharacterFromPack: (character: Character, packId: string, packCharacterId: string) => Promise<Character>
  writeCharacterAsset: (
    characterId: string,
    slot: import('@shared/arena/character-visuals').CharacterImageSlot,
    expressionId: import('@shared/arena/character-visuals').CharacterExpressionId | null,
    dataUrl: string
  ) => Promise<string>
  exportCharacterPack: (characterId: string, zipPath: string) => Promise<boolean>
  importCharacterPack: (zipPath: string, characterId: string) => Promise<Character>
  importLegacyCharacterJson: (filePath: string, characterId: string) => Promise<Character>
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
  getStoreStats: () => Promise<ArenaStoreStats>
  clearStoreMatches: () => Promise<boolean>
  clearStoreLogs: () => Promise<boolean>
  pruneStoreExpired: (retentionDays: number) => Promise<number>
  factoryResetStore: () => Promise<ArenaStoreStats>
  seedStarterCharacter: (modelId: string) => Promise<Character>
  seedStarterGameMode: (modeId: string) => Promise<boolean>
  importStarterInitBundle: () => Promise<{ characters: number; gameModes: number; seedKeys: string[] }>
  finalizeStarterInit: (introducedSeedKeys?: string[]) => Promise<ArenaStoreStats>
  getUserProfileCharacterId: () => Promise<string | null>
  createUserProfileCharacter: (input: {
    displayName: string
    speechStyle?: string
    gender?: 'female' | 'male' | 'other'
    bio?: string
  }) => Promise<Character>
  getGameModeOverrides: () => Promise<Record<string, GameModeOverride>>
  saveGameModeOverride: (modeId: string, override: GameModeOverride) => Promise<Record<string, GameModeOverride>>
  clearGameModeOverride: (modeId: string) => Promise<Record<string, GameModeOverride>>
  listCustomGameModes: () => Promise<GameMode[]>
  saveCustomGameMode: (mode: GameMode) => Promise<GameMode>
  deleteCustomGameMode: (modeId: string) => Promise<boolean>
  getScenarioData: () => Promise<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>
  saveCustomScenario: (scenario: GameScenarioDefinition) => Promise<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>
  clearCustomScenario: (scenarioId: string) => Promise<Pick<ArenaStoreData, 'customScenarios' | 'customPromptPacks'>>
  saveCustomPromptPack: (pack: PromptPack) => Promise<Pick<ArenaStoreData, 'customPromptPacks' | 'customScenarios'>>
  listBehaviorChanges: () => Promise<BehaviorChangeRecord[]>
  appendBehaviorChange: (record: BehaviorChangeRecord) => Promise<BehaviorChangeRecord>
  updateBehaviorChange: (record: BehaviorChangeRecord) => Promise<BehaviorChangeRecord>
  listCharacterChat: (characterId: string) => Promise<CharacterChatMessage[]>
  appendCharacterChat: (characterId: string, message: CharacterChatMessage) => Promise<CharacterChatMessage[]>
  clearCharacterChat: (characterId: string) => Promise<boolean>
  listCharacterGrowth: (characterId: string) => Promise<CharacterGrowthRecord[]>
  appendCharacterGrowth: (record: CharacterGrowthRecord) => Promise<CharacterGrowthRecord>
  listCharacterGrowthSnapshots: (characterId: string) => Promise<CharacterGrowthSnapshot[]>
  appendCharacterGrowthSnapshot: (snapshot: CharacterGrowthSnapshot) => Promise<CharacterGrowthSnapshot>
  listLineups: () => Promise<CharacterLineup[]>
  saveLineup: (lineup: CharacterLineup) => Promise<CharacterLineup>
  deleteLineup: (id: string) => Promise<boolean>
  getActiveLineupId: () => Promise<string | null>
  setActiveLineupId: (id: string | null) => Promise<string | null>
  listLineupGrowth: (lineupId: string) => Promise<LineupGrowthRecord[]>
  appendLineupGrowth: (record: LineupGrowthRecord) => Promise<LineupGrowthRecord>
  listGameModeQA: (gameModeId: string) => Promise<CharacterChatMessage[]>
  appendGameModeQA: (gameModeId: string, message: CharacterChatMessage) => Promise<CharacterChatMessage[]>
  clearGameModeQA: (gameModeId: string) => Promise<boolean>
  listHelpChat: () => Promise<CharacterChatMessage[]>
  appendHelpChat: (message: CharacterChatMessage) => Promise<CharacterChatMessage[]>
  clearHelpChat: () => Promise<boolean>
  getWindowKind: () => Promise<'login' | 'main' | 'match-room'>
  openMatchRoomWindow: (matchId: string) => Promise<{ ok: boolean; error?: string }>
  closeMatchRoomWindow: (matchId: string) => Promise<{ ok: boolean }>
  focusMainWindow: () => Promise<{ ok: boolean }>
}

export type { DevAssetsApi } from '@shared/arena/dev-assets-api'
