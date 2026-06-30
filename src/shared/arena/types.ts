/** Agent Arena 领域类型 — 主进程与渲染层共享 */

import type { GameEngineKind, GameScenarioDefinition, PromptPack } from './game-scenario'
export type { CharacterExpressionId } from './character-visuals'
import type { CharacterExpressionId } from './character-visuals'
export type {
  CharacterAttributeId,
  CharacterAttributes,
  CharacterGrowthSnapshot,
  CharacterGrowthState,
  CharacterLineup,
  CharacterPersonalitySkill,
  LineupGrowthRecord,
} from './character-growth'

export type CharacterStatus = 'enabled' | 'disabled'
export type MatchStatus = 'draft' | 'active' | 'paused' | 'completed' | 'aborted' | 'archived'
export type IdentityAssignMode = 'random' | 'manual' | 'semi-random'
export type ModelCallStatus =
  | 'pending'
  | 'calling'
  | 'success'
  | 'empty'
  | 'format_error'
  | 'overreach'
  | 'illegal_action'
  | 'timeout'
  | 'failed'
  | 'insufficient_balance'
  | 'retrying'
  | 'skipped'
  | 'recovered'

export type StepAdvanceState = 'ready' | 'waiting' | 'paused' | 'disabled'
export type PhaseActionKind = 'speech' | 'vote' | 'night' | 'judge' | 'system' | 'idle'
export type HumanInputKind =
  | 'speech'
  | 'vote'
  | 'wolf_chat'
  | 'wolf_kill'
  | 'guard_protect'
  | 'seer_check'
  | 'witch_antidote'
  | 'witch_poison'
export type ParticipantAliveStatus = 'alive' | 'eliminated' | 'spectating'
export type MessageKind = 'speech' | 'system' | 'event' | 'vote' | 'judge' | 'warning' | 'resource'
export type MessageStreamStatus = 'pending' | 'streaming' | 'done' | 'failed'
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogScope = 'storage' | 'character' | 'match' | 'engine' | 'model' | 'billing' | 'platform' | 'ui'

export interface StrategyTendency {
  empathyVsLogic: number
  cautiousVsBold: number
  leadVsFollow: number
}

export interface RoleStrategyPreference {
  roleId: string
  description: string
}

/** @deprecated 已由 CharacterGameSkill 取代，保留供遷移 */
export interface GameModePreference {
  modeId: string
  preferredRoles: string[]
  avoidRoles: string[]
  notes?: string
}

/** 玩法技能学习记录 — 初始学习、再次学习、赛后讨论 */
export interface SkillLearningEntry {
  id: string
  source: 'initial' | 'relearn' | 'post_match'
  matchId?: string
  summary: string
  understanding?: string
  createdAt: string
}

/** 角色技能 — 會玩哪些玩法（取代 gameModePreferences） */
export interface CharacterGameSkill {
  scenarioId: string
  scenarioName?: string
  /** 是否已完成玩法学习 */
  learned: boolean
  /** 是否通过考试 */
  examPassed: boolean
  /** 用户开后门免考（仍须学习） */
  examBypassed: boolean
  /** 学习后基于性格形成的初始理解 */
  initialUnderstanding?: string
  initialStrategy?: string
  learnedAt?: string | null
  examPassedAt?: string | null
  notes?: string
  /** 学习历程：含赛后讨论沉淀 */
  learningLog?: SkillLearningEntry[]
  /** 深度学习的假设列表 */
  hypotheses?: string[]
  /** 心智模型摘要 */
  mentalModel?: string
  /** 易错边界 */
  edgeCases?: string[]
  /** 常见误区 */
  commonMistakes?: string[]
}

export interface CharacterChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  /** 弹窗流式回复状态 */
  streamStatus?: MessageStreamStatus
}

export interface CharacterGrowthRecord {
  id: string
  characterId: string
  source: 'chat' | 'post_game_review'
  matchId?: string
  scenarioId?: string
  summary: string
  createdAt: string
  addedPrinciples: string[]
  removedPrinciples: string[]
  addedPhrases: string[]
  applied: boolean
}

/** 赛后行为准则调整记录 — 可追溯 */
export interface BehaviorChangeRecord {
  id: string
  characterId: string
  matchId: string
  scenarioId: string
  createdAt: string
  summary: string
  previousPrinciples: string[]
  newPrinciples: string[]
  addedPrinciples: string[]
  removedPrinciples: string[]
  trigger: 'post_game_review' | 'manual' | 'chat'
  reviewPromptId?: string
  modelCallId?: string
  applied: boolean
}

export interface CharacterStats {
  matchCount: number
  winCount: number
  avgCostCents: number
  lastMatchAt: string | null
}

export interface Character {
  id: string
  name: string
  subtitle: string
  modelId: string
  avatarUrl: string
  portraitUrl: string
  /** 横版立绘 / banner */
  portraitHorizontalUrl?: string
  /** 表情素材，键为 neutral/thinking/confident/happy/sad/angry */
  expressionUrls?: Partial<Record<CharacterExpressionId, string>>
  /** 绑定的内置角色素材 ID，如 doubao */
  visualPackId?: string
  /** 是否为当前用户的 AI 分身（全局唯一） */
  isUserProfile?: boolean
  gender: 'female' | 'male' | 'other'
  ageLabel: string
  bio: string
  tags: string[]
  speechStyle: string
  /** MiMo-V2.5-TTS 预置音色 ID，如 冰糖 / 苏打 / mimo_default */
  ttsVoiceId?: string
  /** MiMo user message：自然语言风格 / 导演模式指令 */
  ttsStyleInstruction?: string
  /** MiMo assistant 开头 (风格) 标签，如 ['温柔','活泼'] */
  ttsOpeningStyleTags?: string[]
  /** 自动从说话方式映射 (风格) 标签，默认 true */
  ttsAutoStyleTags?: boolean
  /** 自动从说话方式补充自然语言风格指令，默认 true */
  ttsAutoStyleInstruction?: boolean
  /** 播报微调说明 — 与自动分析结果合并后用于合成 */
  ttsAdjustNotes?: string
  /** 最近一次自动分析摘要（只读展示） */
  ttsAnalyzedSummary?: string
  commonPhrases: string[]
  behaviorPrinciples: string[]
  tabooBehaviors: string[]
  strategy: StrategyTendency
  strengths: string[]
  weaknesses: string[]
  /** @deprecated 迁移至 gameSkills */
  gameModePreferences?: GameModePreference[]
  roleStrategies: RoleStrategyPreference[]
  /** 会玩什么游戏 — 含学习/考试状态 */
  gameSkills: CharacterGameSkill[]
  status: CharacterStatus
  accentColor: string
  stats: CharacterStats
  /** 等级与经验（属性由等级与人设计算得出） */
  growth?: import('./character-growth').CharacterGrowthState
  createdAt: string
  updatedAt: string
}

export interface GameModeRole {
  id: string
  name: string
  camp: string
  hidden: boolean
  description?: string
  skillName?: string
  skillDescription?: string
  timing?: string
  publicInfo?: string
  nightOrder?: number
  isGod?: boolean
}

export interface GameModePhase {
  id: string
  name: string
  kind: 'night' | 'day' | 'discussion' | 'vote' | 'action' | 'result'
  order: number
  description: string
}

/** 局内公开发言渲染配置（@ 提及、玩法术语高亮） */
export interface SpeechTermHighlight {
  term: string
  label?: string
}

export interface SpeechDisplayConfig {
  /** 是否高亮 @ 席位 / 角色名，默认 true */
  highlightMentions?: boolean
  terms?: SpeechTermHighlight[]
}

export interface GameMode {
  id: string
  name: string
  subtitle: string
  description: string
  minPlayers: number
  maxPlayers: number
  recommendedPlayers: number
  roles: GameModeRole[]
  phases: GameModePhase[]
  hasHiddenRoles: boolean
  hasVoting: boolean
  estimatedCostPerPlayerCents: number
  estimatedDurationMinutes: number
  imageKey: string
  setupSummary?: string
  sheriffRule?: string
  ruleHighlights?: string[]
  /** 关联玩法场景 id */
  scenarioId?: string
  /** 引擎类型，用于步进分派 */
  engineKind?: GameEngineKind
  /** 局内发言展示：@ 提及与术语高亮 */
  speechDisplay?: SpeechDisplayConfig
}

export interface MatchParticipant {
  characterId: string
  characterName: string
  avatarUrl: string
  accentColor: string
  modelId: string
  seatOrder: number
  roleId: string | null
  roleName: string | null
  roleCamp: string | null
  alive: ParticipantAliveStatus
  isSpeaking: boolean
  isSheriff?: boolean
  revealed?: boolean
  /** 当前席位由 AI 还是真人操控 */
  controlledBy?: 'ai' | 'user'
}

export interface MatchMessage {
  id: string
  kind: MessageKind
  participantId: string
  participantName: string
  roleLabel: string | null
  content: string
  thought?: string
  /** 仅上帝视角可见的补充说明（如夜间各角色技能详情） */
  godViewContent?: string
  streamStatus?: MessageStreamStatus
  createdAt: string
  round: number
  phaseId: string
  confirmed: boolean
  /** 真人玩家亲自输入的发言（区别于 AI 生成） */
  isHumanPlayer?: boolean
}

export interface MatchVoteRecord {
  id: string
  voterId: string
  voterName: string
  targetId: string | null
  targetName: string | null
  abstain: boolean
  /** explicit=角色主动弃权；parse_failed=模型输出无法解析，按弃权计入 */
  abstainReason?: 'explicit' | 'parse_failed' | null
  round: number
  phaseId: string
  createdAt: string
}

export interface MatchPublicEvent {
  id: string
  icon: string
  text: string
  createdAt: string
  phaseId: string
  round: number
}

export interface MatchRecapMoment {
  id: string
  round: number
  type: 'highlight' | 'reversal'
  title: string
  description: string
}

/** 解说授予的本局 MVP（后续写入角色战绩） */
export interface MatchRecapMvp {
  characterId: string
  characterName: string
  seatOrder: number
  reason: string
}

/** 赛后战报：解说总结 + 局内高光与反转 */
export interface MatchRecap {
  summary: string
  highlights: MatchRecapMoment[]
  reversals: MatchRecapMoment[]
  mvp?: MatchRecapMvp | null
  generatedAt: string
  source: 'narrator' | 'fallback'
}

export interface ModelCallRecord {
  id: string
  matchId: string
  characterId: string
  characterName: string
  modelId: string
  phaseId: string
  phaseName: string
  status: ModelCallStatus
  requestAt: string
  responseAt: string | null
  costCents: number
  retryCount: number
  errorType: string | null
  errorMessage: string | null
  billed: boolean
  rolledBack: boolean
  finalResult: string | null
}

export interface MatchSnapshot {
  id: string
  matchId: string
  label: string
  createdAt: string
  state: MatchRuntimeState
}

export interface MatchAnomalyRecord {
  id: string
  matchId: string
  type: string
  message: string
  createdAt: string
  resolved: boolean
  resolution: string | null
  characterId?: string
  severity?: 'info' | 'warning' | 'error'
}


export interface WerewolfRuntimeState {
  sheriffId: string | null
  sheriffHistory: string[]
  /** 警上宣布竞选的玩家 characterId 列表 */
  sheriffCandidates?: string[]
  guardedLastNightId: string | null
  guardedTonightId?: string | null
  guardedThisNightId?: string | null
  wolfKillTargetId?: string | null
  seerChecks: Array<{ round: number; seerId: string; targetId: string; camp: string }>
  antidoteUsed: boolean
  poisonUsed: boolean
  witchSaveTargetId?: string | null
  witchPoisonTargetId?: string | null
  poisonedCharacterIds?: string[]
  hunterShotUsed?: boolean
  hunterShotIds?: string[]
  revealedIdiotIds: string[]
  nightDeaths?: string[]
  lastNightSummary?: string | null
  charmedTargetId?: string | null
  charmedById?: string | null
  knightUsed?: boolean
  gravediggerLastDeathCamp?: string | null
  wolfKingShotIds?: string[]
  whiteWolfKingShotIds?: string[]
  /** 第一夜结束后狼人阵营互相知晓队友 */
  wolfTeamRevealed?: boolean
  /** 狼队私密沟通记录（不进入公开频道） */
  wolfTeamMessages?: WolfTeamMessage[]
  /** 狼队刀人队内投票 */
  wolfKillVotes?: WolfKillVoteRecord[]
  /** 当前夜晚狼队流程：沟通 → 队内投票 → 完成 */
  wolfNightStep?: 'discussion' | 'kill_vote' | 'done' | null
  /** 队内投票锁定的刀口目标 */
  wolfKillTargetId?: string | null
  /** 狼队流程所属轮次 */
  wolfNightRound?: number | null
  /** 女巫夜间：解药 → 毒药 */
  witchNightStep?: 'antidote' | 'poison' | 'done' | null
  witchNightRound?: number | null
  /** 本夜刀口（供女巫决策展示） */
  pendingKnifeTargetId?: string | null
  witchAntidoteDecided?: boolean
  witchUseAntidote?: boolean
  witchPoisonDecided?: boolean
  /** 真人女巫本夜选择的毒药目标；null 表示不用 */
  witchHumanPoisonTargetId?: string | null
  /** 守卫夜间 */
  guardNightRound?: number | null
  guardDecided?: boolean
  /** null 表示本夜不守护或无可守目标 */
  guardHumanTargetId?: string | null
  /** 预言家夜间 */
  seerNightRound?: number | null
  seerDecided?: boolean
  seerHumanTargetId?: string | null
}

export interface WolfTeamMessage {
  id: string
  participantId: string
  participantName: string
  content: string
  round: number
  createdAt: string
}

export interface WolfKillVoteRecord {
  voterId: string
  targetId: string
  round: number
  createdAt: string
}

export interface RoundtableRuntimeState {
  discussionTopic: string
  totalRounds: number
  hostEnabled: boolean
  narratorEnabled: boolean
  designTarget?: string
  brainstormCategory?: import('./social-paradigm').BrainstormCategoryId
  /** 头脑风暴结束时归纳的产物摘要 */
  artifactSummary?: string
}

export interface UndercoverRuntimeState {
  civilianWord: string
  undercoverWord: string
  wordByCharacterId: Record<string, string>
  describeRounds: number
}

export interface MatchRuntimeState {
  currentPhaseId: string
  currentPhaseName: string
  currentPhaseKind: GameModePhase['kind']
  phaseIndex: number
  currentRound: number
  currentSpeakerId: string | null
  currentActionKind: PhaseActionKind
  speechQueue: string[]
  actedCharacterIds: string[]
  stepAdvanceState: StepAdvanceState
  modelCallStatus: ModelCallStatus | null
  pendingActionId: string | null
  submittedActionIds: string[]
  voteOpen: boolean
  voteTargetId: string | null
  waitingHint: string | null
  sheriffId?: string | null
  /** 狼人杀：是否启用警长竞选与警徽机制 */
  sheriffEnabled?: boolean
  activeVoteMessageId?: string | null
  werewolfState?: WerewolfRuntimeState
  roundtableState?: RoundtableRuntimeState
  undercoverState?: UndercoverRuntimeState
  /** 本局使用的提示词包 id */
  promptPackId?: string
  /** 本局创建时快照的系统角色模型（裁判/解说等） */
  systemRoleModels?: Record<string, string>
  /** 遗言阶段待发言的出局者 */
  pendingLastWordsIds?: string[]
  /** 本局用户 AI 分身的 characterId（若参战） */
  userProfileCharacterId?: string | null
  /** 当前由真人接管的 characterId */
  humanControlledId?: string | null
  /** 本局曾切换上帝视角，禁止再次真人接管 */
  humanTakeoverLocked?: boolean
  /** 等待真人输入的发言消息 id */
  humanInputMessageId?: string | null
  /** 当前等待的真人操作类型 */
  humanInputKind?: HumanInputKind | null
}

export interface Match {
  id: string
  title: string
  gameModeId: string
  gameModeName: string
  status: MatchStatus
  identityAssignMode: IdentityAssignMode
  participantIds: string[]
  participants: MatchParticipant[]
  messages: MatchMessage[]
  votes: MatchVoteRecord[]
  events: MatchPublicEvent[]
  modelCalls: ModelCallRecord[]
  anomalies: MatchAnomalyRecord[]
  runtime: MatchRuntimeState
  totalCostCents: number
  estimatedCostCents: number
  resultSummary: string | null
  winnerCamp: string | null
  recap?: MatchRecap | null
  roomCode: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  endedAt: string | null
  /** 狼人杀：启用的规则扩展（如夜间遗言） */
  werewolfRuleModules?: import('./werewolf-dlc').WerewolfRuleModuleId[]
  /** 狼人杀：胜负条件（屠边 / 屠城） */
  werewolfWinCondition?: import('./werewolf-win-condition').WerewolfWinCondition
}

export interface ArenaSettings {
  uiScale: 100 | 125 | 150
  animationEnabled: boolean
  compactLayout: boolean
  glassEffect: boolean
  bgmEnabled: boolean
  sfxEnabled: boolean
  bgmVolume: number
  sfxVolume: number
  /** 局内角色发言 TTS 播报 */
  ttsEnabled: boolean
  ttsVolume: number
  /** 裁判/解说 TTS 音色（固定使用 mimo-v2.5-tts） */
  judgeVoiceId: string
  autoSaveMatch: boolean
  modelCallHints: boolean
  balanceReminder: boolean
  balanceReminderThresholdCents: number
  dataRetentionDays: number
  defaultIdentityAssignMode: IdentityAssignMode
  /** 全局兜底模型：角色绑定、玩法系统模型等已选模型优先，仅在其未配置或不可用时使用 */
  defaultModelId: string
  matchDefaults: {
    confirmBeforeStart: boolean
    pauseOnLowBalance: boolean
    autoAdvance: boolean
    autoNextRound: boolean
    narratorEnabled: boolean
    /** 裁判裁定、阶段公告等 TTS 播报 */
    judgeTtsEnabled: boolean
    fastMode: boolean
    showEmotionTags: boolean
    /** 对局房间界面：classic 标准分栏 / immersive 沉浸圆桌 */
    matchRoomLayout: 'classic' | 'immersive'
  }
  /** 角色演化：赛后复盘与行为准则微调 */
  characterEvolution: {
    postGameReviewEnabled: boolean
    autoApplyBehaviorChanges: boolean
  }
}

export interface ArenaLogEntry {
  id: string
  level: LogLevel
  scope: LogScope
  message: string
  detail?: string
  matchId?: string
  characterId?: string
  createdAt: string
}

export type GameModeOverride = Partial<
  Pick<
    GameMode,
    | 'name'
    | 'subtitle'
    | 'description'
    | 'minPlayers'
    | 'maxPlayers'
    | 'recommendedPlayers'
    | 'estimatedCostPerPlayerCents'
    | 'estimatedDurationMinutes'
    | 'setupSummary'
    | 'sheriffRule'
    | 'ruleHighlights'
    | 'speechDisplay'
  >
>

export interface ArenaStoreStats {
  characterCount: number
  matchCount: number
  snapshotCount: number
  logCount: number
  gameModeOverrideCount: number
  customGameModeCount: number
  installedGameModeCount: number
  installedGameModeIds: string[]
  seededAt: string | null
  /** 用户 AI 分身角色 id */
  userProfileCharacterId?: string | null
}

export interface ArenaStoreData {
  version: number
  characters: Character[]
  matches: Match[]
  snapshots: MatchSnapshot[]
  settings: ArenaSettings
  logs: ArenaLogEntry[]
  seededAt: string | null
  /** 已安装的玩法 id（入门初始化或用户后续安装） */
  installedGameModeIds?: string[]
  /** 已发放过的默认角色 catalog key（通常为 seed.modelId），避免编辑后重复补种 */
  introducedSeedKeys?: string[]
  gameModeOverrides?: Record<string, GameModeOverride>
  /** 用户自建玩法（非内置模板） */
  customGameModes?: GameMode[]
  /** 用户自定义玩法场景 */
  customScenarios?: GameScenarioDefinition[]
  /** 用户自定义提示词包 */
  customPromptPacks?: PromptPack[]
  /** 行为准则变更历史（全局索引，按 characterId 查询） */
  behaviorChangeLog?: BehaviorChangeRecord[]
  /** 角色对话记录 */
  characterChatLogs?: Record<string, CharacterChatMessage[]>
  /** 玩法答疑对话（key = gameModeId） */
  gameModeQALogs?: Record<string, CharacterChatMessage[]>
  /** 帮助中心对话 */
  helpChatLog?: CharacterChatMessage[]
  /** 角色成长记录（对话等） */
  characterGrowthLog?: CharacterGrowthRecord[]
  /** 用户 AI 分身角色 id（全局唯一） */
  userProfileCharacterId?: string | null
  /** 角色阵容 */
  characterLineups?: import('./character-growth').CharacterLineup[]
  /** 当前展示的阵容 id */
  activeLineupId?: string | null
  /** 角色属性/等级成长快照（趋势图与日志） */
  characterGrowthSnapshots?: import('./character-growth').CharacterGrowthSnapshot[]
  /** 阵容组队战绩记录 */
  lineupGrowthLog?: import('./character-growth').LineupGrowthRecord[]
}

export interface ArenaResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
  code?: string
}

export interface CreateMatchInput {
  gameModeId: string
  characterIds: string[]
  identityAssignMode?: IdentityAssignMode
  title?: string
  manualRoles?: Record<string, string>
  /** 提示词包 id，默认使用场景 defaultPromptPackId */
  promptPackId?: string
  /** 圆桌：讨论议题 */
  discussionTopic?: string
  /** 圆桌：讨论轮数 */
  roundtableRounds?: number
  /** 头脑风暴：设计焦点 */
  designTarget?: string
  /** 狼人杀：启用的扩展身份 id（如 knight、wolf_king） */
  werewolfDlcs?: string[]
  /** 狼人杀：是否开启警长玩法，默认开启 */
  sheriffEnabled?: boolean
  /** 狼人杀：启用的规则扩展模块（如 night_last_words） */
  werewolfRuleModules?: string[]
  /** 狼人杀：胜负条件 side_slaughter=屠边 city_slaughter=屠城，默认屠城 */
  werewolfWinCondition?: string
  /** 跳过未学习/未通过考试的角色检查（用户开后门） */
  skipLearningCheck?: boolean
}

export interface CharacterFilter {
  query?: string
  modelId?: string
  status?: CharacterStatus | 'all'
  tag?: string
  sort?: 'updated' | 'created' | 'name' | 'matches' | 'level'
}

export interface MatchFilter {
  query?: string
  status?: MatchStatus | 'all'
  gameModeId?: string
}

export interface DashboardSummary {
  characters: Character[]
  allCharacters: Character[]
  recentMatches: Match[]
  resumableMatch: Match | null
  walletBalanceCents: number | null
  recentCostCents: number
  behaviorChanges: BehaviorChangeRecord[]
  growthRecords: CharacterGrowthRecord[]
}
