import type { GameMode } from '@shared/arena/types'
import type { GameEngineKind } from '@shared/arena/game-scenario'
import { isRoundtableMode } from './roundtable-engine'

export function resolveEngineKind(mode: GameMode): GameEngineKind {
  if (mode.engineKind) return mode.engineKind
  if (mode.id === 'werewolf') return 'werewolf'
  if (mode.id === 'roundtable') return 'roundtable'
  return 'prompt-only'
}

export function isModePlayable(mode: GameMode): boolean {
  const kind = resolveEngineKind(mode)
  if (kind === 'werewolf' || kind === 'roundtable') return true
  return mode.id.startsWith('user-mode-')
}

export function getDetailPageKind(mode: GameMode): 'werewolf' | 'roundtable' | 'generic' {
  if (mode.id === 'werewolf' || mode.engineKind === 'werewolf') return 'werewolf'
  if (isRoundtableMode(mode)) return 'roundtable'
  return 'generic'
}
