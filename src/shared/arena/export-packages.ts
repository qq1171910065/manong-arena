import type { Character } from './types'

export interface CharacterExportPackage {
  kind: typeof CHARACTER_EXPORT_KIND
  version: 1
  exportedAt: string
  character: Character
}

export const CHARACTER_EXPORT_KIND = 'agent-arena/character-v1' as const
export const GAME_MODE_EXPORT_KIND = 'agent-arena/game-mode-v1' as const
export const GAME_MODE_PACK_EXPORT_KIND = 'agent-arena/game-mode-pack-v2' as const

export interface GameModeAssetManifest {
  packId: string
  modeId: string
  slots: Array<{
    slot: 'mode-cover' | 'match-banner'
    fileName: string
    /** 素材包内相对路径：{packId}/{modeId}/{fileName} */
    relativePath: string
  }>
}

export interface GameModeExportPackage {
  kind: typeof GAME_MODE_EXPORT_KIND | typeof GAME_MODE_PACK_EXPORT_KIND
  version: 1 | 2
  exportedAt: string
  isBuiltin?: boolean
  mode: import('./types').GameMode
  override?: import('./types').GameModeOverride
  scenario: import('./game-scenario').GameScenarioDefinition
  promptPacks: import('./game-scenario').PromptPack[]
  assets?: GameModeAssetManifest
}

export function isCharacterExportPackage(value: unknown): value is CharacterExportPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as Partial<CharacterExportPackage>
  return pkg.kind === CHARACTER_EXPORT_KIND && pkg.version === 1 && Boolean(pkg.character?.name)
}

export function isGameModeExportPackage(value: unknown): value is GameModeExportPackage {
  if (!value || typeof value !== 'object') return false
  const pkg = value as Partial<GameModeExportPackage>
  const kind = pkg.kind
  const validKind = kind === GAME_MODE_EXPORT_KIND || kind === GAME_MODE_PACK_EXPORT_KIND
  return (
    validKind &&
    (pkg.version === 1 || pkg.version === 2) &&
    Boolean(pkg.mode?.id && pkg.mode?.name) &&
    Boolean(pkg.scenario?.id)
  )
}

export function isUserGameModeId(modeId: string): boolean {
  return modeId.startsWith('user-mode-')
}
