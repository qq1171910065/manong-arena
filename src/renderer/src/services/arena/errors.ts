export class ArenaError extends Error {
  readonly code: string
  readonly scope: string

  constructor(code: string, message: string, scope = 'ui') {
    super(message)
    this.name = 'ArenaError'
    this.code = code
    this.scope = scope
  }
}

export function toArenaError(error: unknown, scope = 'ui'): ArenaError {
  if (error instanceof ArenaError) return error
  const message = error instanceof Error ? error.message : String(error)
  return new ArenaError('UNKNOWN', message, scope)
}

export function formatUserMessage(error: unknown): string {
  const arenaError = toArenaError(error)
  const map: Record<string, string> = {
    NOT_FOUND: '未找到对应数据',
    VALIDATION: '输入数据不完整或无效',
    INSUFFICIENT_BALANCE: '余额不足，请先充值',
    MODEL_TIMEOUT: '模型响应超时，请稍后重试',
    MODEL_FAILED: '模型调用失败',
    ENGINE_PAUSED: '对局已暂停，请处理异常后重试',
    INTERNAL: '系统内部错误，请稍后重试',
  }
  return map[arenaError.code] || arenaError.message || '操作失败'
}
