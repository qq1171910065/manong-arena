import {

  STARTER_CHARACTER_LABELS,

  STARTER_CHARACTER_MODEL_IDS,

} from '@shared/arena/starter-characters'

import {

  STARTER_GAME_MODE_IDS,

  STARTER_GAME_MODE_LABELS,

} from '@shared/arena/starter-game-modes'

import type { AssetPackProgressPayload } from '@shared/arena/initial-assets'

import { arenaInvoke, ensureArenaReady } from './client'

import { dataManagementService } from './data-management-service'

import { ensureInitialAssets, isInitialAssetsReady } from './asset-pack-service'



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



export interface StarterInitProgress {

  index: number

  total: number

  label: string

  percent: number

  step: StarterInitStep | null

  assetPhase?: AssetPackProgressPayload['phase']

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

  onProgress: (progress: StarterInitProgress) => void

): Promise<void> {

  await ensureArenaReady()



  for (let index = 0; index < STARTER_INIT_TOTAL; index += 1) {

    const step = STARTER_INIT_STEPS[index]

    onProgress({

      index,

      total: STARTER_INIT_TOTAL,

      label: step.label,

      percent: Math.round((index / STARTER_INIT_TOTAL) * 100),

      step,

    })



    if (step.kind === 'assets') {

      await ensureInitialAssets((assetProgress) => {

        onProgress({

          index,

          total: STARTER_INIT_TOTAL,

          label: assetProgress.label || step.label,

          percent: Math.max(

            Math.round((index / STARTER_INIT_TOTAL) * 100),

            Math.min(99, assetProgress.percent ?? 0)

          ),

          step,

          assetPhase: assetProgress.phase,

        })

      })

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



export {

  STARTER_CHARACTER_MODEL_IDS,

  STARTER_CHARACTER_LABELS,

  STARTER_GAME_MODE_IDS,

  STARTER_GAME_MODE_LABELS,

}


