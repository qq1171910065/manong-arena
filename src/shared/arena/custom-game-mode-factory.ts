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
  const description = input.description?.trim() || '围绕自定义议题进行多轮圆桌发言；玩家担任裁判，结束时产出讨论纪要。'

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
    setupSummary: '多轮圆桌发言，玩家担任裁判引导轮次；结束时产出讨论纪要。',
    ruleHighlights: [
      '围绕用户设定的议题自由讨论。',
      '玩家担任裁判，每轮后总结引导或解说。',
      '不支持用户 AI 分身参战。',
      '保持角色人设与发言风格，回应他人观点。',
    ],
    roles: [{ id: 'participant', name: '参与者', camp: 'neutral', hidden: false, description: '圆桌讨论参与者。' }],
    phases: [
      { id: 'opening', name: '开场', kind: 'action', order: 1, description: '裁判介绍议题与流程。' },
      { id: 'round-discuss', name: '圆桌发言', kind: 'discussion', order: 2, description: '按席位轮流发言；每轮结束后由裁判引导。' },
      { id: 'closing', name: '产物归纳', kind: 'result', order: 3, description: '归纳讨论纪要产物。' },
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
      '## 玩法说明\n\n本玩法为自定义圆桌讨论。参与者围绕议题轮流发言，保持人设与风格，回应他人观点。\n\n## 裁判（玩家）\n\n- 不支持 AI 主持人/解说与用户分身参战。\n- 每轮全员发言后由玩家总结引导或解说。\n- 结束时系统归纳讨论产物。\n\n## 讨论目标\n\n- 清晰表达立场\n- 回应他人论点\n- 在限定轮次内形成可回顾的讨论脉络',
    systemRoles: [
      {
        id: 'judge',
        kind: 'judge',
        name: '裁判',
        enabled: true,
        promptSlotIds: ['judge'],
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
