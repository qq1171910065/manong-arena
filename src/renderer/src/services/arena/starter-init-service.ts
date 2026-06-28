import { arenaInvoke, ensureArenaReady } from './client'
import { dataManagementService } from './data-management-service'
import { isInitialAssetsReady } from './asset-pack-service'
import { runStarterAssetsStep } from './starter-assets-step'
import { StarterAssetFetchError } from './starter-asset-errors'
import { STARTER_INIT_STEPS, STARTER_INIT_TOTAL } from './starter-init-steps'
import type { StarterInitProgress } from './starter-init-types'

export type { StarterInitStep } from './starter-init-steps'
export type { StarterInitProgress } from './starter-init-types'
export {
  STARTER_INIT_STEPS,
  STARTER_INIT_TOTAL,
  STARTER_CHARACTER_MODEL_IDS,
  STARTER_CHARACTER_LABELS,
  STARTER_GAME_MODE_IDS,
  STARTER_GAME_MODE_LABELS,
} from './starter-init-steps'
export { StarterAssetFetchError } from './starter-asset-errors'

export interface RunStarterInitOptions {
  startIndex?: number
  skipAssets?: boolean
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export async function needsStarterInit(): Promise<boolean> {
  await ensureArenaReady()
  const [stats, assetsReady] = await Promise.all([
    dataManagementService.getStats(),
    isInitialAssetsReady(),
  ])
  return (
    !assetsReady ||
    !stats.seededAt ||
    stats.characterCount === 0 ||
    stats.installedGameModeCount === 0
  )
}

export async function runStarterInit(
  onProgress: (progress: StarterInitProgress) => void,
  options: RunStarterInitOptions = {}
): Promise<void> {
  await ensureArenaReady()

  const startIndex = options.startIndex ?? 0

  for (let index = startIndex; index < STARTER_INIT_TOTAL; index += 1) {
    const step = STARTER_INIT_STEPS[index]
    onProgress({
      index,
      total: STARTER_INIT_TOTAL,
      label: step.label,
      percent: Math.round((index / STARTER_INIT_TOTAL) * 100),
      step,
    })

    if (step.kind === 'assets') {
      if (options.skipAssets) {
        await sleep(80)
        continue
      }
      try {
        await runStarterAssetsStep(onProgress, index, step.label)
      } catch (error) {
        if (error instanceof StarterAssetFetchError) throw error
        throw new StarterAssetFetchError(
          error instanceof Error ? error.message : '初始素材准备失败'
        )
      }
    } else if (step.kind === 'character') {
      await arenaInvoke('storage', 'seedStarterCharacter', () =>
        window.api.seedStarterCharacter(step.id)
      )
    } else {
      await arenaInvoke('storage', 'seedStarterGameMode', () =>
        window.api.seedStarterGameMode(step.id)
      )
    }

    await sleep(step.kind === 'assets' ? 120 : 280)
  }

  onProgress({
    index: STARTER_INIT_TOTAL,
    total: STARTER_INIT_TOTAL,
    label: '完成',
    percent: 100,
    step: null,
  })

  await arenaInvoke('storage', 'finalizeStarterInit', () => window.api.finalizeStarterInit())
  await sleep(400)
}
