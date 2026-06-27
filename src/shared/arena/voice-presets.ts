/** MiMo-V2.5-TTS 预置音色与风格映射 — 对齐官方 speech-synthesis-v2.5 文档 */

import type { Character } from './types'

export interface MimoTtsVoiceOption {
  id: string
  label: string
  lang: 'zh' | 'en'
  gender: 'female' | 'male' | 'neutral'
}

export interface MimoTtsStyleTagGroup {
  id: string
  label: string
  tags: string[]
}

export const MIMO_TTS_MODEL_ID = 'mimo-v2.5-tts'

export const DEFAULT_TTS_VOICE_ID = 'mimo_default'
export const DEFAULT_JUDGE_TTS_VOICE_ID = '白桦'

export const DEFAULT_TTS_STYLE_INSTRUCTION =
  '用自然清晰的中文语调朗读以下内容，语速适中，发音自然流畅。'

/** 局内 TTS 正常播放速度（不使用 Web Audio 倍速；语速由合成指令控制） */
export const DEFAULT_TTS_PLAYBACK_RATE = 1
export const JUDGE_TTS_PLAYBACK_RATE = 1

export const MIMO_TTS_VOICES: MimoTtsVoiceOption[] = [
  { id: 'mimo_default', label: 'MiMo 默认', lang: 'zh', gender: 'female' },
  { id: '冰糖', label: '冰糖', lang: 'zh', gender: 'female' },
  { id: '茉莉', label: '茉莉', lang: 'zh', gender: 'female' },
  { id: '苏打', label: '苏打', lang: 'zh', gender: 'male' },
  { id: '白桦', label: '白桦', lang: 'zh', gender: 'male' },
  { id: 'Mia', label: 'Mia', lang: 'en', gender: 'female' },
  { id: 'Chloe', label: 'Chloe', lang: 'en', gender: 'female' },
  { id: 'Milo', label: 'Milo', lang: 'en', gender: 'male' },
  { id: 'Dean', label: 'Dean', lang: 'en', gender: 'male' },
]

/** 文档推荐 (风格) 标签 — 置于 assistant content 开头 */
export const MIMO_TTS_STYLE_TAG_GROUPS: MimoTtsStyleTagGroup[] = [
  {
    id: 'emotion',
    label: '基础情绪',
    tags: ['开心', '悲伤', '愤怒', '恐惧', '惊讶', '兴奋', '委屈', '平静', '冷漠'],
  },
  {
    id: 'compound',
    label: '复合情绪',
    tags: ['怅然', '欣慰', '无奈', '愧疚', '释然', '嫉妒', '厌倦', '忐忑', '动情'],
  },
  {
    id: 'tone',
    label: '整体语调',
    tags: ['温柔', '高冷', '活泼', '严肃', '慵懒', '俏皮', '深沉', '干练', '凌厉'],
  },
  {
    id: 'timbre',
    label: '音色定位',
    tags: ['磁性', '醇厚', '清亮', '空灵', '稚嫩', '苍老', '甜美', '沙哑', '醇雅'],
  },
  {
    id: 'persona',
    label: '人设腔调',
    tags: ['夹子音', '御姐音', '正太音', '大叔音', '台湾腔'],
  },
  {
    id: 'dialect',
    label: '方言',
    tags: ['东北话', '四川话', '河南话', '粤语'],
  },
  {
    id: 'roleplay',
    label: '角色扮演',
    tags: ['孙悟空', '林黛玉'],
  },
]

/** 文档 [音频标签] 示例 — 可用于 assistant content 内细粒度控制（高级） */
export const MIMO_TTS_AUDIO_TAG_EXAMPLES = [
  '吸气',
  '深呼吸',
  '叹气',
  '长叹一口气',
  '紧张',
  '激动',
  '疲惫',
  '气声',
  '笑',
  '轻笑',
  '哽咽',
]

const VOICE_ID_SET = new Set(MIMO_TTS_VOICES.map((item) => item.id))

const ALL_STYLE_TAGS = new Set(MIMO_TTS_STYLE_TAG_GROUPS.flatMap((group) => group.tags))

export interface CharacterTtsProfile {
  voiceId: string
  styleInstruction: string
  openingStyleTags: string[]
  summary: string
}

export function getVoiceGender(voiceId: string): MimoTtsVoiceOption['gender'] | null {
  return MIMO_TTS_VOICES.find((item) => item.id === voiceId)?.gender ?? null
}

export function voiceMatchesCharacterGender(
  voiceId: string,
  gender: Character['gender'] | null | undefined
): boolean {
  if (!gender || gender === 'other') return true
  const voiceGender = getVoiceGender(voiceId)
  if (!voiceGender || voiceGender === 'neutral') return true
  return voiceGender === gender
}

export function listZhVoicesForGender(gender: Character['gender'] | null | undefined): MimoTtsVoiceOption[] {
  const zh = MIMO_TTS_VOICES.filter((item) => item.lang === 'zh')
  if (!gender || gender === 'other') return zh
  const matched = zh.filter((item) => item.gender === gender || item.gender === 'neutral')
  return matched.length ? matched : zh
}

export function isValidTtsVoiceId(voiceId: string | undefined | null): voiceId is string {
  return Boolean(voiceId && VOICE_ID_SET.has(voiceId))
}

export function getTtsVoiceLabel(voiceId: string | undefined | null): string {
  if (!voiceId) return '未配置'
  return MIMO_TTS_VOICES.find((item) => item.id === voiceId)?.label || voiceId
}

/** 说话方式 → 默认预置音色（女性） */
export const SPEECH_STYLE_VOICE_DEFAULTS_FEMALE: Record<string, string> = {
  温柔: '茉莉',
  活泼: '冰糖',
  理性: '茉莉',
  简洁: '冰糖',
  幽默: '冰糖',
  高冷: '茉莉',
  阴阳怪气: '冰糖',
  谨慎: '茉莉',
}

/** 说话方式 → 默认预置音色（男性） */
export const SPEECH_STYLE_VOICE_DEFAULTS_MALE: Record<string, string> = {
  温柔: '白桦',
  活泼: '苏打',
  理性: '白桦',
  简洁: '苏打',
  幽默: '苏打',
  高冷: '白桦',
  阴阳怪气: '苏打',
  谨慎: '白桦',
}

/** @deprecated 使用 gender 感知版本 */
export const SPEECH_STYLE_VOICE_DEFAULTS: Record<string, string> = SPEECH_STYLE_VOICE_DEFAULTS_FEMALE

/** 说话方式 → (风格) 标签 */
export const SPEECH_STYLE_OPENING_TAGS: Record<string, string> = {
  温柔: '温柔',
  活泼: '活泼',
  理性: '深沉',
  简洁: '干练',
  幽默: '俏皮',
  高冷: '高冷',
  阴阳怪气: '慵懒',
  谨慎: '忐忑',
}

/** 说话方式 → 自然语言风格指令（MiMo user message） */
export const SPEECH_STYLE_TTS_INSTRUCTIONS: Record<string, string> = {
  温柔: '用温柔平和的语调朗读，语速稍快，声音柔和有礼，不拖泥带水。',
  活泼: '用轻快活泼的语调朗读，语速较快，声音明亮有活力，节奏利落。',
  理性: '用冷静理性的语调朗读，语速偏快且平稳，条理清晰。',
  简洁: '用简洁干练的语调朗读，语速快，字句紧凑，不拖泥带水。',
  幽默: '用轻松诙谐的语调朗读，语速稍快，语气自然，略带俏皮。',
  高冷: '用冷淡疏离的语调朗读，语速适中偏快，语气克制。',
  阴阳怪气: '用略带讽刺的语调朗读，语速稍快，语气微妙，似笑非笑。',
  谨慎: '用谨慎试探的语调朗读，语速适中，留有余地但不拖沓。',
}

/** 说话方式 → 播放倍速微调（叠加 DEFAULT_TTS_PLAYBACK_RATE） */
const SPEECH_STYLE_PLAYBACK_RATE_DELTA: Record<string, number> = {
  活泼: 0.06,
  简洁: 0.05,
  幽默: 0.04,
  理性: 0.03,
  温柔: 0.02,
  阴阳怪气: 0.02,
  高冷: -0.02,
  谨慎: -0.03,
}

export const TTS_STYLE_INSTRUCTION_PRESETS: Array<{ id: string; label: string; text: string }> = [
  {
    id: 'neutral',
    label: '自然清晰',
    text: DEFAULT_TTS_STYLE_INSTRUCTION,
  },
  {
    id: 'news',
    label: '报喜汇报',
    text: '用轻快上扬的语调报喜，语速稍快，带着压抑不住的激动与小骄傲，声音明亮有活力。',
  },
  {
    id: 'calm',
    label: '冷静克制',
    text: '用冷静克制的语调朗读，语速平稳，情绪收束，字句清晰。',
  },
  {
    id: 'dramatic',
    label: '戏剧演绎',
    text: '角色：游戏对局中的 AI 角色。场景：公开频道发言，需要让观众听出立场与情绪。指导：语速随内容起伏，重音落在关键判断词上，整体有代入感但不夸张。',
  },
]

export function resolveSpeechStyleVoiceId(
  speechStyle: string | null | undefined,
  gender: Character['gender'] | null | undefined
): string | undefined {
  if (!speechStyle) return undefined
  const table =
    gender === 'male'
      ? SPEECH_STYLE_VOICE_DEFAULTS_MALE
      : gender === 'female'
        ? SPEECH_STYLE_VOICE_DEFAULTS_FEMALE
        : { ...SPEECH_STYLE_VOICE_DEFAULTS_FEMALE, ...SPEECH_STYLE_VOICE_DEFAULTS_MALE }
  const voiceId = table[speechStyle]
  return isValidTtsVoiceId(voiceId) ? voiceId : undefined
}

export function resolveDefaultVoiceForGender(gender: Character['gender'] | null | undefined): string {
  if (gender === 'male') return '苏打'
  if (gender === 'other') return 'mimo_default'
  return '茉莉'
}

export function resolveTtsVoiceId(options: {
  ttsVoiceId?: string | null
  speechStyle?: string | null
  gender?: Character['gender'] | null
}): string {
  if (isValidTtsVoiceId(options.ttsVoiceId) && voiceMatchesCharacterGender(options.ttsVoiceId, options.gender)) {
    return options.ttsVoiceId
  }
  const fromStyle = resolveSpeechStyleVoiceId(options.speechStyle, options.gender)
  if (fromStyle) return fromStyle
  return resolveDefaultVoiceForGender(options.gender)
}

export function resolveOpeningStyleTags(character: Pick<
  Character,
  'speechStyle' | 'ttsOpeningStyleTags' | 'ttsAutoStyleTags'
>): string[] {
  const manual = [...(character.ttsOpeningStyleTags || [])].filter(Boolean)
  const tags = new Set(manual)
  if (character.ttsAutoStyleTags !== false && character.speechStyle) {
    const auto = SPEECH_STYLE_OPENING_TAGS[character.speechStyle]
    if (auto) tags.add(auto)
  }
  return [...tags]
}

function buildGenderVoiceHint(gender: Character['gender'] | null | undefined): string {
  if (gender === 'male') return '声线需符合男性角色，避免使用偏少女/御姐的音色描述。'
  if (gender === 'female') return '声线需符合女性角色，避免使用偏大叔/正太的音色描述。'
  return ''
}

export function resolveTtsStyleInstruction(
  character: Pick<
    Character,
    'gender' | 'speechStyle' | 'ttsStyleInstruction' | 'ttsAutoStyleInstruction' | 'ttsAdjustNotes'
  >
): string {
  const parts: string[] = []
  const custom = character.ttsStyleInstruction?.trim()
  if (custom) {
    parts.push(custom)
  } else if (character.ttsAutoStyleInstruction !== false && character.speechStyle) {
    const preset = SPEECH_STYLE_TTS_INSTRUCTIONS[character.speechStyle]
    if (preset) parts.push(preset)
  }
  if (!parts.length) parts.push(DEFAULT_TTS_STYLE_INSTRUCTION)

  const genderHint = buildGenderVoiceHint(character.gender)
  if (genderHint && !parts.some((part) => part.includes('男性') || part.includes('女性'))) {
    parts.push(genderHint)
  }

  const adjust = character.ttsAdjustNotes?.trim()
  if (adjust) parts.push(`补充微调：${adjust}`)

  return parts.join(' ')
}

/** 根据说话方式与策略倾向计算局内播放倍速（固定 1.0，语速仅通过合成指令调节） */
export function resolveCharacterPlaybackRate(
  _character: Pick<Character, 'speechStyle' | 'strategy'>
): number {
  return DEFAULT_TTS_PLAYBACK_RATE
}

/** 综合角色档案、自动分析与用户微调，得出最终 TTS 参数 */
export function resolveCharacterTtsParams(
  character: Pick<
    Character,
    | 'gender'
    | 'speechStyle'
    | 'ttsVoiceId'
    | 'ttsStyleInstruction'
    | 'ttsOpeningStyleTags'
    | 'ttsAutoStyleTags'
    | 'ttsAutoStyleInstruction'
    | 'ttsAdjustNotes'
  >
): CharacterTtsProfile {
  const voiceId = resolveTtsVoiceId({
    ttsVoiceId: character.ttsVoiceId,
    speechStyle: character.speechStyle,
    gender: character.gender,
  })
  const styleInstruction = resolveTtsStyleInstruction(character)
  const openingStyleTags = resolveOpeningStyleTags(character)
  const voiceLabel = getTtsVoiceLabel(voiceId)
  const genderLabel = character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '中性'
  const summary = `${voiceLabel} · ${genderLabel} · ${character.speechStyle || '默认'}${openingStyleTags.length ? ` · (${openingStyleTags.join(' ')})` : ''}`
  return { voiceId, styleInstruction, openingStyleTags, summary }
}

export function sanitizeTtsOpeningStyleTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const out: string[] = []
  for (const raw of tags) {
    const tag = String(raw || '').trim()
    if (!tag || !ALL_STYLE_TAGS.has(tag) || out.includes(tag)) continue
    out.push(tag)
    if (out.length >= 3) break
  }
  return out
}

export function buildCharacterTtsContext(
  character: Pick<
    Character,
    | 'name'
    | 'subtitle'
    | 'gender'
    | 'ageLabel'
    | 'bio'
    | 'tags'
    | 'speechStyle'
    | 'commonPhrases'
    | 'behaviorPrinciples'
    | 'strengths'
    | 'weaknesses'
    | 'strategy'
    | 'ttsAdjustNotes'
  >
): string {
  const genderText =
    character.gender === 'male' ? '男' : character.gender === 'female' ? '女' : '其他/中性'
  return [
    `角色名：${character.name || '未命名'}`,
    character.subtitle ? `副标题：${character.subtitle}` : '',
    `性别：${genderText}`,
    character.ageLabel ? `年龄感：${character.ageLabel}` : '',
    character.bio ? `人设：${character.bio}` : '',
    character.tags.length ? `标签：${character.tags.join('、')}` : '',
    `说话方式：${character.speechStyle || '未设定'}`,
    character.commonPhrases.length ? `常用表达：${character.commonPhrases.slice(0, 6).join('、')}` : '',
    character.behaviorPrinciples.length
      ? `行为原则：${character.behaviorPrinciples.slice(0, 6).join('；')}`
      : '',
    character.strengths.length ? `擅长：${character.strengths.join('、')}` : '',
    character.weaknesses.length ? `短板：${character.weaknesses.join('、')}` : '',
    `策略倾向：共情${character.strategy.empathyVsLogic}% / 谨慎${character.strategy.cautiousVsBold}% / 主导${character.strategy.leadVsFollow}%`,
    character.ttsAdjustNotes?.trim() ? `用户微调要求：${character.ttsAdjustNotes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/** 本地规则推断 TTS 配置（无模型时的兜底，或 AI 失败时使用） */
export function inferTtsProfileFromCharacter(
  character: Pick<
    Character,
    | 'name'
    | 'gender'
    | 'speechStyle'
    | 'bio'
    | 'tags'
    | 'ttsStyleInstruction'
    | 'ttsOpeningStyleTags'
    | 'ttsAutoStyleTags'
    | 'ttsAdjustNotes'
  >
): CharacterTtsProfile {
  const voiceId = resolveTtsVoiceId({
    speechStyle: character.speechStyle,
    gender: character.gender,
  })
  const openingStyleTags = resolveOpeningStyleTags({
    speechStyle: character.speechStyle,
    ttsOpeningStyleTags: character.ttsOpeningStyleTags,
    ttsAutoStyleTags: character.ttsAutoStyleTags,
  })
  const styleInstruction = resolveTtsStyleInstruction({
    gender: character.gender,
    speechStyle: character.speechStyle,
    ttsStyleInstruction: character.ttsStyleInstruction,
    ttsAutoStyleInstruction: false,
    ttsAdjustNotes: character.ttsAdjustNotes,
  })
  const voiceLabel = getTtsVoiceLabel(voiceId)
  const genderLabel = character.gender === 'male' ? '男声' : character.gender === 'female' ? '女声' : '默认声线'
  const summary = `已按${genderLabel}与「${character.speechStyle || '默认'}」说话方式匹配为 ${voiceLabel}`
  return { voiceId, styleInstruction, openingStyleTags, summary }
}

/** 构建 MiMo assistant 合成文本（含 (风格) 前缀，仅用于 TTS，不写入消息气泡） */
export function buildTtsAssistantText(
  displayText: string,
  character: Pick<Character, 'speechStyle' | 'ttsOpeningStyleTags' | 'ttsAutoStyleTags'>
): string {
  const text = displayText.trim()
  if (!text) return text
  const tags = resolveOpeningStyleTags(character)
  return buildTtsAssistantTextWithTags(text, tags)
}

export function buildTtsAssistantTextWithTags(displayText: string, openingStyleTags: string[]): string {
  const text = displayText.trim()
  if (!text) return text
  if (!openingStyleTags.length) return text
  return `(${openingStyleTags.join(' ')})${text}`
}

/** 从展示文本中剥离 TTS 风格/音频标签（防御性，避免标签泄露到气泡） */
export function stripTtsMarkupForDisplay(text: string): string {
  let out = text.trim()
  if (!out) return out
  // 开头 (风格) / （风格） / [风格]
  out = out.replace(/^[(（\[][^)\]）]{1,48}[)\]）]\s*/, '')
  // [音频标签]
  out = out.replace(/\[[^\]\n]{1,20}\]/g, '')
  return out.replace(/\s{2,}/g, ' ').trim()
}

export function getCharacterTtsSummary(
  character: Pick<
    Character,
    | 'speechStyle'
    | 'gender'
    | 'ttsVoiceId'
    | 'ttsStyleInstruction'
    | 'ttsOpeningStyleTags'
    | 'ttsAutoStyleTags'
    | 'ttsAdjustNotes'
  >
): string {
  return resolveCharacterTtsParams(character).summary
}

const SENTENCE_END = /[。！？；…!?]/

export function extractCompletedSentences(text: string, final = false): { completed: string[]; remainder: string } {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return { completed: [], remainder: '' }

  const completed: string[] = []
  let buffer = ''

  for (const char of normalized) {
    buffer += char
    if (SENTENCE_END.test(char)) {
      const chunk = buffer.trim()
      if (chunk) completed.push(chunk)
      buffer = ''
    }
  }

  const remainder = buffer.trim()
  if (final && remainder) completed.push(remainder)
  return { completed, remainder: final ? '' : remainder }
}

export function splitLongSentence(text: string, maxLen = 72): string[] {
  const trimmed = text.trim()
  if (!trimmed) return []
  if (trimmed.length <= maxLen) return [trimmed]

  const parts = trimmed.split(/(?<=[，,、：:；;])\s*/).filter(Boolean)
  const chunks: string[] = []
  let buffer = ''

  for (const part of parts) {
    const candidate = buffer ? buffer + part : part
    if (candidate.length > maxLen && buffer) {
      chunks.push(buffer.trim())
      buffer = part
    } else {
      buffer = candidate
    }
  }
  if (buffer.trim()) chunks.push(buffer.trim())
  return chunks.length ? chunks : [trimmed]
}

export function splitTextForTts(text: string): string[] {
  const { completed } = extractCompletedSentences(text, true)
  return completed.flatMap((sentence) => splitLongSentence(sentence))
}

/** @deprecated 使用 resolveTtsStyleInstruction(character) */
export function resolveTtsStyleInstructionFromSpeechStyle(speechStyle?: string | null): string {
  const instruction = speechStyle ? SPEECH_STYLE_TTS_INSTRUCTIONS[speechStyle] : undefined
  return instruction || DEFAULT_TTS_STYLE_INSTRUCTION
}
