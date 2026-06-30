/** 角色等级、属性与专属技能 — 纯计算，与等级/人设相关 */

import type { Character, StrategyTendency } from './types'

export type CharacterAttributeId =
  | 'expression'
  | 'empathy'
  | 'imagination'
  | 'collaboration'
  | 'activity'

export interface CharacterAttributes {
  expression: number
  empathy: number
  imagination: number
  collaboration: number
  activity: number
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
  expression: '表达力',
  empathy: '共情力',
  imagination: '想象力',
  collaboration: '协作力',
  activity: '活跃度',
}

export const LINEUP_MAX_SIZE = 6

export const BUILTIN_PERSONALITY_SKILL_DEFS: Array<
  Omit<CharacterPersonalitySkill, 'level' | 'maxLevel' | 'unlockLevel'>
> = [
  { id: 'inspiration_flash', name: '灵感闪现', description: '关键时刻冒出独特观点，发言更有记忆点。', attributeId: 'imagination' },
  { id: 'witty_remarks', name: '妙语连珠', description: '措辞生动，能把复杂局面讲清楚。', attributeId: 'expression' },
  { id: 'empathy_resonance', name: '情感共鸣', description: '更容易感知他人情绪，建立信任。', attributeId: 'empathy' },
  { id: 'team_synergy', name: '协作共振', description: '在多人讨论中自然接话、补位与归纳。', attributeId: 'collaboration' },
  { id: 'steady_pace', name: '稳定节奏', description: '长局里保持专注，减少无效发言。', attributeId: 'activity' },
  { id: 'logical_chain', name: '逻辑链条', description: '推理步骤清晰，质疑更有依据。', attributeId: 'expression' },
  { id: 'bold_gambit', name: '大胆博弈', description: '敢于在关键票型上做出冒险判断。', attributeId: 'activity' },
  { id: 'calm_anchor', name: '冷静定锚', description: '局势混乱时先稳住阵脚再分析。', attributeId: 'empathy' },
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
] as const

export const BUILTIN_SPEECH_STYLE_DEFS = ['活泼', '温柔', '理性', '冷静', '傲娇'] as const

const TAG_ATTRIBUTE_BOOST: Record<string, Partial<CharacterAttributes>> = {
  逻辑推理: { expression: 6, imagination: 4 },
  策略思维: { collaboration: 5, activity: 4 },
  团队协作: { collaboration: 8, empathy: 4 },
  情绪共鸣: { empathy: 10, expression: 3 },
  剧情推理: { imagination: 8, expression: 4 },
  敏锐观察: { empathy: 5, activity: 5 },
  语言表达: { expression: 10, collaboration: 3 },
  冷静沉着: { empathy: 6, activity: 5 },
  创意表达: { expression: 8, imagination: 8 },
  深度思考: { imagination: 7, expression: 5 },
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
    expression: Math.round(strategy.empathyVsLogic * 0.1),
    activity: Math.round(strategy.cautiousVsBold * 0.1),
    collaboration: Math.round((100 - strategy.leadVsFollow) * 0.08),
    imagination: Math.round((strategy.empathyVsLogic + strategy.cautiousVsBold) * 0.05),
  }
}

const SPEECH_STYLE_ATTRIBUTE_BOOST: Record<string, Partial<CharacterAttributes>> = {
  活泼: { expression: 6, activity: 5 },
  温柔: { empathy: 7, collaboration: 4 },
  理性: { expression: 5, imagination: 4 },
  冷静: { empathy: 5, activity: 4 },
  傲娇: { expression: 6, activity: 3 },
}

function speechStyleBonus(speechStyle: string): Partial<CharacterAttributes> {
  return SPEECH_STYLE_ATTRIBUTE_BOOST[speechStyle] || { expression: 3, empathy: 3 }
}

export function computeCharacterAttributes(character: Character): CharacterAttributes {
  const growth = resolveCharacterGrowth(character)
  const levelScale = (growth.level - 1) * 1.6
  const baseSeed = seedHash(character.id)
  const attrs: CharacterAttributes = {
    expression: 42 + (baseSeed % 11),
    empathy: 40 + ((baseSeed >> 3) % 12),
    imagination: 41 + ((baseSeed >> 6) % 10),
    collaboration: 39 + ((baseSeed >> 9) % 11),
    activity: 40 + ((baseSeed >> 12) % 10),
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
  return clamp(1 + Math.floor((level - unlockLevel) / 7), 1, 5)
}

export function computePersonalitySkills(character: Character): CharacterPersonalitySkill[] {
  const growth = resolveCharacterGrowth(character)
  const attrs = computeCharacterAttributes(character)
  const ranked = (Object.keys(attrs) as CharacterAttributeId[])
    .map((id) => ({ id, value: attrs[id] }))
    .sort((a, b) => b.value - a.value)

  const chosen: CharacterPersonalitySkill[] = []
  const used = new Set<string>()
  for (const entry of ranked) {
    const candidates = BUILTIN_PERSONALITY_SKILL_DEFS.filter(
      (skill) => skill.attributeId === entry.id && !used.has(skill.id)
    )
    if (!candidates.length) continue
    const pick = candidates[seedHash(`${character.id}:${entry.id}`) % candidates.length]
    used.add(pick.id)
    const unlockLevel = 1 + chosen.length * 4
    chosen.push({
      ...pick,
      unlockLevel,
      maxLevel: 5,
      level: skillLevelForCharacter(growth.level, unlockLevel),
    })
    if (chosen.length >= 4) break
  }

  while (chosen.length < 4) {
    const fallback = BUILTIN_PERSONALITY_SKILL_DEFS.find((skill) => !used.has(skill.id))
    if (!fallback) break
    used.add(fallback.id)
    const unlockLevel = 1 + chosen.length * 4
    chosen.push({
      ...fallback,
      unlockLevel,
      maxLevel: 5,
      level: skillLevelForCharacter(growth.level, unlockLevel),
    })
  }

  return chosen
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
