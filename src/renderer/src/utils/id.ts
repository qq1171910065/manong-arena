export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function formatCents(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function formatYuan(cents: number): string {
  return `¥${formatCents(cents)}`
}

export function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function modelLabel(modelId: string): string {
  const map: Record<string, string> = {
    doubao: '豆包',
    'gpt-4o': 'GPT-4o',
    'claude-3-5-sonnet': 'Claude 3.5',
    'deepseek-chat': 'DeepSeek',
    kimi: 'Kimi',
    'gemini-pro': 'Gemini',
    'qwen-max': '通义千问',
    'mistral-large-latest': 'Mistral',
    'llama-3.1-70b': 'Llama',
    'hunyuan-turbo': '腾讯混元',
    'glm-4-plus': '智谱 GLM',
    'abab6.5-chat': 'MiniMax',
    'yi-large': '零一 Yi',
    'ernie-4.0-turbo-8k': '文心一言',
    'grok-2-1212': 'Grok',
    'spark-max': '讯飞星火',
  }
  return map[modelId] || modelId
}

export function matchStatusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    active: '进行中',
    paused: '已暂停',
    completed: '已完成',
    aborted: '已中断',
    archived: '已归档',
  }
  return map[status] || status
}
