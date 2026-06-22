import { randomUUID } from 'node:crypto'
import { ipcMain } from 'electron'
import { ArenaStore, fail, ok } from './store'
import { seedDefaultCharacters } from './seed'
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

export function registerArenaHandlers(appId: string): void {
  store = new ArenaStore(appId)
  seedDefaultCharacters(store)

  ipcMain.removeHandler('arena:init')
  ipcMain.handle('arena:init', async () =>
    wrapAsync(async () => {
      seedDefaultCharacters(requireStore())
      await requireStore().flush()
      return requireStore().getSnapshot()
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
    wrap(() => requireStore().saveCharacter(character))
  )

  ipcMain.removeHandler('arena:characters:delete')
  ipcMain.handle('arena:characters:delete', (_event, id: string) =>
    wrap(() => {
      if (!requireStore().deleteCharacter(id)) throw new Error('角色不存在')
      return true
    })
  )

  ipcMain.removeHandler('arena:characters:duplicate')
  ipcMain.handle('arena:characters:duplicate', (_event, id: string) =>
    wrap(() => {
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
      return requireStore().saveCharacter(copy)
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
}

export async function flushArenaStore(): Promise<void> {
  await store?.flush()
}

export function getArenaStore(): ArenaStore | null {
  return store
}
