/** 角色等级、属性与角色天赋 — 纯计算，与等级/人设相关 */

import type { Character, StrategyTendency } from './types'

export type CharacterAttributeId =
  | 'precision'
  | 'empathy'
  | 'creativity'
  | 'context'
  | 'depth'

export interface CharacterAttributes {
  precision: number
  empathy: number
  creativity: number
  context: number
  depth: number
}

export interface CharacterGrowthState {
  level: number
  exp: number
  totalExp: number
}

export interface CharacterPersonalitySkill {
  id: string
  name: string
  description: string
  attributeId: CharacterAttributeId
  triggerTiming: string
  triggerEffect: string
  matchEffect: string
  matchPhases: import('./character-agent').MatchSkillPhase[]
  level: number
  maxLevel: number
  unlockLevel: number
}

export interface CharacterGrowthSnapshot {
  id: string
  characterId: string
  createdAt: string
  source: 'match' | 'chat' | 'review' | 'initial' | 'migration'
  matchId?: string
  summary: string
  level: number
  exp: number
  attributes: CharacterAttributes
  expDelta?: number
  levelDelta?: number
}

export interface CharacterLineup {
  id: string
  name: string
  characterIds: string[]
  createdAt: string
  updatedAt: string
  stats: {
    matchCount: number
    winCount: number
    lastMatchAt: string | null
  }
}

export interface LineupGrowthRecord {
  id: string
  lineupId: string
  matchId: string
  createdAt: string
  summary: string
  won: boolean
  participantCount: number
  gameModeName: string
}

export const CHARACTER_ATTRIBUTE_LABELS: Record<CharacterAttributeId, string> = {
  precision: '提示精准',
  empathy: '共情细腻',
  creativity: '创意温度',
  context: '上下文广度',
  depth: '思考深度',
}

export const LINEUP_MAX_SIZE = 6

/** 角色天赋四阶解锁等级 */
export const TALENT_TIER_UNLOCK_LEVELS = [1, 6, 11, 16] as const

export const TALENT_TIER_LABELS = ['初阶', '进阶', '高阶', '绝学'] as const

export const BUILTIN_PERSONALITY_SKILL_DEFS: Array<
  Omit<CharacterPersonalitySkill, 'level' | 'maxLevel' | 'unlockLevel'>
> = [
  {
    id: 'inspiration_flash',
    name: '灵感闪现',
    description: '僵局中给出记忆点',
    attributeId: 'creativity',
    triggerTiming: '发言轮到自己且场上信息矛盾或僵局时',
    triggerEffect: '给出一条非常规但可验证的推论',
    matchEffect: '发言额外点出一个被忽略的票型或发言矛盾',
    matchPhases: ['speech', 'discussion'],
  },
  {
    id: 'witty_remarks',
    name: '妙语连珠',
    description: '复杂局面讲清楚',
    attributeId: 'precision',
    triggerTiming: '需要向全场解释复杂逻辑时',
    triggerEffect: '用比喻或短句压缩信息',
    matchEffect: '发言用一句话总结当前站边理由',
    matchPhases: ['speech', 'discussion'],
  },
  {
    id: 'empathy_resonance',
    name: '情感共鸣',
    description: '建立信任感',
    attributeId: 'empathy',
    triggerTiming: '他人情绪激烈或对你发出质疑时',
    triggerEffect: '先回应感受再表达立场',
    matchEffect: '被@时先承认对方合理点再转折',
    matchPhases: ['speech', 'critical'],
  },
  {
    id: 'team_synergy',
    name: '协作共振',
    description: '多人讨论中补位',
    attributeId: 'context',
    triggerTiming: '讨论环节需要归纳或接话时',
    triggerEffect: '帮他人补全论点并归纳共识',
    matchEffect: '讨论轮总结前三人观点并表明站边',
    matchPhases: ['discussion'],
  },
  {
    id: 'steady_pace',
    name: '稳定节奏',
    description: '长局保持专注',
    attributeId: 'depth',
    triggerTiming: '长局后期或信息过载时',
    triggerEffect: '过滤无效信息，聚焦关键矛盾',
    matchEffect: '投票前只围绕一个核心嫌疑展开',
    matchPhases: ['vote', 'speech'],
  },
  {
    id: 'logical_chain',
    name: '逻辑链条',
    description: '质疑更有依据',
    attributeId: 'precision',
    triggerTiming: '发现发言前后矛盾时',
    triggerEffect: '按时间线列出矛盾点',
    matchEffect: '发言引用具体轮次与席位指出矛盾',
    matchPhases: ['speech', 'vote'],
  },
  {
    id: 'bold_gambit',
    name: '大胆博弈',
    description: '关键票型敢冒险',
    attributeId: 'depth',
    triggerTiming: '决胜票或关键轮次',
    triggerEffect: '在不确定时仍给出明确站边',
    matchEffect: '投票阶段敢于归票并承担后果',
    matchPhases: ['vote', 'critical'],
  },
  {
    id: 'calm_anchor',
    name: '冷静定锚',
    description: '混乱时稳住阵脚',
    attributeId: 'empathy',
    triggerTiming: '全场互踩、节奏混乱时',
    triggerEffect: '先降温再分析',
    matchEffect: '发言先梳理存活结构再谈嫌疑',
    matchPhases: ['speech', 'critical'],
  },
  {
    id: 'keen_insight',
    name: '洞察先机',
    description: '从细节读出意图',
    attributeId: 'empathy',
    triggerTiming: '他人发言含糊或回避关键问题时',
    triggerEffect: '点出潜台词与情绪动机',
    matchEffect: '发言追问对方为何回避上一轮核心矛盾',
    matchPhases: ['speech', 'discussion'],
  },
  {
    id: 'narrative_twist',
    name: '叙事转折',
    description: '换角度打开局面',
    attributeId: 'creativity',
    triggerTiming: '全场陷入单一叙事或站边固化时',
    triggerEffect: '提出另一种合理解释路径',
    matchEffect: '发言给出与主流不同的第二嫌疑链',
    matchPhases: ['speech', 'discussion'],
  },
  {
    id: 'pressure_probe',
    name: '施压试探',
    description: '关键轮次逼出信息',
    attributeId: 'depth',
    triggerTiming: '需要逼出隐藏信息或验明立场时',
    triggerEffect: '用连续追问压缩对方回旋空间',
    matchEffect: '讨论轮对目标席位提出可验证的追问',
    matchPhases: ['discussion', 'critical'],
  },
  {
    id: 'consensus_bridge',
    name: '共识搭桥',
    description: '弥合分歧找交集',
    attributeId: 'context',
    triggerTiming: '阵营分裂、互不信任时',
    triggerEffect: '找出双方都能接受的最小共识',
    matchEffect: '讨论轮归纳可共同验证的事实再推进',
    matchPhases: ['discussion'],
  },
  {
    id: 'precise_strike',
    name: '精准点破',
    description: '一句话击中要害',
    attributeId: 'precision',
    triggerTiming: '对方逻辑链存在明显漏洞时',
    triggerEffect: '用最少字数指出核心谬误',
    matchEffect: '发言只围绕一个最强矛盾点展开',
    matchPhases: ['speech', 'vote'],
  },
  {
    id: 'silver_tongue',
    name: '舌辩如风',
    description: '复杂局面也能讲透',
    attributeId: 'precision',
    triggerTiming: '需要说服摇摆票或中立位时',
    triggerEffect: '分层递进、先易后难地展开论证',
    matchEffect: '发言结尾给出明确可执行的站边建议',
    matchPhases: ['speech', 'vote'],
  },
  {
    id: 'pattern_read',
    name: '读局直觉',
    description: '从票型看局势',
    attributeId: 'context',
    triggerTiming: '投票前后票型与发言不一致时',
    triggerEffect: '对照历史票型推断阵营结构',
    matchEffect: '投票前点出最反常的一票并说明理由',
    matchPhases: ['vote', 'speech'],
  },
  {
    id: 'heartfelt_persuade',
    name: '真情说服',
    description: '用真诚换信任',
    attributeId: 'empathy',
    triggerTiming: '自己被怀疑或需要争取信任时',
    triggerEffect: '坦诚动机并给出可验证承诺',
    matchEffect: '被@时先说明自己的投票逻辑再回应质疑',
    matchPhases: ['critical', 'speech'],
  },
  {
    id: 'imaginative_leap',
    name: '跳脱想象',
    description: '打破思维定式',
    attributeId: 'creativity',
    triggerTiming: '常规推理陷入僵局时',
    triggerEffect: '引入被忽略的角色关系或时间线',
    matchEffect: '发言提出一个此前无人提及的假设并验证',
    matchPhases: ['speech', 'discussion'],
  },
]

export const BUILTIN_PERSONALITY_TAG_DEFS = [
  '逻辑推理',
  '策略思维',
  '团队协作',
  '情绪共鸣',
  '剧情推理',
  '敏锐观察',
  '语言表达',
  '冷静沉着',
  '创意表达',
  '深度思考',
  '善于伪装',
  '喜欢质疑',
  '擅长总结',
  '逆向思维',
  '温和引导',
  '细节控',
  '快节奏',
  '守序稳健',
] as const

export const BUILTIN_SPEECH_STYLE_DEFS = [
  '活泼',
  '温柔',
  '理性',
  '冷静',
  '傲娇',
  '简洁',
  '幽默',
  '高冷',
  '阴阳怪气',
  '谨慎',
  '热情',
  '慵懒',
] as const

const TAG_ATTRIBUTE_BOOST: Record<string, Partial<CharacterAttributes>> = {
  逻辑推理: { precision: 6, creativity: 4 },
  策略思维: { context: 5, depth: 4 },
  团队协作: { context: 8, empathy: 4 },
  情绪共鸣: { empathy: 10, precision: 3 },
  剧情推理: { creativity: 8, precision: 4 },
  敏锐观察: { empathy: 5, depth: 5 },
  语言表达: { precision: 10, context: 3 },
  冷静沉着: { empathy: 6, depth: 5 },
  创意表达: { precision: 8, creativity: 8 },
  深度思考: { creativity: 7, precision: 5 },
  善于伪装: { creativity: 6, context: 6 },
  喜欢质疑: { precision: 8, depth: 5 },
  擅长总结: { context: 7, precision: 6 },
  逆向思维: { creativity: 9, depth: 4 },
  温和引导: { empathy: 8, context: 5 },
  细节控: { precision: 7, empathy: 5 },
  快节奏: { precision: 6, context: 6 },
  守序稳健: { depth: 8, empathy: 4 },
}

function seedHash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function createDefaultGrowthState(): CharacterGrowthState {
  return { level: 1, exp: 0, totalExp: 0 }
}

export function expRequiredForLevel(level: number): number {
  const safe = Math.max(1, level)
  return Math.floor(200 + safe * 45)
}

export function growthStateFromTotalExp(totalExp: number): CharacterGrowthState {
  let remaining = Math.max(0, totalExp)
  let level = 1
  while (remaining >= expRequiredForLevel(level)) {
    remaining -= expRequiredForLevel(level)
    level += 1
  }
  return { level, exp: remaining, totalExp }
}

export function resolveCharacterGrowth(character: Character): CharacterGrowthState {
  return character.growth ? { ...character.growth } : createDefaultGrowthState()
}

function strategyBonus(strategy: StrategyTendency): Partial<CharacterAttributes> {
  return {
    empathy: Math.round((100 - strategy.empathyVsLogic) * 0.12),
    precision: Math.round(strategy.empathyVsLogic * 0.1),
    depth: Math.round(strategy.cautiousVsBold * 0.1),
    context: Math.round((100 - strategy.leadVsFollow) * 0.08),
    creativity: Math.round((strategy.empathyVsLogic + strategy.cautiousVsBold) * 0.05),
  }
}

const SPEECH_STYLE_ATTRIBUTE_BOOST: Record<string, Partial<CharacterAttributes>> = {
  活泼: { precision: 6, depth: 5 },
  温柔: { empathy: 7, context: 4 },
  理性: { precision: 5, creativity: 4 },
  冷静: { empathy: 5, depth: 4 },
  傲娇: { precision: 6, depth: 3 },
  简洁: { precision: 8, context: 3 },
  幽默: { creativity: 7, empathy: 4 },
  高冷: { depth: 6, precision: 4 },
  阴阳怪气: { creativity: 6, precision: 5 },
  谨慎: { depth: 7, empathy: 4 },
  热情: { empathy: 6, precision: 5 },
  慵懒: { depth: 5, creativity: 5 },
}

function speechStyleBonus(speechStyle: string): Partial<CharacterAttributes> {
  return SPEECH_STYLE_ATTRIBUTE_BOOST[speechStyle] || { precision: 3, empathy: 3 }
}

export function computeCharacterAttributes(character: Character): CharacterAttributes {
  const growth = resolveCharacterGrowth(character)
  const levelScale = (growth.level - 1) * 1.6
  const baseSeed = seedHash(character.id)
  const attrs: CharacterAttributes = {
    precision: 42 + (baseSeed % 11),
    empathy: 40 + ((baseSeed >> 3) % 12),
    creativity: 41 + ((baseSeed >> 6) % 10),
    context: 39 + ((baseSeed >> 9) % 11),
    depth: 40 + ((baseSeed >> 12) % 10),
  }

  for (const tag of character.tags) {
    const boost = TAG_ATTRIBUTE_BOOST[tag]
    if (!boost) continue
    for (const key of Object.keys(boost) as CharacterAttributeId[]) {
      attrs[key] += boost[key] || 0
    }
  }

  for (const strength of character.strengths) {
    const boost = TAG_ATTRIBUTE_BOOST[strength]
    if (!boost) continue
    for (const key of Object.keys(boost) as CharacterAttributeId[]) {
      attrs[key] += Math.round((boost[key] || 0) * 0.6)
    }
  }

  const strat = strategyBonus(character.strategy)
  const speech = speechStyleBonus(character.speechStyle)
  for (const key of Object.keys(attrs) as CharacterAttributeId[]) {
    attrs[key] += (strat[key] || 0) + (speech[key] || 0) + Math.round(levelScale)
  }

  for (const key of Object.keys(attrs) as CharacterAttributeId[]) {
    attrs[key] = clamp(Math.round(attrs[key]), 20, 120)
  }
  return attrs
}

function skillLevelForCharacter(level: number, unlockLevel: number): number {
  if (level < unlockLevel) return 0
  return clamp(1 + Math.floor((level - unlockLevel) / 5), 1, 5)
}

function buildPersonalitySkillFromDef(
  def: (typeof BUILTIN_PERSONALITY_SKILL_DEFS)[number],
  tierIndex: number,
  growthLevel: number
): CharacterPersonalitySkill {
  const unlockLevel = TALENT_TIER_UNLOCK_LEVELS[tierIndex] ?? 1 + tierIndex * 5
  return {
    ...def,
    unlockLevel,
    maxLevel: 5,
    level: skillLevelForCharacter(growthLevel, unlockLevel),
  }
}

/** 创建角色时基于初始人设随机分配 4 个不同阶别的天赋 */
export function rollCharacterTalents(character: Character): string[] {
  const attrs = computeCharacterAttributes(character)
  const ranked = (Object.keys(attrs) as CharacterAttributeId[])
    .map((id) => ({ id, value: attrs[id] }))
    .sort((a, b) => b.value - a.value)

  const seedBase = seedHash(
    `${character.id}:${character.tags.join(',')}:${character.speechStyle}:${character.strengths.join(',')}`
  )
  const used = new Set<string>()
  const chosen: string[] = []

  for (let tier = 0; tier < 4; tier += 1) {
    const attrId = ranked[tier % ranked.length]?.id ?? ranked[0]?.id ?? 'precision'
    const preferred = BUILTIN_PERSONALITY_SKILL_DEFS.filter(
      (skill) => skill.attributeId === attrId && !used.has(skill.id)
    )
    const pool = preferred.length
      ? preferred
      : BUILTIN_PERSONALITY_SKILL_DEFS.filter((skill) => !used.has(skill.id))
    if (!pool.length) break
    const pick = pool[(seedBase + tier * 9973) % pool.length]
    used.add(pick.id)
    chosen.push(pick.id)
  }

  while (chosen.length < 4) {
    const fallback = BUILTIN_PERSONALITY_SKILL_DEFS.find((skill) => !used.has(skill.id))
    if (!fallback) break
    used.add(fallback.id)
    chosen.push(fallback.id)
  }

  return chosen
}

function resolveLegacyTalentIds(character: Character): string[] {
  const attrs = computeCharacterAttributes(character)
  const ranked = (Object.keys(attrs) as CharacterAttributeId[])
    .map((id) => ({ id, value: attrs[id] }))
    .sort((a, b) => b.value - a.value)

  const used = new Set<string>()
  const ids: string[] = []
  for (const entry of ranked) {
    const candidates = BUILTIN_PERSONALITY_SKILL_DEFS.filter(
      (skill) => skill.attributeId === entry.id && !used.has(skill.id)
    )
    if (!candidates.length) continue
    const pick = candidates[seedHash(`${character.id}:${entry.id}`) % candidates.length]
    used.add(pick.id)
    ids.push(pick.id)
    if (ids.length >= 4) break
  }
  while (ids.length < 4) {
    const fallback = BUILTIN_PERSONALITY_SKILL_DEFS.find((skill) => !used.has(skill.id))
    if (!fallback) break
    used.add(fallback.id)
    ids.push(fallback.id)
  }
  return ids
}

export function computePersonalitySkills(character: Character): CharacterPersonalitySkill[] {
  const growth = resolveCharacterGrowth(character)
  const talentIds =
    character.talentIds?.length === 4 ? character.talentIds : resolveLegacyTalentIds(character)

  return talentIds.slice(0, 4).map((id, index) => {
    const def = BUILTIN_PERSONALITY_SKILL_DEFS.find((skill) => skill.id === id)
    if (!def) {
      const fallback = BUILTIN_PERSONALITY_SKILL_DEFS[index % BUILTIN_PERSONALITY_SKILL_DEFS.length]
      return buildPersonalitySkillFromDef(fallback, index, growth.level)
    }
    return buildPersonalitySkillFromDef(def, index, growth.level)
  })
}

export function personalitySkillsForMatchPhase(
  character: Character,
  phase: import('./character-agent').MatchSkillPhase
): CharacterPersonalitySkill[] {
  return computePersonalitySkills(character).filter(
    (s) => s.level > 0 && s.matchPhases.includes(phase)
  )
}

export function formatPersonalitySkillForMatch(skill: CharacterPersonalitySkill): string {
  return `- ${skill.name} Lv.${skill.level}｜时机：${skill.triggerTiming}｜效果：${skill.matchEffect}`
}

export function buildMatchPersonalitySkillContext(
  character: Character,
  phase: import('./character-agent').MatchSkillPhase
): string {
  const active = personalitySkillsForMatchPhase(character, phase)
  if (!active.length) return ''
  return '【角色天赋】\n' + active.map(formatPersonalitySkillForMatch).join('\n')
}

export interface TokenUsageLike {
  completion_tokens?: number
  total_tokens?: number
}

/** 从网关 usage 或输出文本估算 completion token 数 */
export function resolveCompletionTokens(usage?: TokenUsageLike | null, contentFallback?: string): number {
  const reported = usage?.completion_tokens
  if (typeof reported === 'number' && reported > 0) return reported
  const text = (contentFallback || '').trim()
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 3.5))
}

/** 经验与模型输出 token 成正比（约 6 output tokens = 1 EXP） */
export function expFromCompletionTokens(completionTokens: number): number {
  const tokens = Math.max(0, completionTokens)
  if (tokens === 0) return 2
  return Math.max(2, Math.floor(tokens / 6))
}

export function estimateMatchBonusExp(options: { won: boolean; isMvp?: boolean }): number {
  let bonus = 0
  if (options.won) bonus += 15
  if (options.isMvp) bonus += 10
  return bonus
}

/** @deprecated 已由 expFromCompletionTokens 取代，保留供迁移参考 */
export function estimateMatchExp(options: {
  won: boolean
  isMvp?: boolean
  gameModeId: string
}): number {
  return estimateMatchBonusExp(options)
}

export function retroactiveTotalExp(character: Character): number {
  const matches = character.stats.matchCount || 0
  const wins = character.stats.winCount || 0
  return matches * 70 + wins * 35
}

export function attributeDeltaText(before: CharacterAttributes, after: CharacterAttributes): string {
  const parts: string[] = []
  for (const key of Object.keys(CHARACTER_ATTRIBUTE_LABELS) as CharacterAttributeId[]) {
    const delta = after[key] - before[key]
    if (delta > 0) parts.push(`${CHARACTER_ATTRIBUTE_LABELS[key]}+${delta}`)
  }
  return parts.join(' · ')
}

export function computeAttributeDeltas(
  before: CharacterAttributes,
  after: CharacterAttributes
): Partial<Record<CharacterAttributeId, number>> {
  const deltas: Partial<Record<CharacterAttributeId, number>> = {}
  for (const key of Object.keys(CHARACTER_ATTRIBUTE_LABELS) as CharacterAttributeId[]) {
    const delta = after[key] - before[key]
    if (delta !== 0) deltas[key] = delta
  }
  return deltas
}

export interface CharacterLevelProjection {
  level: number
  attributes: CharacterAttributes
  skills: CharacterPersonalitySkill[]
  starRating: number
  unlockedTalentCount: number
}

export function withCharacterLevel(character: Character, level: number): Character {
  const growth = resolveCharacterGrowth(character)
  return {
    ...character,
    growth: { ...growth, level: Math.max(1, Math.round(level)) },
  }
}

export function projectCharacterAtLevel(character: Character, targetLevel: number): CharacterLevelProjection {
  const level = Math.max(1, Math.round(targetLevel))
  const sim = withCharacterLevel(character, level)
  const projectedSkills = computePersonalitySkills(sim)
  return {
    level,
    attributes: computeCharacterAttributes(sim),
    skills: projectedSkills,
    starRating: computeStarRating(level),
    unlockedTalentCount: projectedSkills.filter((s) => s.level > 0).length,
  }
}

/** 雷达图对比用：下一天赋解锁等级，或后续星级门槛 */
export function nextGrowthCompareLevel(currentLevel: number): number {
  const nextTalent = TALENT_TIER_UNLOCK_LEVELS.find((level) => level > currentLevel)
  if (nextTalent) return nextTalent
  for (const threshold of [24, 36, 50]) {
    if (threshold > currentLevel) return threshold
  }
  return Math.min(currentLevel + 5, 50)
}

/** 1-7 星，随等级缓慢提升，用于展示角色成熟度 */
export function computeStarRating(level: number): number {
  if (level >= 50) return 7
  if (level >= 36) return 6
  if (level >= 24) return 5
  if (level >= 16) return 4
  if (level >= 10) return 3
  if (level >= 5) return 2
  return 1
}

/** @deprecated 已由 expFromCompletionTokens 取代 */
export function estimateChatExp(): number {
  return 2
}

export function formatExpProgress(character: Character): { current: number; max: number; percent: number; level: number } {
  const growth = resolveCharacterGrowth(character)
  const max = expRequiredForLevel(growth.level)
  return {
    level: growth.level,
    current: growth.exp,
    max,
    percent: Math.min(100, Math.round((growth.exp / max) * 100)),
  }
}
