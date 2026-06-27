import type { Character, GameMode, GameModeOverride } from './types'
import type { GameScenarioDefinition, PromptPack } from './game-scenario'

export const CHARACTER_EXPORT_KIND = 'agent-arena/character-v1' as const
export const GAME_MODE_EXPORT_KIND = 'agent-arena/game-mode-v1' as const

export interface CharacterExportPackage {
  kind: typeof CHARACTER_EXPORT_KIND
  version: 1
  exportedAt: string
  character: Character
}

export interface GameModeExportPackage {
  kind: typeof GAME_MODE_EXPORT_KIND
  version: 1
  exportedAt: string
  mode: GameMode
  override?: GameModeOverride
  scenario: GameScenarioDefinition
  promptPacks: PromptPack[]
}

export function isCharacterExportPackage(value: unknown): value is CharacterExportPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as Partial<CharacterExportPackage>
  return pkg.kind === CHARACTER_EXPORT_KIND && pkg.version === 1 && Boolean(pkg.character?.name)
}

export function isGameModeExportPackage(value: unknown): value is GameModeExportPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as Partial<GameModeExportPackage>
  return (
    pkg.kind === GAME_MODE_EXPORT_KIND &&
    pkg.version === 1 &&
    Boolean(pkg.mode?.id && pkg.mode?.name) &&
    Boolean(pkg.scenario?.id)
  )
}

export function isUserGameModeId(modeId: string): boolean {
  return modeId.startsWith('user-mode-')
}
