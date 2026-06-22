/** Agent Arena 领域类型 — 主进程与渲染层共享 */

import type { ThemeId } from '../types'

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

export interface GameModePreference {
  modeId: string
  preferredRoles: string[]
  avoidRoles: string[]
  notes?: string
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
  gender: 'female' | 'male' | 'other'
  ageLabel: string
  bio: string
  tags: string[]
  speechStyle: string
  commonPhrases: string[]
  behaviorPrinciples: string[]
  tabooBehaviors: string[]
  strategy: StrategyTendency
  strengths: string[]
  weaknesses: string[]
  gameModePreferences: GameModePreference[]
  roleStrategies: RoleStrategyPreference[]
  status: CharacterStatus
  accentColor: string
  stats: CharacterStats
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
}

export interface MatchMessage {
  id: string
  kind: MessageKind
  participantId: string
  participantName: string
  roleLabel: string | null
  content: string
  thought?: string
  streamStatus?: MessageStreamStatus
  createdAt: string
  round: number
  phaseId: string
  confirmed: boolean
}

export interface MatchVoteRecord {
  id: string
  voterId: string
  voterName: string
  targetId: string | null
  targetName: string | null
  abstain: boolean
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
  activeVoteMessageId?: string | null
  werewolfState?: WerewolfRuntimeState
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
  roomCode: string
  createdAt: string
  updatedAt: string
  startedAt: string | null
  endedAt: string | null
}

export interface ArenaSettings {
  themeId: ThemeId
  themeMode: 'light' | 'dark' | 'system'
  uiScale: 100 | 125 | 150
  animationEnabled: boolean
  compactLayout: boolean
  glassEffect: boolean
  bgmEnabled: boolean
  sfxEnabled: boolean
  bgmVolume: number
  sfxVolume: number
  autoSaveMatch: boolean
  modelCallHints: boolean
  balanceReminder: boolean
  balanceReminderThresholdCents: number
  dataRetentionDays: number
  defaultIdentityAssignMode: IdentityAssignMode
  matchDefaults: {
    confirmBeforeStart: boolean
    pauseOnLowBalance: boolean
    autoAdvance: boolean
    autoNextRound: boolean
    narratorEnabled: boolean
    fastMode: boolean
    showEmotionTags: boolean
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
  >
>

export interface ArenaStoreData {
  version: number
  characters: Character[]
  matches: Match[]
  snapshots: MatchSnapshot[]
  settings: ArenaSettings
  logs: ArenaLogEntry[]
  seededAt: string | null
  /** 已发放过的默认角色 catalog key（通常为 seed.modelId），避免编辑后重复补种 */
  introducedSeedKeys?: string[]
  gameModeOverrides?: Record<string, GameModeOverride>
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
}

export interface CharacterFilter {
  query?: string
  modelId?: string
  status?: CharacterStatus | 'all'
  tag?: string
  sort?: 'updated' | 'created' | 'name' | 'matches'
}

export interface MatchFilter {
  query?: string
  status?: MatchStatus | 'all'
  gameModeId?: string
}

export interface DashboardSummary {
  characters: Character[]
  recentMatches: Match[]
  resumableMatch: Match | null
  gameModes: GameMode[]
  walletBalanceCents: number | null
  recentCostCents: number
}
