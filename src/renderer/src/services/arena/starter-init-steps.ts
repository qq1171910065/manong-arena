import {
  STARTER_CHARACTER_LABELS,
  STARTER_CHARACTER_MODEL_IDS,
} from '@shared/arena/starter-characters'
import {
  STARTER_GAME_MODE_IDS,
  STARTER_GAME_MODE_LABELS,
} from '@shared/arena/starter-game-modes'

export type StarterInitStep =
  | { kind: 'assets'; id: string; label: string }
  | { kind: 'character'; id: string; label: string }
  | { kind: 'gameMode'; id: string; label: string }

export const STARTER_INIT_STEPS: StarterInitStep[] = [
  { kind: 'assets', id: 'initial', label: '初始素材包' },
  ...STARTER_CHARACTER_MODEL_IDS.map((id) => ({
    kind: 'character' as const,
    id,
    label: STARTER_CHARACTER_LABELS[id],
  })),
  ...STARTER_GAME_MODE_IDS.map((id) => ({
    kind: 'gameMode' as const,
    id,
    label: STARTER_GAME_MODE_LABELS[id],
  })),
]

export const STARTER_INIT_TOTAL = STARTER_INIT_STEPS.length

export {
  STARTER_CHARACTER_MODEL_IDS,
  STARTER_CHARACTER_LABELS,
  STARTER_GAME_MODE_IDS,
  STARTER_GAME_MODE_LABELS,
}
