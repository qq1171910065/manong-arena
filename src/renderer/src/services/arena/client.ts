import { arenaLog } from './logger'
import { ArenaError, toArenaError } from './errors'
import type { ArenaResult } from '@shared/arena/types'

export async function arenaInvoke<T>(
  scope: Parameters<typeof arenaLog>[1],
  action: string,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const data = await fn()
    await arenaLog('debug', scope, `${action} 成功`)
    return data
  } catch (error) {
    const arenaError = toArenaError(error, scope)
    await arenaLog('error', scope, `${action} 失败`, arenaError.message)
    throw arenaError
  }
}

export function assertOk<T>(result: ArenaResult<T>, code = 'INTERNAL'): T {
  if (!result.ok || result.data === undefined) {
    throw new ArenaError(result.code || code, result.error || '操作失败')
  }
  return result.data
}

export async function ensureArenaReady(): Promise<void> {
  if (typeof window.api?.arenaInit !== 'function') {
    throw new ArenaError('INTERNAL', 'Arena 存储接口不可用', 'storage')
  }
  await window.api.arenaInit()
}
