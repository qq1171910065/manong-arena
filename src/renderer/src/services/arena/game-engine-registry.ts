import type { GameMode } from '@shared/arena/types'
import type { GameEngineKind } from '@shared/arena/game-scenario'
import { isBuiltinPlayableModeId } from '@shared/arena/builtin-game-mode-registry'
import { isDiscussionEngineMode, isRoundtableMode } from './roundtable-engine'
import { isUndercoverMode } from './undercover-engine'

export function resolveEngineKind(mode: GameMode): GameEngineKind {
  if (mode.engineKind) return mode.engineKind
  if (mode.id === 'werewolf') return 'werewolf'
  if (mode.id === 'roundtable') return 'roundtable'
  if (mode.id.startsWith('brainstorm-')) return 'brainstorm'
  if (mode.id === 'undercover') return 'undercover'
  return 'prompt-only'
}

export function isModePlayable(mode: GameMode): boolean {
  const kind = resolveEngineKind(mode)
  if (kind === 'werewolf' || kind === 'roundtable' || kind === 'brainstorm' || kind === 'undercover') {
    return true
  }
  if (isBuiltinPlayableModeId(mode.id)) return true
  return mode.id.startsWith('user-mode-')
}

export function getDetailPageKind(mode: GameMode): 'werewolf' | 'roundtable' | 'brainstorm' | 'undercover' | 'generic' {
  if (mode.id === 'werewolf' || mode.engineKind === 'werewolf') return 'werewolf'
  if (isUndercoverMode(mode)) return 'undercover'
  if (mode.engineKind === 'brainstorm' || mode.id.startsWith('brainstorm-')) return 'brainstorm'
  if (isRoundtableMode(mode)) return 'roundtable'
  if (isDiscussionEngineMode(mode)) return 'roundtable'
  return 'generic'
}

export { isRoundtableMode, isDiscussionEngineMode } from './roundtable-engine'
