import { randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { ipcMain } from 'electron'
import { ASSET_PACK_MARKER_PATH, resolveAssetFilePath } from '../asset-pack/paths'
import type { CharacterExpressionId, CharacterImageSlot } from '@shared/arena/character-visuals'
import type { CharacterExportPackage } from '@shared/arena/export-packages'
import { isCharacterExportPackage } from '@shared/arena/export-packages'
import {
  deleteCharacterAssets,
  duplicateCharacterAssets,
  exportCharacterPack,
  importCharacterPackFromZip,
  importLegacyCharacterJson,
  materializeAllCharacters,
  materializeCharacterAssets,
  materializeCharacterFromPack,
  writeCharacterAssetFile,
} from './character-assets'
import { ArenaStore, fail, ok } from './store'
import { seedDefaultCharacters, seedStarterByModelId, seedStarterGameMode, importStarterInitBundle, finalizeStarterInit, createUserProfileCharacter, type UserProfileCharacterInput } from './seed'
import type {
  ArenaLogEntry,
  ArenaResult,
  ArenaSettings,
  Character,
  GameModeOverride,
  Match,
  MatchSnapshot,
} from '@shared/arena/types'

let store: ArenaStore | null = null

function requireStore(): ArenaStore {
  if (!store) throw new Error('Arena store not initialized')
  return store
}

function wrap<T>(fn: () => T): ArenaResult<T> {
  try {
    return ok(fn())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    requireStore().appendLog({ level: 'error', scope: 'storage', message, detail: message })
    return fail('INTERNAL', message)
  }
}

async function wrapAsync<T>(fn: () => Promise<T> | T): Promise<ArenaResult<T>> {
  try {
    return ok(await fn())
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    requireStore().appendLog({ level: 'error', scope: 'storage', message, detail: message })
    return fail('INTERNAL', message)
  }
}

async function persistCharacterWithAssets(appId: string, character: Character): Promise<Character> {
  const materialized = await materializeCharacterAssets(appId, character)
  return requireStore().saveCharacter(materialized)
}

async function syncCharacterAssets(appId: string): Promise<void> {
  const storeRef = requireStore()
  const materialized = await materializeAllCharacters(appId, storeRef.listCharacters())
  for (const character of materialized) {
    storeRef.saveCharacter(character)
  }
}

export function registerArenaHandlers(appId: string): void {
  store = new ArenaStore(appId)
  seedDefaultCharacters(store)

  ipcMain.removeHandler('arena:init')
  ipcMain.handle('arena:init', async () =>
    wrapAsync(async () => {
      seedDefaultCharacters(requireStore())
      await syncCharacterAssets(appId)
      await requireStore().flush()
      return requireStore().getSnapshot()
    })
  )

  ipcMain.removeHandler('arena:starter:seed')
  ipcMain.handle('arena:starter:seed', (_event, modelId: string) =>
    wrapAsync(async () => {
      const created = seedStarterByModelId(requireStore(), modelId)
      return persistCharacterWithAssets(appId, created)
    })
  )

  ipcMain.removeHandler('arena:starter:seedGameMode')
  ipcMain.handle('arena:starter:seedGameMode', (_event, modeId: string) =>
    wrap(() => {
      seedStarterGameMode(requireStore(), modeId)
      return true
    })
  )

  ipcMain.removeHandler('arena:starter:importBundle')
  ipcMain.handle('arena:starter:importBundle', async () =>
    wrapAsync(async () => {
      const result = importStarterInitBundle(requireStore(), appId)
      await syncCharacterAssets(appId)
      await requireStore().flush()
      return result
    })
  )

  ipcMain.removeHandler('arena:starter:finalize')
  ipcMain.handle('arena:starter:finalize', async (_event, introducedSeedKeys?: string[]) =>
    wrapAsync(async () => {
      finalizeStarterInit(requireStore(), introducedSeedKeys)
      await requireStore().flush()
      return requireStore().getStats()
    })
  )

  ipcMain.removeHandler('arena:userProfile:getId')
  ipcMain.handle('arena:userProfile:getId', () =>
    wrap(() => requireStore().getUserProfileCharacterId())
  )

  ipcMain.removeHandler('arena:userProfile:create')
  ipcMain.handle('arena:userProfile:create', (_event, input: UserProfileCharacterInput) =>
    wrapAsync(async () => {
      const created = createUserProfileCharacter(requireStore(), input)
      return persistCharacterWithAssets(appId, created)
    })
  )

  ipcMain.removeHandler('arena:assets:characterPackCatalog')
  ipcMain.handle('arena:assets:characterPackCatalog', () =>
    wrap(() => {
      const manifestPath = resolveAssetFilePath(ASSET_PACK_MARKER_PATH, appId)
      if (!manifestPath || !existsSync(manifestPath)) return []
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { characters?: unknown[] }
      return Array.isArray(manifest.characters) ? manifest.characters : []
    })
  )

  ipcMain.removeHandler('arena:characters:list')
  ipcMain.handle('arena:characters:list', () => wrap(() => requireStore().listCharacters()))

  ipcMain.removeHandler('arena:characters:get')
  ipcMain.handle('arena:characters:get', (_event, id: string) =>
    wrap(() => {
      const character = requireStore().getCharacter(id)
      if (!character) throw new Error('角色不存在')
      return character
    })
  )

  ipcMain.removeHandler('arena:characters:save')
  ipcMain.handle('arena:characters:save', (_event, character: Character) =>
    wrapAsync(async () => persistCharacterWithAssets(appId, character))
  )

  ipcMain.removeHandler('arena:characters:delete')
  ipcMain.handle('arena:characters:delete', (_event, id: string) =>
    wrapAsync(async () => {
      if (!requireStore().deleteCharacter(id)) throw new Error('角色不存在')
      await deleteCharacterAssets(appId, id)
      return true
    })
  )

  ipcMain.removeHandler('arena:characters:duplicate')
  ipcMain.handle('arena:characters:duplicate', (_event, id: string) =>
    wrapAsync(async () => {
      const source = requireStore().getCharacter(id)
      if (!source) throw new Error('角色不存在')
      const copy: Character = {
        ...structuredClone(source),
        id: randomUUID(),
        name: `${source.name}（副本）`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        stats: { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null },
      }
      await duplicateCharacterAssets(appId, source.id, copy.id)
      return requireStore().saveCharacter(copy)
    })
  )

  ipcMain.removeHandler('arena:characters:materializeFromPack')
  ipcMain.handle('arena:characters:materializeFromPack', (_event, character: Character, packId: string, packCharacterId: string) =>
    wrapAsync(async () => materializeCharacterFromPack(appId, character, packId, packCharacterId))
  )

  ipcMain.removeHandler('arena:characters:writeAsset')
  ipcMain.handle(
    'arena:characters:writeAsset',
    (
      _event,
      characterId: string,
      slot: CharacterImageSlot,
      expressionId: CharacterExpressionId | null,
      dataUrl: string
    ) => wrapAsync(async () => writeCharacterAssetFile(appId, characterId, slot, expressionId || undefined, dataUrl))
  )

  ipcMain.removeHandler('arena:characters:exportPack')
  ipcMain.handle('arena:characters:exportPack', (_event, characterId: string, zipPath: string) =>
    wrapAsync(async () => {
      const character = requireStore().getCharacter(characterId)
      if (!character) throw new Error('角色不存在')
      await exportCharacterPack(appId, character, zipPath)
      return true
    })
  )

  ipcMain.removeHandler('arena:characters:importPack')
  ipcMain.handle('arena:characters:importPack', (_event, zipPath: string, characterId: string) =>
    wrapAsync(async () => importCharacterPackFromZip(appId, zipPath, characterId))
  )

  ipcMain.removeHandler('arena:characters:importLegacyJson')
  ipcMain.handle('arena:characters:importLegacyJson', (_event, filePath: string, characterId: string) =>
    wrapAsync(async () => {
      const content = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(content) as unknown
      if (!isCharacterExportPackage(parsed)) {
        throw new Error('不是有效的角色导出文件')
      }
      return importLegacyCharacterJson(appId, parsed as CharacterExportPackage, characterId)
    })
  )

  ipcMain.removeHandler('arena:matches:list')
  ipcMain.handle('arena:matches:list', () => wrap(() => requireStore().listMatches()))

  ipcMain.removeHandler('arena:matches:get')
  ipcMain.handle('arena:matches:get', (_event, id: string) =>
    wrap(() => {
      const match = requireStore().getMatch(id)
      if (!match) throw new Error('对局不存在')
      return match
    })
  )

  ipcMain.removeHandler('arena:matches:save')
  ipcMain.handle('arena:matches:save', (_event, match: Match) =>
    wrap(() => requireStore().saveMatch(match))
  )

  ipcMain.removeHandler('arena:matches:delete')
  ipcMain.handle('arena:matches:delete', (_event, id: string) =>
    wrap(() => {
      if (!requireStore().deleteMatch(id)) throw new Error('对局不存在')
      return true
    })
  )

  ipcMain.removeHandler('arena:snapshots:save')
  ipcMain.handle('arena:snapshots:save', (_event, snapshot: MatchSnapshot) =>
    wrap(() => requireStore().saveSnapshot(snapshot))
  )

  ipcMain.removeHandler('arena:snapshots:list')
  ipcMain.handle('arena:snapshots:list', (_event, matchId: string) =>
    wrap(() => requireStore().listSnapshots(matchId))
  )

  ipcMain.removeHandler('arena:snapshots:latest')
  ipcMain.handle('arena:snapshots:latest', (_event, matchId: string) =>
    wrap(() => requireStore().getLatestSnapshot(matchId))
  )

  ipcMain.removeHandler('arena:settings:get')
  ipcMain.handle('arena:settings:get', () => wrap(() => requireStore().getSettings()))

  ipcMain.removeHandler('arena:settings:save')
  ipcMain.handle('arena:settings:save', (_event, settings: Partial<ArenaSettings>) =>
    wrap(() => requireStore().saveSettings(settings))
  )

  ipcMain.removeHandler('arena:logs:append')
  ipcMain.handle('arena:logs:append', (_event, entry: Omit<ArenaLogEntry, 'id' | 'createdAt'>) =>
    wrap(() => requireStore().appendLog(entry))
  )

  ipcMain.removeHandler('arena:logs:list')
  ipcMain.handle('arena:logs:list', (_event, limit?: number) =>
    wrap(() => requireStore().listLogs(limit ?? 100))
  )

  ipcMain.removeHandler('arena:store:export')
  ipcMain.handle('arena:store:export', () => wrap(() => requireStore().getSnapshot()))

  ipcMain.removeHandler('arena:store:stats')
  ipcMain.handle('arena:store:stats', () => wrap(() => requireStore().getStats()))

  ipcMain.removeHandler('arena:store:clearMatches')
  ipcMain.handle('arena:store:clearMatches', () =>
    wrap(() => {
      requireStore().clearMatches()
      return true
    })
  )

  ipcMain.removeHandler('arena:store:clearLogs')
  ipcMain.handle('arena:store:clearLogs', () =>
    wrap(() => {
      requireStore().clearLogs()
      return true
    })
  )

  ipcMain.removeHandler('arena:store:pruneExpired')
  ipcMain.handle('arena:store:pruneExpired', (_event, retentionDays: number) =>
    wrap(() => requireStore().pruneExpiredData(retentionDays))
  )

  ipcMain.removeHandler('arena:store:factoryReset')
  ipcMain.handle('arena:store:factoryReset', async () =>
    wrapAsync(async () => {
      requireStore().factoryReset()
      await requireStore().flush()
      return requireStore().getStats()
    })
  )

  ipcMain.removeHandler('arena:gameModes:getOverrides')
  ipcMain.handle('arena:gameModes:getOverrides', () => wrap(() => requireStore().getGameModeOverrides()))

  ipcMain.removeHandler('arena:gameModes:saveOverride')
  ipcMain.handle('arena:gameModes:saveOverride', (_event, modeId: string, override: GameModeOverride) =>
    wrap(() => requireStore().saveGameModeOverride(modeId, override))
  )

  ipcMain.removeHandler('arena:gameModes:clearOverride')
  ipcMain.handle('arena:gameModes:clearOverride', (_event, modeId: string) =>
    wrap(() => requireStore().clearGameModeOverride(modeId))
  )

  ipcMain.removeHandler('arena:gameModes:listCustom')
  ipcMain.handle('arena:gameModes:listCustom', () => wrap(() => requireStore().listCustomGameModes()))

  ipcMain.removeHandler('arena:gameModes:saveCustom')
  ipcMain.handle('arena:gameModes:saveCustom', (_event, mode: import('@shared/arena/types').GameMode) =>
    wrap(() => requireStore().saveCustomGameMode(mode))
  )

  ipcMain.removeHandler('arena:gameModes:deleteCustom')
  ipcMain.handle('arena:gameModes:deleteCustom', (_event, modeId: string) =>
    wrap(() => requireStore().deleteCustomGameMode(modeId))
  )

  ipcMain.removeHandler('arena:scenarios:getData')
  ipcMain.handle('arena:scenarios:getData', () => wrap(() => requireStore().getScenarioData()))

  ipcMain.removeHandler('arena:scenarios:saveCustom')
  ipcMain.handle('arena:scenarios:saveCustom', (_event, scenario: import('@shared/arena/game-scenario').GameScenarioDefinition) =>
    wrap(() => requireStore().saveCustomScenario(scenario))
  )

  ipcMain.removeHandler('arena:scenarios:clearCustom')
  ipcMain.handle('arena:scenarios:clearCustom', (_event, scenarioId: string) =>
    wrap(() => requireStore().clearCustomScenario(scenarioId))
  )

  ipcMain.removeHandler('arena:promptPacks:saveCustom')
  ipcMain.handle('arena:promptPacks:saveCustom', (_event, pack: import('@shared/arena/game-scenario').PromptPack) =>
    wrap(() => requireStore().saveCustomPromptPack(pack))
  )

  ipcMain.removeHandler('arena:behaviorChanges:list')
  ipcMain.handle('arena:behaviorChanges:list', () => wrap(() => requireStore().listBehaviorChanges()))

  ipcMain.removeHandler('arena:behaviorChanges:append')
  ipcMain.handle('arena:behaviorChanges:append', (_event, record: import('@shared/arena/types').BehaviorChangeRecord) =>
    wrap(() => requireStore().appendBehaviorChange(record))
  )

  ipcMain.removeHandler('arena:behaviorChanges:update')
  ipcMain.handle('arena:behaviorChanges:update', (_event, record: import('@shared/arena/types').BehaviorChangeRecord) =>
    wrap(() => requireStore().updateBehaviorChange(record))
  )

  ipcMain.removeHandler('arena:characterChat:list')
  ipcMain.handle('arena:characterChat:list', (_event, characterId: string) =>
    wrap(() => requireStore().listCharacterChat(characterId))
  )

  ipcMain.removeHandler('arena:characterChat:append')
  ipcMain.handle('arena:characterChat:append', (_event, characterId: string, message: import('@shared/arena/types').CharacterChatMessage) =>
    wrap(() => requireStore().appendCharacterChat(characterId, message))
  )

  ipcMain.removeHandler('arena:characterChat:clear')
  ipcMain.handle('arena:characterChat:clear', (_event, characterId: string) =>
    wrap(() => {
      requireStore().clearCharacterChat(characterId)
      return true
    })
  )

  ipcMain.removeHandler('arena:characterGrowth:list')
  ipcMain.handle('arena:characterGrowth:list', (_event, characterId: string) =>
    wrap(() => requireStore().listCharacterGrowth(characterId))
  )

  ipcMain.removeHandler('arena:characterGrowth:append')
  ipcMain.handle('arena:characterGrowth:append', (_event, record: import('@shared/arena/types').CharacterGrowthRecord) =>
    wrap(() => requireStore().appendCharacterGrowth(record))
  )

  ipcMain.removeHandler('arena:characterGrowthSnapshots:list')
  ipcMain.handle('arena:characterGrowthSnapshots:list', (_event, characterId: string) =>
    wrap(() => requireStore().listCharacterGrowthSnapshots(characterId))
  )

  ipcMain.removeHandler('arena:characterGrowthSnapshots:append')
  ipcMain.handle('arena:characterGrowthSnapshots:append', (_event, snapshot: import('@shared/arena/types').CharacterGrowthSnapshot) =>
    wrap(() => requireStore().appendCharacterGrowthSnapshot(snapshot))
  )

  ipcMain.removeHandler('arena:lineups:list')
  ipcMain.handle('arena:lineups:list', () => wrap(() => requireStore().listLineups()))

  ipcMain.removeHandler('arena:lineups:save')
  ipcMain.handle('arena:lineups:save', (_event, lineup: import('@shared/arena/types').CharacterLineup) =>
    wrap(() => requireStore().saveLineup(lineup))
  )

  ipcMain.removeHandler('arena:lineups:delete')
  ipcMain.handle('arena:lineups:delete', (_event, id: string) => wrap(() => requireStore().deleteLineup(id)))

  ipcMain.removeHandler('arena:lineups:getActiveId')
  ipcMain.handle('arena:lineups:getActiveId', () => wrap(() => requireStore().getActiveLineupId()))

  ipcMain.removeHandler('arena:lineups:setActiveId')
  ipcMain.handle('arena:lineups:setActiveId', (_event, id: string | null) =>
    wrap(() => requireStore().setActiveLineupId(id))
  )

  ipcMain.removeHandler('arena:lineupGrowth:list')
  ipcMain.handle('arena:lineupGrowth:list', (_event, lineupId: string) =>
    wrap(() => requireStore().listLineupGrowth(lineupId))
  )

  ipcMain.removeHandler('arena:lineupGrowth:append')
  ipcMain.handle('arena:lineupGrowth:append', (_event, record: import('@shared/arena/types').LineupGrowthRecord) =>
    wrap(() => requireStore().appendLineupGrowth(record))
  )

  ipcMain.removeHandler('arena:gameModeQA:list')
  ipcMain.handle('arena:gameModeQA:list', (_event, gameModeId: string) =>
    wrap(() => requireStore().listGameModeQA(gameModeId))
  )

  ipcMain.removeHandler('arena:gameModeQA:append')
  ipcMain.handle('arena:gameModeQA:append', (_event, gameModeId: string, message: import('@shared/arena/types').CharacterChatMessage) =>
    wrap(() => requireStore().appendGameModeQA(gameModeId, message))
  )

  ipcMain.removeHandler('arena:gameModeQA:clear')
  ipcMain.handle('arena:gameModeQA:clear', (_event, gameModeId: string) =>
    wrap(() => {
      requireStore().clearGameModeQA(gameModeId)
      return true
    })
  )

  ipcMain.removeHandler('arena:helpChat:list')
  ipcMain.handle('arena:helpChat:list', () => wrap(() => requireStore().listHelpChat()))

  ipcMain.removeHandler('arena:helpChat:append')
  ipcMain.handle('arena:helpChat:append', (_event, message: import('@shared/arena/types').CharacterChatMessage) =>
    wrap(() => requireStore().appendHelpChat(message))
  )

  ipcMain.removeHandler('arena:helpChat:clear')
  ipcMain.handle('arena:helpChat:clear', () =>
    wrap(() => {
      requireStore().clearHelpChat()
      return true
    })
  )
}

export async function flushArenaStore(): Promise<void> {
  await store?.flush()
}

export function getArenaStore(): ArenaStore | null {
  return store
}
