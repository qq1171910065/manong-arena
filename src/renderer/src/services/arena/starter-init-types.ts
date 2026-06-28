import type { AssetPackProgressPayload } from '@shared/arena/initial-assets'
import type { StarterInitStep } from './starter-init-steps'

export interface StarterInitProgress {
  index: number
  total: number
  label: string
  percent: number
  step: StarterInitStep | null
  assetPhase?: AssetPackProgressPayload['phase']
}
