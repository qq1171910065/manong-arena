/** 首次进入 / 清空本地数据后的入门角色模板 key（顺序即初始化进度顺序；运行时模型见 settings.defaultModelId） */
import { characterDisplayName } from './character-display-names'

export const STARTER_CHARACTER_MODEL_IDS = [
  'doubao',
  'gpt-4o',
  'claude-3-5-sonnet',
  'deepseek-chat',
  'kimi',
  'gemini-pro',
  'qwen-max',
  'mistral-large-latest',
  'llama-3.1-70b',
  'hunyuan-turbo',
  'glm-4-plus',
  'abab6.5-chat',
  'yi-large',
  'ernie-4.0-turbo-8k',
  'grok-2-1212',
  'spark-max',
] as const

export type StarterCharacterModelId = (typeof STARTER_CHARACTER_MODEL_IDS)[number]
export const STARTER_CHARACTER_LABELS: Record<StarterCharacterModelId, string> = Object.fromEntries(
  STARTER_CHARACTER_MODEL_IDS.map((id) => [id, characterDisplayName(id)])
) as Record<StarterCharacterModelId, string>
export const STARTER_INIT_TOTAL = STARTER_CHARACTER_MODEL_IDS.length
