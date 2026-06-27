import { BUILTIN_GAME_MODES } from '@shared/arena/constants'
import { createUserGameModeBundle } from '@shared/arena/custom-game-mode-factory'
import {
  GAME_MODE_EXPORT_KIND,
  isCharacterExportPackage,
  isGameModeExportPackage,
  isUserGameModeId,
  type GameModeExportPackage,
} from '@shared/arena/export-packages'
import { randomUUID } from '@renderer/utils/id'
import { normalizeCharacterVisuals } from '@shared/arena/character-visuals'
import { arenaInvoke, ensureArenaReady } from './client'
import { ArenaError } from './errors'
import { characterService, createEmptyCharacter, gameModeService, loadGameModeOverrides } from './character-service'
import { gameScenarioService, loadGameScenarios } from './game-scenario-service'
import type { PromptPack } from '@shared/arena/game-scenario'
import type { Character, GameMode } from '@shared/arena/types'
import type { CreateUserGameModeInput } from '@shared/arena/custom-game-mode-factory'
import { parseJsonFile, pickCharacterExportPath, pickCharacterImportFile, pickJsonFile, saveJsonFile } from '@renderer/utils/portable-file'

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '-').trim() || 'export'
}

function remapImportedUserMode(pkg: GameModeExportPackage): GameModeExportPackage {
  const modeId = `user-mode-${randomUUID()}`
  const scenarioId = `user-scenario-${randomUUID()}`
  const packId = `user-pack-${randomUUID()}`
  const now = new Date().toISOString()

  const mode: GameMode = {
    ...structuredClone(pkg.mode),
    id: modeId,
    scenarioId,
  }

  const scenario = {
    ...structuredClone(pkg.scenario),
    id: scenarioId,
    gameModeId: modeId,
    defaultPromptPackId: packId,
    isBuiltin: false,
    updatedAt: now,
  }

  const promptPacks: PromptPack[] = pkg.promptPacks.map((pack) => ({
    ...structuredClone(pack),
    id: pack.id === pkg.scenario.defaultPromptPackId ? packId : `user-pack-${randomUUID()}`,
    scenarioId,
    isBuiltin: false,
    updatedAt: now,
    createdAt: pack.createdAt || now,
  }))

  if (!promptPacks.some((pack) => pack.id === packId)) {
    const fallback = createUserGameModeBundle({ name: mode.name }).promptPack
    fallback.id = packId
    fallback.scenarioId = scenarioId
    fallback.isBuiltin = false
    promptPacks.unshift(fallback)
  }

  scenario.defaultPromptPackId = packId

  return {
    kind: GAME_MODE_EXPORT_KIND,
    version: 1,
    exportedAt: now,
    mode,
    override: pkg.override,
    scenario,
    promptPacks,
  }
}

async function persistImportedGameMode(pkg: GameModeExportPackage): Promise<GameMode> {
  await ensureArenaReady()

  for (const pack of pkg.promptPacks) {
    await gameScenarioService.saveCustomPromptPack(pack)
  }
  await gameScenarioService.saveCustomScenario(pkg.scenario)

  if (isUserGameModeId(pkg.mode.id)) {
    const saved = await arenaInvoke('storage', 'saveCustomGameMode', () => window.api.saveCustomGameMode(pkg.mode))
    if (pkg.override && Object.keys(pkg.override).length) {
      await gameModeService.saveOverride(saved.id, pkg.override)
    }
    await loadGameModeOverrides()
    await loadGameScenarios()
    return gameModeService.get(saved.id) || saved
  }

  const builtin = BUILTIN_GAME_MODES.find((mode) => mode.id === pkg.mode.id)
  if (!builtin) {
    throw new ArenaError('VALIDATION', '无法导入：目标玩法不存在', 'match')
  }

  if (!gameModeService.get(pkg.mode.id)) {
    await arenaInvoke('storage', 'seedStarterGameMode', () => window.api.seedStarterGameMode(pkg.mode.id))
    await loadGameModeOverrides()
  }

  if (pkg.override && Object.keys(pkg.override).length) {
    await gameModeService.saveOverride(pkg.mode.id, pkg.override)
  }
  await loadGameModeOverrides()
  await loadGameScenarios()
  return gameModeService.get(pkg.mode.id) || builtin
}

function finalizeImportedCharacter(imported: Character): Character {
  const now = new Date().toISOString()
  return normalizeCharacterVisuals({
    ...imported,
    stats: { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null },
    gameSkills: (imported.gameSkills || []).map((skill) => ({
      ...skill,
      learned: false,
      examPassed: false,
      examBypassed: false,
      learnedAt: null,
      examPassedAt: null,
    })),
    createdAt: now,
    updatedAt: now,
  })
}

export const portableDataService = {
  async exportCharacter(characterId: string): Promise<void> {
    const character = await characterService.get(characterId)
    const defaultName = `${sanitizeFileName(character.name)}.arena-character.zip`
    if (!window.api.exportCharacterPack) {
      throw new ArenaError('VALIDATION', '当前环境不支持角色包导出', 'character')
    }
    const zipPath = await pickCharacterExportPath(defaultName)
    if (!zipPath) return
    await arenaInvoke('storage', 'exportCharacterPack', () => window.api.exportCharacterPack(characterId, zipPath))
  },

  async importCharacter(): Promise<Character | null> {
    const picked = await pickCharacterImportFile()
    if (!picked) return null

    const lower = picked.name.toLowerCase()
    const characterId = randomUUID()

    if (lower.endsWith('.zip')) {
      if (!window.api.importCharacterPack) {
        throw new ArenaError('VALIDATION', '当前环境不支持角色包导入', 'character')
      }
      const imported = await arenaInvoke('storage', 'importCharacterPack', () =>
        window.api.importCharacterPack(picked.path, characterId)
      )
      return characterService.save(finalizeImportedCharacter(imported))
    }

    if (window.api.importLegacyCharacterJson) {
      const imported = await arenaInvoke('storage', 'importLegacyJson', () =>
        window.api.importLegacyCharacterJson(picked.path, characterId)
      )
      return characterService.save(finalizeImportedCharacter(imported))
    }

    const read = await window.api.readTextFile!(picked.path)
    if (!read.success || read.content == null) {
      throw new ArenaError('VALIDATION', read.error || '读取文件失败', 'character')
    }

    let parsed: unknown
    try {
      parsed = parseJsonFile<unknown>(read.content)
    } catch {
      throw new ArenaError('VALIDATION', '文件不是有效的 JSON', 'character')
    }
    if (!isCharacterExportPackage(parsed)) {
      throw new ArenaError('VALIDATION', '不是有效的角色导出文件', 'character')
    }

    const normalized = finalizeImportedCharacter(
      normalizeCharacterVisuals({
        ...createEmptyCharacter(),
        ...structuredClone(parsed.character),
        id: characterId,
      })
    )
    return characterService.save(normalized)
  },

  async exportGameMode(modeId: string): Promise<void> {
    await loadGameModeOverrides()
    await loadGameScenarios()

    const mode = gameModeService.get(modeId)
    if (!mode) throw new ArenaError('NOT_FOUND', '玩法不存在', 'match')

    const scenario = gameScenarioService.getByGameModeId(modeId)
    if (!scenario) throw new ArenaError('NOT_FOUND', '玩法场景不存在', 'match')

    const promptPacks = gameScenarioService.listPromptPacks(scenario.id).filter((pack) => !pack.isBuiltin)
    const overrides = await arenaInvoke('storage', 'getGameModeOverrides', () => window.api.getGameModeOverrides())
    const override = overrides[modeId]

    const payload: GameModeExportPackage = {
      kind: GAME_MODE_EXPORT_KIND,
      version: 1,
      exportedAt: new Date().toISOString(),
      mode: structuredClone(mode),
      override: override ? structuredClone(override) : undefined,
      scenario: structuredClone(scenario),
      promptPacks: promptPacks.length ? structuredClone(promptPacks) : [],
    }

    await saveJsonFile(`${sanitizeFileName(mode.name)}.arena-mode.json`, payload)
  },

  async importGameMode(): Promise<GameMode | null> {
    const picked = await pickJsonFile()
    if (!picked) return null

    let parsed: unknown
    try {
      parsed = parseJsonFile<unknown>(picked.content)
    } catch {
      throw new ArenaError('VALIDATION', '文件不是有效的 JSON', 'match')
    }
    if (!isGameModeExportPackage(parsed)) {
      throw new ArenaError('VALIDATION', '不是有效的玩法导出文件', 'match')
    }

    const needsRemap =
      isUserGameModeId(parsed.mode.id) ||
      Boolean(gameModeService.get(parsed.mode.id)) ||
      !BUILTIN_GAME_MODES.some((mode) => mode.id === parsed.mode.id)

    const pkg = needsRemap ? remapImportedUserMode(parsed) : parsed
    return persistImportedGameMode(pkg)
  },

  async createCustomGameMode(input: CreateUserGameModeInput): Promise<GameMode> {
    const bundle = createUserGameModeBundle(input)
    await gameScenarioService.saveCustomScenario(bundle.scenario)
    await gameScenarioService.saveCustomPromptPack(bundle.promptPack)
    const saved = await arenaInvoke('storage', 'saveCustomGameMode', () => window.api.saveCustomGameMode(bundle.mode))
    await loadGameModeOverrides()
    await loadGameScenarios()
    return gameModeService.get(saved.id) || saved
  },

  async deleteCustomGameMode(modeId: string): Promise<void> {
    if (!isUserGameModeId(modeId)) {
      throw new ArenaError('VALIDATION', '仅可删除自建玩法', 'match')
    }
    await arenaInvoke('storage', 'deleteCustomGameMode', () => window.api.deleteCustomGameMode(modeId))
    await loadGameModeOverrides()
    await loadGameScenarios()
  },
}

export type { CreateUserGameModeInput }
