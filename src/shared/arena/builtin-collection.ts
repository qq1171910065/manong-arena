/** 内置收藏目录 — 成就、素材包、角色天赋、性格等 */

import {
  BUILTIN_PERSONALITY_SKILL_DEFS,
  BUILTIN_PERSONALITY_TAG_DEFS,
  BUILTIN_SPEECH_STYLE_DEFS,
  CHARACTER_ATTRIBUTE_LABELS,
  type CharacterAttributeId,
} from './character-growth'

export type CollectionCategoryId = 'achievements' | 'asset-packs' | 'talents' | 'personalities'

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
  /** 成就图标素材，未配置时 UI 使用占位 */
  iconUrl?: string
}

export interface CollectionTalentDef {
  id: string
  name: string
  description: string
  attributeId: CharacterAttributeId
  attributeLabel: string
  triggerTiming: string
  triggerEffect: string
  matchEffect: string
  iconUrl?: string
}

export interface CollectionPersonalityDef {
  id: string
  kind: 'tag' | 'speech-style'
  name: string
  description: string
  /** 性格图标素材，未配置时 UI 使用占位 */
  iconUrl?: string
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
  { id: 'talents', label: '角色天赋', description: '玩法场景中的特殊能力，创建角色时随机分配四阶' },
  { id: 'personalities', label: '性格', description: '内置标签与说话风格' },
]

export const BUILTIN_ACHIEVEMENTS: CollectionAchievementDef[] = [
  { id: 'first_character', name: '初识伙伴', description: '创建或启用第一个 AI 角色', group: '养成' },
  { id: 'roster_3', name: '小队集结', description: '启用中的角色不少于 3 个', group: '养成' },
  { id: 'level_5', name: '小有成长', description: '任一角色达到 5 级', group: '养成' },
  { id: 'level_10', name: '崭露头角', description: '任一角色达到 10 级', group: '养成' },
  { id: 'level_15', name: '渐露锋芒', description: '任一角色达到 15 级', group: '养成' },
  { id: 'level_20', name: '独当一面', description: '任一角色达到 20 级', group: '养成' },
  { id: 'level_24', name: '炉火纯青', description: '任一角色达到 24 级', group: '养成' },
  { id: 'level_36', name: '登峰造极', description: '任一角色达到 36 级', group: '养成' },
  { id: 'level_50', name: '传奇伙伴', description: '任一角色达到 50 级', group: '养成' },
  { id: 'roster_6', name: '豪华阵容', description: '启用中的角色不少于 6 个', group: '养成' },
  { id: 'first_match', name: '初次入局', description: '累计参与 1 场对局', group: '对局' },
  { id: 'match_10', name: '常客玩家', description: '累计参与 10 场对局', group: '对局' },
  { id: 'match_50', name: '牌桌老手', description: '累计参与 50 场对局', group: '对局' },
  { id: 'match_100', name: '百战不殆', description: '累计参与 100 场对局', group: '对局' },
  { id: 'win_1', name: '首胜时刻', description: '累计获得 1 场胜利', group: '对局' },
  { id: 'win_5', name: '初尝胜果', description: '累计获得 5 场胜利', group: '对局' },
  { id: 'win_20', name: '常胜姿态', description: '累计获得 20 场胜利', group: '对局' },
  { id: 'win_50', name: '胜场大师', description: '累计获得 50 场胜利', group: '对局' },
  { id: 'chat_20', name: '话痨伙伴', description: '与角色私聊累计 20 条消息', group: '互动' },
  { id: 'chat_100', name: '知心好友', description: '与角色私聊累计 100 条消息', group: '互动' },
  { id: 'chat_500', name: '形影不离', description: '与角色私聊累计 500 条消息', group: '互动' },
]

export const BUILTIN_TALENT_CATALOG: CollectionTalentDef[] = BUILTIN_PERSONALITY_SKILL_DEFS.map(
  (skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    attributeId: skill.attributeId,
    attributeLabel: CHARACTER_ATTRIBUTE_LABELS[skill.attributeId],
    triggerTiming: skill.triggerTiming,
    triggerEffect: skill.triggerEffect,
    matchEffect: skill.matchEffect,
  })
)

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
  善于伪装: '偏隐藏真实意图，提升创意与上下文广度',
  喜欢质疑: '偏追问与挑刺，提升表达力与思考深度',
  擅长总结: '偏归纳提炼，提升上下文广度与表达力',
  逆向思维: '偏反常规路径，提升想象力与思考深度',
  温和引导: '偏缓和推进，提升共情力与协作力',
  细节控: '偏抠细节，提升表达力与共情力',
  快节奏: '偏快速推进，提升表达力与上下文广度',
  守序稳健: '偏按规则行事，提升思考深度与共情力',
}

const SPEECH_STYLE_DESCRIPTIONS: Record<string, string> = {
  活泼: '语气轻快、接话积极',
  温柔: '措辞柔和、共情优先',
  理性: '条理清晰、少情绪化',
  冷静: '克制平稳、不轻易带节奏',
  傲娇: '嘴硬心软、偶尔反讽',
  简洁: '言简意赅、直奔主题',
  幽默: '善用调侃、缓和气氛',
  高冷: '疏离克制、惜字如金',
  阴阳怪气: '话里有话、暗讽试探',
  谨慎: '措辞留余地、不轻易下定论',
  热情: '情绪饱满、感染力强',
  慵懒: '语气松弛、不紧不慢',
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
    case 'roster_3':
      return stats.characterCount >= 3
    case 'level_5':
      return stats.maxLevel >= 5
    case 'level_10':
      return stats.maxLevel >= 10
    case 'level_15':
      return stats.maxLevel >= 15
    case 'level_20':
      return stats.maxLevel >= 20
    case 'level_24':
      return stats.maxLevel >= 24
    case 'level_36':
      return stats.maxLevel >= 36
    case 'level_50':
      return stats.maxLevel >= 50
    case 'roster_6':
      return stats.characterCount >= 6
    case 'first_match':
      return stats.totalMatches >= 1
    case 'match_10':
      return stats.totalMatches >= 10
    case 'match_50':
      return stats.totalMatches >= 50
    case 'match_100':
      return stats.totalMatches >= 100
    case 'win_1':
      return stats.totalWins >= 1
    case 'win_5':
      return stats.totalWins >= 5
    case 'win_20':
      return stats.totalWins >= 20
    case 'win_50':
      return stats.totalWins >= 50
    case 'chat_20':
      return stats.totalChatMessages >= 20
    case 'chat_100':
      return stats.totalChatMessages >= 100
    case 'chat_500':
      return stats.totalChatMessages >= 500
    default:
      return false
  }
}
