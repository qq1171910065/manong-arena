import { gatewayChatCompletion, resolveChatModelId } from '../gateway-api'
import {
  MIMO_TTS_VOICES,
  buildCharacterTtsContext,
  inferTtsProfileFromCharacter,
  isValidTtsVoiceId,
  resolveDefaultVoiceForGender,
  sanitizeTtsOpeningStyleTags,
  voiceMatchesCharacterGender,
  type CharacterTtsProfile,
} from '@shared/arena/voice-presets'
import type { Character } from '@shared/arena/types'

function parseJsonLike(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function normalizeAnalyzedVoiceId(character: Character, raw: unknown): string {
  const text = String(raw || '').trim()
  const byId = MIMO_TTS_VOICES.find((item) => item.id === text || item.label === text)
  if (byId && voiceMatchesCharacterGender(byId.id, character.gender)) return byId.id
  return resolveDefaultVoiceForGender(character.gender)
}

function buildAnalysisSystemPrompt(): string {
  const zhVoices = MIMO_TTS_VOICES.filter((item) => item.lang === 'zh')
    .map((item) => `${item.id}(${item.gender === 'female' ? '女' : item.gender === 'male' ? '男' : '默认'})`)
    .join('、')
  return [
    '你是游戏角色语音导演，负责为 MiMo-V2.5-TTS 配置播报参数。',
    '必须严格匹配角色性别选择中文预置音色，男角色只能选男声音色，女角色只能选女声音色。',
    `可选中文音色：${zhVoices}`,
    '输出 JSON，字段：',
    '- voiceId: 上述音色 id 之一',
    '- styleInstruction: 40-120 字自然语言，描述语速、情绪、腔调，用于 TTS user 指令',
    '- openingStyleTags: 1-2 个 (风格) 标签，从文档标签库选取，如 温柔/活泼/深沉/干练',
    '- summary: 一句话说明为何这样配置',
    '不要输出 markdown，只输出 JSON。',
  ].join('\n')
}

function normalizeAnalysisResult(character: Character, parsed: Record<string, unknown>): CharacterTtsProfile {
  const fallback = inferTtsProfileFromCharacter(character)
  const voiceId = normalizeAnalyzedVoiceId(character, parsed.voiceId)
  const styleInstruction = String(parsed.styleInstruction || '').trim() || fallback.styleInstruction
  const openingStyleTags = sanitizeTtsOpeningStyleTags(parsed.openingStyleTags)
  const summary = String(parsed.summary || '').trim() || fallback.summary
  return {
    voiceId: isValidTtsVoiceId(voiceId) ? voiceId : fallback.voiceId,
    styleInstruction,
    openingStyleTags: openingStyleTags.length ? openingStyleTags : fallback.openingStyleTags,
    summary,
  }
}

export async function analyzeCharacterTtsProfile(character: Character): Promise<CharacterTtsProfile> {
  const model = await resolveChatModelId({ explicit: character.modelId })
  const res = await gatewayChatCompletion(model, [
    { role: 'system', content: buildAnalysisSystemPrompt() },
    {
      role: 'user',
      content: [
        '请根据以下角色档案，分析其播报音色与说话方式，输出 JSON。',
        buildCharacterTtsContext(character),
      ].join('\n\n'),
    },
  ])

  const parsed = parseJsonLike(res.content || '')
  if (!parsed) return inferTtsProfileFromCharacter(character)
  return normalizeAnalysisResult(character, parsed)
}

export function applyTtsProfileToCharacter(character: Character, profile: CharacterTtsProfile): Character {
  return {
    ...character,
    ttsVoiceId: profile.voiceId,
    ttsStyleInstruction: profile.styleInstruction,
    ttsOpeningStyleTags: profile.openingStyleTags,
    ttsAnalyzedSummary: profile.summary,
    ttsAutoStyleTags: true,
    ttsAutoStyleInstruction: false,
  }
}

export const ttsProfileService = {
  analyze: analyzeCharacterTtsProfile,
  apply: applyTtsProfileToCharacter,
  inferLocal: inferTtsProfileFromCharacter,
}
