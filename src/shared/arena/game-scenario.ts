/** 玩法場景架構 — 提示詞驅動、引擎分派、系統角色配置 */

/** 硬編碼流程引擎類型；不同引擎可共用同一套 Prompt 體系 */
export type GameEngineKind = 'werewolf' | 'roundtable' | 'prompt-only'

/** 玩法詳情頁變體 */
export type GameDetailPageKind = 'werewolf' | 'roundtable' | 'generic'

/** Prompt 槽位 — 一份玩法可配置多份同槽位模板（版本/風格） */
export type PromptSlotId =
  | 'game_rules'
  | 'speech'
  | 'vote'
  | 'judge'
  | 'narrator'
  | 'host'
  | 'learning'
  | 'exam'
  | 'post_game_review'
  | 'behavior_adjust'
  | 'match_recap'

export type PromptOutputFormat = 'json' | 'text' | 'vote'

/** 單條提示詞模板，支援 {{variable}} 佔位 */
export interface PromptTemplate {
  id: string
  slotId: PromptSlotId
  name: string
  description?: string
  systemTemplate: string
  userTemplate?: string
  outputFormat?: PromptOutputFormat
  isDefault?: boolean
}

/** 一份玩法可有多套 Prompt 包（標準版、快節奏、教學向等） */
export interface PromptPack {
  id: string
  scenarioId: string
  name: string
  description?: string
  templates: PromptTemplate[]
  isBuiltin?: boolean
  createdAt: string
  updatedAt: string
}

export type SystemRoleKind = 'judge' | 'narrator' | 'host' | 'commentator'

/** 裁判、解說等系統角色配置 */
export interface SystemRoleConfig {
  id: string
  kind: SystemRoleKind
  name: string
  enabled: boolean
  /** 綁定 AI 角色時使用其 modelId 與人設 */
  characterId?: string
  modelId?: string
  /** 該角色使用的 prompt 槽位 */
  promptSlotIds: PromptSlotId[]
}

/**
 * 玩法場景定義 — 泛化容器
 * - `contentDocument`：完整玩法說明，供 AI 學習與對局注入
 * - `engineKind`：決定步進邏輯（可寫死）
 * - `defaultPromptPackId`：對局預設使用的提示詞包
 */
export interface GameScenarioDefinition {
  id: string
  name: string
  subtitle: string
  description: string
  engineKind: GameEngineKind
  detailPageKind: GameDetailPageKind
  /** 關聯 GameMode.id（規則元數據、階段、人數） */
  gameModeId: string
  /** 玩法正文 — 角色學習與對局理解的唯一來源 */
  contentDocument: string
  systemRoles: SystemRoleConfig[]
  defaultPromptPackId: string
  requiresLearning: boolean
  requiresExam: boolean
  minPlayers: number
  maxPlayers: number
  recommendedPlayers: number
  imageKey: string
  isBuiltin: boolean
  isAvailable: boolean
  /** 圓桌等自由玩法：討論主題或議程 */
  discussionTopic?: string
  /** 圓桌：預設討論輪數 */
  defaultRounds?: number
  createdAt?: string
  updatedAt?: string
}

/** Prompt 渲染上下文變數 */
export interface PromptRenderContext {
  characterName?: string
  characterBio?: string
  speechStyle?: string
  commonPhrases?: string[]
  behaviorPrinciples?: string[]
  tabooBehaviors?: string[]
  gameModeName?: string
  phaseName?: string
  phaseDescription?: string
  roleContext?: string
  gameRules?: string
  recentMessages?: string
  aliveList?: string
  discussionTopic?: string
  round?: number
  /** 學習後的角色對玩法的初始理解 */
  initialUnderstanding?: string
  matchSummary?: string
  /** 赛后复盘：本角色身份与阵营 */
  myRoleContext?: string
  /** 赛后复盘：对本角色而言的胜负与状态 */
  outcomeForSelf?: string
  thisRoundMessages?: string
  lastRoundTail?: string
  mentionedBy?: string
  replyBrief?: string
  [key: string]: string | number | string[] | undefined
}

export interface ResolvedPrompt {
  system: string
  user: string
  outputFormat: PromptOutputFormat
  templateId: string
  packId: string
}
