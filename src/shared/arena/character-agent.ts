/** 角色作为智能体的记忆、技能与文件空间 */

import type { Character } from './types'

export type CharacterMemoryCategory = 'fact' | 'preference' | 'relationship' | 'task' | 'note'
export type CharacterMemorySource = 'manual' | 'chat' | 'match' | 'import'
export type CharacterMemoryImportance = 1 | 2 | 3

export interface CharacterMemoryEntry {
  id: string
  category: CharacterMemoryCategory
  content: string
  importance: CharacterMemoryImportance
  pinned: boolean
  source: CharacterMemorySource
  /** 对局记忆所属玩法；仅在该玩法对局内注入，不影响私聊与其他玩法 */
  gameModeId?: string
  createdAt: string
  updatedAt: string
}

export interface CharacterAgentProfile {
  extraInstructions?: string
  workspacePurpose?: string
  useMemoryInChat?: boolean
  useSkillsInChat?: boolean
  useWorkspaceInChat?: boolean
}

export type MatchSkillPhase = 'speech' | 'vote' | 'discussion' | 'critical'
export type AgentSkillScope = 'chat' | 'match' | 'both'

export interface CharacterAgentSkill {
  id: string
  name: string
  description: string
  /** 触发时机（自然语言，展示用） */
  triggerTiming: string
  /** 触发后的行为效果（私聊/通用） */
  triggerEffect: string
  /** 对局内具体效果 */
  matchEffect?: string
  /** 对局内生效阶段 */
  matchPhases?: MatchSkillPhase[]
  scope?: AgentSkillScope
  /** 私聊执行要点 */
  instructions: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface CharacterWorkspaceFile {
  id: string
  name: string
  relativePath: string
  mimeType: string
  sizeBytes: number
  description?: string
  createdAt: string
  updatedAt: string
}

export const CHARACTER_MEMORY_MAX = 80
export const CHARACTER_AGENT_SKILL_MAX = 12
export const CHARACTER_WORKSPACE_FILE_MAX = 32
export const CHARACTER_WORKSPACE_TEXT_MAX_BYTES = 256 * 1024

export const MEMORY_CATEGORY_LABELS: Record<CharacterMemoryCategory, string> = {
  fact: '事实',
  preference: '偏好',
  relationship: '关系',
  task: '任务',
  note: '备注',
}

export const MATCH_SKILL_PHASE_LABELS: Record<MatchSkillPhase, string> = {
  speech: '发言',
  vote: '投票',
  discussion: '讨论',
  critical: '关键轮',
}

export const AGENT_SKILL_SCOPE_LABELS: Record<AgentSkillScope, string> = {
  chat: '私聊',
  match: '对局',
  both: '通用',
}

export const BUILTIN_AGENT_SKILL_TEMPLATES: Array<
  Pick<
    CharacterAgentSkill,
    'name' | 'description' | 'triggerTiming' | 'triggerEffect' | 'matchEffect' | 'matchPhases' | 'scope' | 'instructions'
  >
> = [
  {
    name: '深度分析',
    description: '复杂局面下结构化拆解',
    triggerTiming: '用户提出开放问题，或信息量大、需要取舍时',
    triggerEffect: '先列 2-3 个关键维度，再给出结论与取舍理由',
    matchEffect: '发言前先点明当前核心矛盾，再给出站边',
    matchPhases: ['speech', 'discussion'],
    scope: 'both',
    instructions: '先拆解再结论，避免空泛表态。',
  },
  {
    name: '共情倾听',
    description: '优先回应情绪与诉求',
    triggerTiming: '用户表达困扰、挫败或强烈情绪时',
    triggerEffect: '先复述感受与诉求，再给建议',
    matchEffect: '被质疑时先承认对方合理点，再转折表达立场',
    matchPhases: ['speech', 'critical'],
    scope: 'both',
    instructions: '语气温暖，不抢话，保持角色个性。',
  },
  {
    name: '创意发散',
    description: '提供多路径方案',
    triggerTiming: '需要 brainstorm、策划或多种备选时',
    triggerEffect: '给出 2-3 个方向并比较优劣',
    matchEffect: '讨论环节提出非常规但可执行的破局点',
    matchPhases: ['discussion'],
    scope: 'both',
    instructions: '每个方向一句话说明适用条件。',
  },
  {
    name: '严谨求证',
    description: '边界清晰、不编造',
    triggerTiming: '信息不足或存在事实争议时',
    triggerEffect: '明确不确定处，列出需补充的信息',
    matchEffect: '投票前要求对方澄清前后矛盾的发言',
    matchPhases: ['speech', 'vote'],
    scope: 'both',
    instructions: '不编造细节，可提出验证问题。',
  },
]

function defaultAgentSkillFields(partial: Partial<CharacterAgentSkill>): CharacterAgentSkill {
  return {
    triggerTiming: partial.triggerTiming || '用户明确相关诉求时',
    triggerEffect: partial.triggerEffect || partial.instructions || partial.description || '',
    matchEffect: partial.matchEffect,
    matchPhases: partial.matchPhases || ['speech'],
    scope: partial.scope || 'both',
    ...partial,
  } as CharacterAgentSkill
}

export function normalizeAgentSkill(skill: CharacterAgentSkill): CharacterAgentSkill {
  return defaultAgentSkillFields({
    ...skill,
    triggerTiming: skill.triggerTiming || '用户明确相关诉求时',
    triggerEffect: skill.triggerEffect || skill.instructions || skill.description || '',
    matchPhases: skill.matchPhases?.length ? skill.matchPhases : ['speech'],
    scope: skill.scope || 'both',
  })
}

export function normalizeAgentSkills(skills?: CharacterAgentSkill[] | null): CharacterAgentSkill[] {
  return (skills || []).slice(0, CHARACTER_AGENT_SKILL_MAX).map(normalizeAgentSkill)
}

export function formatAgentSkillForPrompt(skill: CharacterAgentSkill, scope: AgentContextScope): string | null {
  if (!skill.enabled) return null
  const s = normalizeAgentSkill(skill)
  if (scope === 'chat' && s.scope === 'match') return null
  if (scope === 'match' && s.scope === 'chat') return null
  if (scope === 'chat') {
    return `- ${s.name}｜时机：${s.triggerTiming}｜效果：${s.triggerEffect}${s.instructions ? `｜要点：${s.instructions}` : ''}`
  }
  return `- ${s.name}｜时机：${s.triggerTiming}｜对局：${s.matchEffect || s.triggerEffect}`
}

export function normalizeAgentMemories(entries?: CharacterMemoryEntry[] | null): CharacterMemoryEntry[] {
  return (entries || []).slice(0, CHARACTER_MEMORY_MAX)
}

export function agentSkillsForMatchPhase(
  skills: CharacterAgentSkill[] | null | undefined,
  phase: MatchSkillPhase
): CharacterAgentSkill[] {
  return normalizeAgentSkills(skills).filter((s) => {
    if (!s.enabled || s.scope === 'chat') return false
    const phases = s.matchPhases?.length ? s.matchPhases : (['speech'] as MatchSkillPhase[])
    return phases.includes(phase)
  })
}

export interface WorkspaceTextExcerpt {
  name: string
  content: string
}

function strategyHint(value: number, left: string, right: string): string | null {
  if (value <= 35) return left
  if (value >= 65) return right
  return null
}

/** 由既有性格字段隐式组装智能体设定摘要（只读展示用） */
export function buildImplicitAgentPersonaSummary(character: Character): string {
  const parts: string[] = []
  if (character.subtitle.trim()) parts.push(character.subtitle.trim())
  if (character.bio.trim()) parts.push(character.bio.trim().slice(0, 120))
  if (character.tags.length) parts.push(`标签：${character.tags.slice(0, 5).join('、')}`)
  if (character.speechStyle.trim()) parts.push(`说话：${character.speechStyle.trim()}`)
  const strategy = character.strategy
  const tendencies = [
    strategyHint(strategy.empathyVsLogic, '偏感性', '偏理性'),
    strategyHint(strategy.cautiousVsBold, '偏谨慎', '偏冒险'),
    strategyHint(strategy.leadVsFollow, '偏主导', '偏跟随'),
  ].filter(Boolean)
  if (tendencies.length) parts.push(`倾向：${tendencies.join('、')}`)
  if (character.strengths.length) parts.push(`擅长 ${character.strengths.slice(0, 3).join('、')}`)
  return parts.slice(0, 4).join(' · ') || '由档案与人设字段自动组装'
}

export type AgentContextScope = 'chat' | 'match'

export function normalizeAgentProfile(profile?: CharacterAgentProfile | null): CharacterAgentProfile {
  return {
    extraInstructions: profile?.extraInstructions?.trim() || '',
    workspacePurpose: profile?.workspacePurpose?.trim() || '',
    useMemoryInChat: profile?.useMemoryInChat !== false,
    useSkillsInChat: profile?.useSkillsInChat !== false,
    useWorkspaceInChat: profile?.useWorkspaceInChat !== false,
  }
}

/** 按场景过滤记忆：私聊不含对局记忆；对局仅含当前玩法的对局记忆 */
export function filterMemoriesForScope(
  memories: CharacterMemoryEntry[] | null | undefined,
  scope: AgentContextScope,
  gameModeId?: string
): CharacterMemoryEntry[] {
  const list = normalizeAgentMemories(memories).filter((m) => m.content.trim())
  if (scope === 'chat') {
    return list.filter((m) => m.source !== 'match')
  }
  if (!gameModeId) return []
  return list.filter((m) => m.source === 'match' && m.gameModeId === gameModeId)
}

/** 记忆、技能、工作区 — 按场景注入，私聊与对局互不干扰 */
export function buildAgentContextPrompt(input: {
  scope: AgentContextScope
  gameModeId?: string
  memories?: CharacterMemoryEntry[] | null
  skills?: CharacterAgentSkill[] | null
  workspaceExcerpts?: WorkspaceTextExcerpt[]
  profile?: CharacterAgentProfile | null
  matchPhase?: MatchSkillPhase
}): string {
  const blocks: string[] = []
  const profile = normalizeAgentProfile(input.profile)

  if (input.scope === 'chat') {
    if (profile.useSkillsInChat) {
      const lines = normalizeAgentSkills(input.skills)
        .map((s) => formatAgentSkillForPrompt(s, 'chat'))
        .filter(Boolean)
      if (lines.length) {
        blocks.push('【技能库】\n' + lines.join('\n'))
      }
    }

    if (profile.useMemoryInChat) {
      const memories = filterMemoriesForScope(input.memories, 'chat')
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
          return b.importance - a.importance
        })
        .slice(0, 24)
      if (memories.length) {
        blocks.push(
          '【长期记忆】\n' +
            memories.map((m) => `- [${MEMORY_CATEGORY_LABELS[m.category]}] ${m.content}`).join('\n')
        )
      }
    }

    if (profile.useWorkspaceInChat && input.workspaceExcerpts?.length) {
      const excerpts = input.workspaceExcerpts
        .filter((f) => f.content.trim())
        .slice(0, 4)
        .map((f) => `--- ${f.name} ---\n${f.content.trim()}`)
      if (excerpts.length) {
        blocks.push('【文件空间参考】\n' + excerpts.join('\n\n'))
      }
    }

    return blocks.join('\n\n')
  }

  const memories = filterMemoriesForScope(input.memories, 'match', input.gameModeId)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.importance - a.importance
    })
    .slice(0, 12)
  if (memories.length) {
    blocks.push(
      '【本玩法对局记忆】\n' +
        memories.map((m) => `- [${MEMORY_CATEGORY_LABELS[m.category]}] ${m.content}`).join('\n')
    )
  }

  const phase = input.matchPhase || 'speech'
  const agentLines = agentSkillsForMatchPhase(input.skills, phase)
    .map((s) => formatAgentSkillForPrompt(s, 'match'))
    .filter(Boolean)
  if (agentLines.length) {
    blocks.push('【对局技能库】\n' + agentLines.join('\n'))
  }

  return blocks.join('\n\n')
}
