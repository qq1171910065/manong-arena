/** 内置收藏目录 — 成就、素材包、技能、性格等 */

import {
  BUILTIN_PERSONALITY_SKILL_DEFS,
  BUILTIN_PERSONALITY_TAG_DEFS,
  BUILTIN_SPEECH_STYLE_DEFS,
  CHARACTER_ATTRIBUTE_LABELS,
  type CharacterAttributeId,
} from './character-growth'

export type CollectionCategoryId = 'achievements' | 'asset-packs' | 'skills' | 'personalities'

export interface CollectionCategory {
  id: CollectionCategoryId
  label: string
  description: string
}

export interface CollectionAchievementDef {
  id: string
  name: string
  description: string
  group: string
}

export interface CollectionSkillDef {
  id: string
  name: string
  description: string
  attributeId: CharacterAttributeId
  attributeLabel: string
}

export interface CollectionPersonalityDef {
  id: string
  kind: 'tag' | 'speech-style'
  name: string
  description: string
}

export interface CollectionAggregateStats {
  characterCount: number
  maxLevel: number
  totalMatches: number
  totalWins: number
  totalChatMessages: number
}

export const COLLECTION_CATEGORIES: CollectionCategory[] = [
  { id: 'achievements', label: '成就', description: '养成与对局里程碑' },
  { id: 'asset-packs', label: '素材包', description: '角色立绘、头像与表情资源' },
  { id: 'skills', label: '专属技能', description: '随等级与人设解锁的性格技能' },
  { id: 'personalities', label: '性格', description: '内置标签与说话风格' },
]

export const BUILTIN_ACHIEVEMENTS: CollectionAchievementDef[] = [
  { id: 'first_character', name: '初识伙伴', description: '创建或启用第一个 AI 角色', group: '养成' },
  { id: 'level_5', name: '小有成长', description: '任一角色达到 5 级', group: '养成' },
  { id: 'level_10', name: '崭露头角', description: '任一角色达到 10 级', group: '养成' },
  { id: 'level_24', name: '炉火纯青', description: '任一角色达到 24 级', group: '养成' },
  { id: 'first_match', name: '初次入局', description: '累计参与 1 场对局', group: '对局' },
  { id: 'match_10', name: '常客玩家', description: '累计参与 10 场对局', group: '对局' },
  { id: 'match_50', name: '牌桌老手', description: '累计参与 50 场对局', group: '对局' },
  { id: 'win_5', name: '初尝胜果', description: '累计获得 5 场胜利', group: '对局' },
  { id: 'win_20', name: '常胜姿态', description: '累计获得 20 场胜利', group: '对局' },
  { id: 'chat_20', name: '话痨伙伴', description: '与角色私聊累计 20 条消息', group: '互动' },
  { id: 'chat_100', name: '知心好友', description: '与角色私聊累计 100 条消息', group: '互动' },
  { id: 'roster_6', name: '豪华阵容', description: '启用中的角色不少于 6 个', group: '养成' },
]

export const BUILTIN_SKILL_CATALOG: CollectionSkillDef[] = BUILTIN_PERSONALITY_SKILL_DEFS.map((skill) => ({
  id: skill.id,
  name: skill.name,
  description: skill.description,
  attributeId: skill.attributeId,
  attributeLabel: CHARACTER_ATTRIBUTE_LABELS[skill.attributeId],
}))

const TAG_DESCRIPTIONS: Record<string, string> = {
  逻辑推理: '偏逻辑链与质疑，提升表达力与想象力',
  策略思维: '偏局势判断，提升协作力与活跃度',
  团队协作: '偏接话与补位，提升协作力与共情力',
  情绪共鸣: '偏感知他人情绪，提升共情力与表达力',
  剧情推理: '偏叙事与线索串联，提升想象力与表达力',
  敏锐观察: '偏细节捕捉，提升共情力与活跃度',
  语言表达: '偏清晰表述，提升表达力与协作力',
  冷静沉着: '偏稳阵分析，提升共情力与活跃度',
  创意表达: '偏独特观点，提升表达力与想象力',
  深度思考: '偏慢热深挖，提升想象力与表达力',
}

const SPEECH_STYLE_DESCRIPTIONS: Record<string, string> = {
  活泼: '语气轻快、接话积极',
  温柔: '措辞柔和、共情优先',
  理性: '条理清晰、少情绪化',
  冷静: '克制平稳、不轻易带节奏',
  傲娇: '嘴硬心软、偶尔反讽',
}

export const BUILTIN_PERSONALITY_CATALOG: CollectionPersonalityDef[] = [
  ...BUILTIN_PERSONALITY_TAG_DEFS.map((name) => ({
    id: `tag:${name}`,
    kind: 'tag' as const,
    name,
    description: TAG_DESCRIPTIONS[name] || '影响角色属性倾向的内置标签',
  })),
  ...BUILTIN_SPEECH_STYLE_DEFS.map((name) => ({
    id: `style:${name}`,
    kind: 'speech-style' as const,
    name,
    description: SPEECH_STYLE_DESCRIPTIONS[name] || '影响说话方式的内置风格',
  })),
]

export function isAchievementUnlocked(id: string, stats: CollectionAggregateStats): boolean {
  switch (id) {
    case 'first_character':
      return stats.characterCount >= 1
    case 'level_5':
      return stats.maxLevel >= 5
    case 'level_10':
      return stats.maxLevel >= 10
    case 'level_24':
      return stats.maxLevel >= 24
    case 'first_match':
      return stats.totalMatches >= 1
    case 'match_10':
      return stats.totalMatches >= 10
    case 'match_50':
      return stats.totalMatches >= 50
    case 'win_5':
      return stats.totalWins >= 5
    case 'win_20':
      return stats.totalWins >= 20
    case 'chat_20':
      return stats.totalChatMessages >= 20
    case 'chat_100':
      return stats.totalChatMessages >= 100
    case 'roster_6':
      return stats.characterCount >= 6
    default:
      return false
  }
}
