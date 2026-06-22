import type { ArenaLogEntry, LogLevel, LogScope } from '@shared/arena/types'

function hasArenaApi(): boolean {
  return typeof window.api?.appendLog === 'function'
}

export async function arenaLog(
  level: LogLevel,
  scope: LogScope,
  message: string,
  detail?: string,
  meta?: { matchId?: string; characterId?: string }
): Promise<void> {
  const prefix = `[arena:${scope}]`
  if (level === 'error') console.error(prefix, message, detail || '')
  else if (level === 'warn') console.warn(prefix, message, detail || '')
  else console.info(prefix, message, detail || '')

  if (!hasArenaApi()) return
  try {
    await window.api.appendLog({
      level,
      scope,
      message,
      detail,
      matchId: meta?.matchId,
      characterId: meta?.characterId,
    })
  } catch {
    // 日志写入失败不影响主流程
  }
}

export async function listArenaLogs(limit = 100): Promise<ArenaLogEntry[]> {
  if (!hasArenaApi()) return []
  return window.api.listLogs(limit)
}
