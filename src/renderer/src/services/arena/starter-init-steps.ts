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
  | { kind: 'initData'; id: string; label: string }

export const STARTER_INIT_STEPS: StarterInitStep[] = [
  { kind: 'assets', id: 'initial', label: '初始素材包' },
  { kind: 'initData', id: 'starter-bundle', label: '导入初始化数据' },
]

export const STARTER_INIT_TOTAL = STARTER_INIT_STEPS.length

export {
  STARTER_CHARACTER_MODEL_IDS,
  STARTER_CHARACTER_LABELS,
  STARTER_GAME_MODE_IDS,
  STARTER_GAME_MODE_LABELS,
}
