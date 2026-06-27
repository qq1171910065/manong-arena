import { BUILTIN_PROMPT_PACKS } from './prompt-defaults'
import type { GameScenarioDefinition, PromptPack } from './game-scenario'
import type { GameMode } from './types'

export interface UserGameModeBundle {
  mode: GameMode
  scenario: GameScenarioDefinition
  promptPack: PromptPack
}

export interface CreateUserGameModeInput {
  name: string
  subtitle?: string
  description?: string
  discussionTopic?: string
}

const ROUNDTABLE_TEMPLATE = BUILTIN_PROMPT_PACKS.find((pack) => pack.id === 'roundtable-standard')

function clonePromptPack(base: PromptPack, scenarioId: string, packId: string): PromptPack {
  const now = new Date().toISOString()
  return {
    ...structuredClone(base),
    id: packId,
    scenarioId,
    name: `${base.name}（副本）`,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
    templates: base.templates.map((template) => ({
      ...template,
      id: `${packId}-${template.slotId}`,
    })),
  }
}

export function createUserGameModeBundle(input: CreateUserGameModeInput): UserGameModeBundle {
  if (!ROUNDTABLE_TEMPLATE) {
    throw new Error('缺少圆桌讨论模板')
  }

  const modeId = `user-mode-${crypto.randomUUID()}`
  const scenarioId = `user-scenario-${crypto.randomUUID()}`
  const packId = `user-pack-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  const name = input.name.trim() || '自定义玩法'
  const subtitle = input.subtitle?.trim() || '多 AI 议题讨论'
  const description = input.description?.trim() || '围绕自定义议题进行多轮圆桌发言，可选主持人与解说。'

  const mode: GameMode = {
    id: modeId,
    name,
    subtitle,
    description,
    minPlayers: 2,
    maxPlayers: 12,
    recommendedPlayers: 4,
    hasHiddenRoles: false,
    hasVoting: false,
    estimatedCostPerPlayerCents: 112,
    estimatedDurationMinutes: 20,
    imageKey: 'custom',
    scenarioId,
    engineKind: 'roundtable',
    setupSummary: '多轮圆桌发言，按席位轮流讨论自定义议题。',
    ruleHighlights: [
      '围绕用户设定的议题自由讨论。',
      '可选 AI 主持人引导流程、解说概括氛围。',
      '保持角色人设与发言风格，回应他人观点。',
    ],
    roles: [{ id: 'participant', name: '参与者', camp: 'neutral', hidden: false, description: '圆桌讨论参与者。' }],
    phases: [
      { id: 'opening', name: '开场', kind: 'action', order: 1, description: '主持人介绍议题与规则（可选）。' },
      { id: 'round-discuss', name: '圆桌发言', kind: 'discussion', order: 2, description: '按席位轮流发言，多轮进行。' },
      { id: 'closing', name: '总结', kind: 'result', order: 3, description: '讨论结束，可选总结陈词。' },
    ],
  }

  const scenario: GameScenarioDefinition = {
    id: scenarioId,
    name,
    subtitle,
    description,
    engineKind: 'roundtable',
    detailPageKind: 'roundtable',
    gameModeId: modeId,
    contentDocument:
      '## 玩法说明\n\n本玩法为自定义圆桌讨论。参与者围绕议题轮流发言，保持人设与风格，回应他人观点。\n\n## 讨论目标\n\n- 清晰表达立场\n- 回应他人论点\n- 在限定轮次内形成可回顾的讨论脉络',
    systemRoles: [
      {
        id: 'host',
        kind: 'host',
        name: '主持人',
        enabled: true,
        promptSlotIds: ['host'],
      },
      {
        id: 'narrator',
        kind: 'narrator',
        name: '解说',
        enabled: false,
        promptSlotIds: ['narrator'],
      },
    ],
    defaultPromptPackId: packId,
    requiresLearning: true,
    requiresExam: false,
    minPlayers: 2,
    maxPlayers: 12,
    recommendedPlayers: 4,
    imageKey: 'custom',
    isBuiltin: false,
    isAvailable: true,
    discussionTopic: input.discussionTopic?.trim() || '请在此设置讨论议题',
    defaultRounds: 3,
    updatedAt: now,
  }

  const promptPack = clonePromptPack(ROUNDTABLE_TEMPLATE, scenarioId, packId)
  promptPack.name = `${name} · 标准`

  return { mode, scenario, promptPack }
}
