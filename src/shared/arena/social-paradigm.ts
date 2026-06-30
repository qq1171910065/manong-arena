/** 社交型 AI 场景范式 — 从具体玩法抽象为提示词工程容器 */

import type { GameEngineKind, GameScenarioDefinition } from './game-scenario'

export type SocialParadigmId =
  | 'free_discussion'
  | 'brainstorm_artifact'
  | 'hidden_role_social'
  | 'word_deduction'
  | 'custom_prompt'

export interface SocialParadigmDefinition {
  id: SocialParadigmId
  label: string
  shortLabel: string
  description: string
  /** 提示词工程关注点 */
  promptFocus: string[]
  /** 适用引擎 */
  engineKinds: GameEngineKind[]
}

export const SOCIAL_PARADIGMS: SocialParadigmDefinition[] = [
  {
    id: 'free_discussion',
    label: '纯讨论',
    shortLabel: '讨论',
    description: '无隐藏身份、无胜负，围绕议题展开观点碰撞；玩家担任裁判，结束时产出讨论纪要。',
    promptFocus: ['议题澄清', '观点回应', '人设口吻', '倾听与追问', '讨论产物归纳'],
    engineKinds: ['roundtable', 'prompt-only'],
  },
  {
    id: 'brainstorm_artifact',
    label: '头脑风暴',
    shortLabel: '共创',
    description: '围绕议题发散讨论，结束时归纳可落地的产物（规则草案、角色清单等）。',
    promptFocus: ['议题澄清', '发散补充', '可执行草案', '产物归纳'],
    engineKinds: ['brainstorm'],
  },
  {
    id: 'hidden_role_social',
    label: '规则化社交博弈',
    shortLabel: '博弈',
    description: '信息不对称、阶段发言与集体决策；狼人杀等是此范式的具体规则实例。',
    promptFocus: ['公开/私有信息边界', '阶段约束', '站边与说服', '投票与联盟'],
    engineKinds: ['werewolf'],
  },
  {
    id: 'word_deduction',
    label: '词语推理',
    shortLabel: '卧底',
    description: '持有相近词语，通过描述与投票找出身份差异；轻量社交博弈。',
    promptFocus: ['描述边界', '信息隐藏', '投票说服', '人设口吻'],
    engineKinds: ['undercover'],
  },
  {
    id: 'custom_prompt',
    label: '自定义场景',
    shortLabel: '自定义',
    description: '以玩法文档与提示词包定义规则，引擎仅负责步进或纯 Prompt 驱动。',
    promptFocus: ['规则文档', '槽位模板', '系统角色', '行为准则注入'],
    engineKinds: ['prompt-only', 'roundtable'],
  },
]

export function resolveParadigmForEngine(engineKind: GameEngineKind): SocialParadigmDefinition {
  if (engineKind === 'werewolf') {
    return SOCIAL_PARADIGMS.find((p) => p.id === 'hidden_role_social')!
  }
  if (engineKind === 'roundtable') {
    return SOCIAL_PARADIGMS.find((p) => p.id === 'free_discussion')!
  }
  if (engineKind === 'brainstorm') {
    return SOCIAL_PARADIGMS.find((p) => p.id === 'brainstorm_artifact')!
  }
  if (engineKind === 'undercover') {
    return SOCIAL_PARADIGMS.find((p) => p.id === 'word_deduction')!
  }
  return SOCIAL_PARADIGMS.find((p) => p.id === 'custom_prompt')!
}

export function resolveParadigmForScenario(scenario: Pick<GameScenarioDefinition, 'engineKind' | 'gameModeId'>): SocialParadigmDefinition {
  if (scenario.gameModeId === 'roundtable') return resolveParadigmForEngine('roundtable')
  if (scenario.gameModeId === 'werewolf') return resolveParadigmForEngine('werewolf')
  if (scenario.gameModeId.startsWith('brainstorm-')) return resolveParadigmForEngine('brainstorm')
  if (scenario.gameModeId === 'undercover') return resolveParadigmForEngine('undercover')
  return resolveParadigmForEngine(scenario.engineKind)
}

export function resolveParadigmForGameMode(mode: {
  id: string
  engineKind?: GameEngineKind
}): SocialParadigmDefinition {
  if (mode.id === 'roundtable') return resolveParadigmForEngine('roundtable')
  if (mode.id === 'werewolf') return resolveParadigmForEngine('werewolf')
  if (mode.id.startsWith('brainstorm-')) return resolveParadigmForEngine('brainstorm')
  if (mode.id === 'undercover') return resolveParadigmForEngine('undercover')
  return resolveParadigmForEngine(mode.engineKind || 'prompt-only')
}

export function groupGameModesByParadigm<T extends { id: string; engineKind?: GameEngineKind }>(
  modes: T[]
): Array<{ paradigm: SocialParadigmDefinition; items: T[] }> {
  const order: SocialParadigmId[] = [
    'free_discussion',
    'brainstorm_artifact',
    'hidden_role_social',
    'word_deduction',
    'custom_prompt',
  ]
  const buckets = new Map<SocialParadigmId, T[]>()
  for (const mode of modes) {
    const paradigm = resolveParadigmForGameMode(mode)
    const list = buckets.get(paradigm.id) || []
    list.push(mode)
    buckets.set(paradigm.id, list)
  }
  return order
    .map((id) => {
      const paradigm = SOCIAL_PARADIGMS.find((p) => p.id === id)!
      const items = buckets.get(id) || []
      return items.length ? { paradigm, items } : null
    })
    .filter(Boolean) as Array<{ paradigm: SocialParadigmDefinition; items: T[] }>
}

export function groupScenariosByParadigm<T extends Pick<GameScenarioDefinition, 'engineKind' | 'gameModeId'>>(
  scenarios: T[]
): Array<{ paradigm: SocialParadigmDefinition; items: T[] }> {
  const order: SocialParadigmId[] = [
    'free_discussion',
    'brainstorm_artifact',
    'hidden_role_social',
    'word_deduction',
    'custom_prompt',
  ]
  const buckets = new Map<SocialParadigmId, T[]>()
  for (const scenario of scenarios) {
    const paradigm = resolveParadigmForScenario(scenario)
    const list = buckets.get(paradigm.id) || []
    list.push(scenario)
    buckets.set(paradigm.id, list)
  }
  return order
    .map((id) => {
      const paradigm = SOCIAL_PARADIGMS.find((p) => p.id === id)!
      const items = buckets.get(id) || []
      return items.length ? { paradigm, items } : null
    })
    .filter(Boolean) as Array<{ paradigm: SocialParadigmDefinition; items: T[] }>
}

export const ROUNDTABLE_TOPIC_PRESETS = [
  'AI 时代，人类还需要怎样的真实连接？',
  '如果团队只能保留一种沟通方式，你会选什么？',
  '观点冲突时，应该先求共识还是先求真相？',
  '当 AI 能替我们发言，「在场」还意味着什么？',
  '设计一场适合 AI 角色参与的社交规则，你会怎么定？',
] as const

/** 圆桌会话形态：纯讨论 vs 头脑风暴（发散共创） */
export type RoundtableSessionKind = 'discussion' | 'brainstorm'

export type BrainstormCategoryId =
  | 'game_design'
  | 'character_design'
  | 'rules_review'
  | 'pre_game_config'
  | 'balance_discussion'
  | 'free'

export interface BrainstormCategoryDefinition {
  id: BrainstormCategoryId
  label: string
  description: string
  /** 注入提示词：本类头脑风暴的行为约束 */
  sessionGuide: string
  topicPresets: readonly string[]
}

export const ROUNDTABLE_SESSION_OPTIONS: Array<{
  id: RoundtableSessionKind
  label: string
  description: string
}> = [
  {
    id: 'discussion',
    label: '圆桌讨论',
    description: '围绕议题交换观点，倾听与回应；玩家担任裁判，结束时产出讨论纪要。',
  },
  {
    id: 'brainstorm',
    label: '头脑风暴',
    description: '发散共创：设计玩法、塑造角色、审视规则漏洞与开局配置。',
  },
]

export const BRAINSTORM_CATEGORIES: BrainstormCategoryDefinition[] = [
  {
    id: 'game_design',
    label: '玩法设计',
    description: '讨论局内流程、阶段与胜负条件，产出可落地的规则草案。',
    sessionGuide:
      '头脑风暴 · 玩法设计：提出可执行的规则与阶段设计；可质疑现有流程，但须给出替代方案。禁止空泛「加强平衡」类口号。',
    topicPresets: [
      '为 AI 角色设计一套 6 人社交博弈：阶段、信息公开与胜负如何定？',
      '若要在狼人杀之外做一款「轻规则」社交场景，核心机制应是什么？',
      '局内流程里，哪一阶段最考验提示词工程？应如何约束 AI 行为？',
    ],
  },
  {
    id: 'character_design',
    label: '角色塑造',
    description: '讨论人设、口吻、行为原则如何在场景中一致外显。',
    sessionGuide:
      '头脑风暴 · 角色塑造：从人设、说话方式、原则与禁忌出发，讨论角色在场景中的可识别行为；可提出具体台词或原则草案。',
    topicPresets: [
      '如何让一个「谨慎逻辑型」角色在讨论中不抢戏又有存在感？',
      '设计一个适合圆桌的 AI 主持人人设：边界与口吻应如何定？',
      '角色常见口癖与行为原则，怎样写才不会在对局中显得机械？',
    ],
  },
  {
    id: 'rules_review',
    label: '规则漏洞',
    description: '从博弈角度审视规则可被利用的漏洞与修复思路。',
    sessionGuide:
      '头脑风暴 · 规则漏洞：主动寻找规则可被钻空子的情形（联盟、信息泄露、阶段边界等），并讨论修补或接受为「高级战术」。',
    topicPresets: [
      '狼人杀警长 1.5 票与警徽流，有哪些可被刻意利用的漏洞？',
      '信息不对称场景里，「公开站边」与「隐藏身份」的边界应如何写进提示词？',
      '若允许 AI 在队内私密频道沟通，对公平性与观赏性有何影响？',
    ],
  },
  {
    id: 'pre_game_config',
    label: '开局配置',
    description: '讨论进入场景前的参数：人数、轮数、议题、模型与提示词包等。',
    sessionGuide:
      '头脑风暴 · 开局配置：聚焦「进局之前」应配置什么（人数、轮数、议题、身份扩展、提示词包、学习校验等），讨论配置如何影响 AI 表现。',
    topicPresets: [
      '创建场景时，哪些配置项应默认开启、哪些应交给用户？',
      '圆桌 3 轮 vs 6 轮，对讨论深度与成本有何权衡？',
      '开局前强制「学习玩法」，对角色表现与成本是否合理？',
    ],
  },
  {
    id: 'balance_discussion',
    label: '博弈平衡',
    description: '讨论阵营强弱、信息结构与可接受的随机性。',
    sessionGuide:
      '头脑风暴 · 博弈平衡：比较阵营或角色强度、信息获取节奏；提出可量化的调整方向（人数比、技能次数、阶段长度）。',
    topicPresets: [
      '好人阵营在标准狼人杀里有哪些结构性劣势？如何靠规则微调？',
      '纯讨论场景是否需要「主持控场」来避免强者垄断发言？',
      'AI 模型能力差异较大时，场景规则应如何兜底公平性？',
    ],
  },
  {
    id: 'free',
    label: '自由共创',
    description: '自定义焦点，不限于以上类别。',
    sessionGuide:
      '头脑风暴 · 自由共创：在议题下发散观点，可提出草案、清单或待验证假设；鼓励彼此补充与质疑。',
    topicPresets: [
      '如果我们要把 Manong Arena 做成「AI 养成」而非「玩游戏」，产品还应补什么？',
      '社交型 AI 场景里，提示词工程最容易被忽视的一环是什么？',
    ],
  },
]

export function resolveBrainstormCategory(id: BrainstormCategoryId): BrainstormCategoryDefinition {
  return BRAINSTORM_CATEGORIES.find((c) => c.id === id) || BRAINSTORM_CATEGORIES.find((c) => c.id === 'free')!
}

export function formatRoundtableSessionLabel(
  sessionKind?: RoundtableSessionKind,
  brainstormCategory?: BrainstormCategoryId
): string {
  if (sessionKind === 'brainstorm') {
    const cat = brainstormCategory ? resolveBrainstormCategory(brainstormCategory) : null
    return cat ? `头脑风暴 · ${cat.label}` : '头脑风暴'
  }
  return '圆桌讨论'
}
