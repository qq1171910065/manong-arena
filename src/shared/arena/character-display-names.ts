/**

 * 默认角色展示名 — 与 modelId 绑定，优先使用中文社区/产品圈的常用外号，而非厂商英文名。

 *

 * 外号来源参考（2024–2026 中文互联网讨论）：

 * - 豆包：抖音生态拟人 IP，「豆包大小姐」等二创称呼广泛流传

 * - GPT：「查老师」源于写论文/写代码场景下的调侃

 * - Claude：开发者圈称编程助手为「小克 / 代码章鱼」

 * - DeepSeek：Logo 鲸鱼 + Deep 谐音，网友称「深鲸」

 * - Kimi：来自创始人英文名，社区直接称呼 Kimi / 工号 001

 * - Gemini：音译梗「哈基米」在角色扮演/小红书圈层流行

 * - Qwen：阿里统一品牌「千问」

 * - Llama：开源圈戏称 Meta Llama 为「羊驼」

 * - GLM：C 端产品「智谱清言」简称「清言」

 * - MiniMax：官方自称「小海螺」

 * - Grok：X 平台戏仿账号梗「Gork」

 * - 星火：讯飞星火认知大模型的常用简称

 */

export const CHARACTER_DISPLAY_NAMES: Record<string, string> = {

  doubao: '豆包大小姐',

  'gpt-4o': '查老师',

  'claude-3-5-sonnet': '小克',

  'deepseek-chat': '深鲸',

  kimi: 'Kimi',

  'gemini-pro': '哈基米',

  'qwen-max': '千问',

  'mistral-large-latest': 'Mistral',

  'llama-3.1-70b': '羊驼',

  'hunyuan-turbo': '混元',

  'glm-4-plus': '清言',

  'abab6.5-chat': '小海螺',

  'yi-large': 'Yi',

  'ernie-4.0-turbo-8k': '文心',

  'grok-2-1212': 'Gork',

  'spark-max': '星火',

}



/** 旧版角色名（模型英文名、上一版随机起名等），用于本地数据迁移 */

export const LEGACY_CHARACTER_NAMES: Record<string, string[]> = {

  doubao: ['豆包', '小探'],

  'gpt-4o': ['GPT', '洛辞', '查特GPT', '查特', '小查'],

  'claude-3-5-sonnet': ['Claude', '温言', '克劳德', '小管'],

  'deepseek-chat': ['DeepSeek', '沉锋', '深觅', '深探', 'D老师'],

  kimi: ['Kimi', '念念'],

  'gemini-pro': ['Gemini', '星瞳', '美国大豆包', '葛大爷'],

  'qwen-max': ['Qwen', '织言', '通义千问'],

  'mistral-large-latest': ['Mistral', '刃声'],

  'llama-3.1-70b': ['Llama', '绵绵'],

  'hunyuan-turbo': ['Hunyuan', '衡序', '元宝'],

  'glm-4-plus': ['GLM', '墨纶', '智谱清言', 'Pony Alpha'],

  'abab6.5-chat': ['MiniMax', '戏白', '海螺AI'],

  'yi-large': ['Yi', '一言', '零一'],

  'ernie-4.0-turbo-8k': ['Ernie', '和缓', '文心一言', '文小言'],

  'grok-2-1212': ['Grok', '逆锋', '格鲁克'],

  'spark-max': ['Spark', '闪念', '讯飞星火'],

}



export function characterDisplayName(modelId: string, fallback = '新角色'): string {

  return CHARACTER_DISPLAY_NAMES[modelId] || fallback

}



export function isLegacyCharacterName(modelId: string, name: string): boolean {

  const trimmed = name.trim()

  if (!trimmed) return true

  if (trimmed === modelId) return true

  const current = CHARACTER_DISPLAY_NAMES[modelId]

  if (current && trimmed === current) return false

  const legacy = LEGACY_CHARACTER_NAMES[modelId] || []

  return legacy.some((item) => item.toLowerCase() === trimmed.toLowerCase())

}


