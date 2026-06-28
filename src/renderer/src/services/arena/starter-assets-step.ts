import type { StarterInitProgress } from './starter-init-types'
import { StarterAssetFetchError } from './starter-asset-errors'
import { installAssetPackFromFile, installBundledMinimalAssets } from './asset-pack-service'
import { STARTER_INIT_TOTAL } from './starter-init-steps'

export async function runStarterAssetsStep(
  onProgress: (progress: StarterInitProgress) => void,
  index: number,
  label: string
): Promise<void> {
  const step = { kind: 'assets' as const, id: 'initial', label }

  onProgress({
    index,
    total: STARTER_INIT_TOTAL,
    label,
    percent: Math.round((index / STARTER_INIT_TOTAL) * 100),
    step,
  })

  const unsubscribe = window.api.onAssetPackProgress?.((assetProgress) => {
    onProgress({
      index,
      total: STARTER_INIT_TOTAL,
      label: assetProgress.label || label,
      percent: Math.max(
        Math.round((index / STARTER_INIT_TOTAL) * 100),
        Math.min(99, assetProgress.percent ?? 0)
      ),
      step,
      assetPhase: assetProgress.phase,
    })
  })

  try {
    if (typeof window.api?.ensureInitialAssets !== 'function') {
      await installBundledMinimalAssets()
      return
    }
    const result = await window.api.ensureInitialAssets()
    if (result?.ok || result?.skipped) return
    throw new StarterAssetFetchError(result?.error || '无法获取线上完整素材包')
  } finally {
    unsubscribe?.()
  }
}

export async function skipStarterAssetsWithBundled(
  onProgress: (progress: StarterInitProgress) => void,
  index: number,
  label: string
): Promise<void> {
  await installBundledMinimalAssets((assetProgress) => {
    onProgress({
      index,
      total: STARTER_INIT_TOTAL,
      label: assetProgress.label || label,
      percent: Math.max(
        Math.round((index / STARTER_INIT_TOTAL) * 100),
        Math.min(99, assetProgress.percent ?? 0)
      ),
      step: { kind: 'assets', id: 'initial', label },
      assetPhase: assetProgress.phase,
    })
  })
}

export async function importStarterAssetsFromZip(
  onProgress: (progress: StarterInitProgress) => void,
  index: number,
  label: string
): Promise<void> {
  try {
    await installAssetPackFromFile((assetProgress) => {
      onProgress({
        index,
        total: STARTER_INIT_TOTAL,
        label: assetProgress.label || label,
        percent: Math.max(
          Math.round((index / STARTER_INIT_TOTAL) * 100),
          Math.min(99, assetProgress.percent ?? 0)
        ),
        step: { kind: 'assets', id: 'initial', label },
        assetPhase: assetProgress.phase,
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'CANCELED') {
      throw new StarterAssetFetchError('已取消导入素材包')
    }
    throw error
  }
}

export { StarterAssetFetchError } from './starter-asset-errors'
