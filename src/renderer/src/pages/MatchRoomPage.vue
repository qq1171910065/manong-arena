<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { AlertTriangle, Bot, Brain, Copy, Crown, Eye, Gamepad2, ListChecks, Loader2, MessageCircle, MoonStar, Radio, ShieldCheck, Sparkles, Users, Vote } from 'lucide-vue-next'
import MatchRoomEscMenu from '@renderer/components/arena/MatchRoomEscMenu.vue'
import MatchRoomFloatingAction from '@renderer/components/arena/MatchRoomFloatingAction.vue'
import MatchRoomImmersiveStage from '@renderer/components/arena/MatchRoomImmersiveStage.vue'
import MatchSpeechContent from '@renderer/components/arena/MatchSpeechContent.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { useImmersiveSpeechCadence } from '@renderer/composables/useImmersiveSpeechCadence'
import { characterAvatarByName } from '@renderer/data/arena-visual-assets'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'
import { route } from '../router'
import { isDiscussionGameModeId } from '@shared/arena/discussion-mode'
import { billingService, canTakeOverMatch, characterService, formatUserMessage, gameModeService, getUserProfileCharacterId, humanPlayerService, isHumanActionPending, isHumanControlledMatch, lockTakeoverOnGodView, matchEngine, matchService, matchWindowService, playArenaTone, settingsService, ttsService, unlockArenaAudio } from '@renderer/services/arena'
import type { MatchStreamPatch } from '@renderer/services/arena/match-engine'
import type { ArenaSettings, Character, Match, MatchMessage, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'
import { resolveSpeechDisplayConfig } from '@shared/arena/speech-display'
import {
  isPlayerSelfSeat,
  participantCampClass,
  visibleRoleNameForParticipant,
} from '@renderer/services/arena/match-room-presenters'

const match = ref<Match | null>(null)
const loading = ref(true)
const advancing = ref(false)
const error = ref('')
const settings = ref(settingsService.defaults())
const copied = ref(false)
const viewMode = ref<'god' | 'player'>('player')
const profileCharacterId = ref<string | null>(null)
const selfPlayerId = computed(() => match.value?.runtime.userProfileCharacterId ?? profileCharacterId.value ?? null)
const guessedRoles = ref<Record<string, string>>({})
const showEvents = ref(false)
const expandedThoughtIds = ref<Set<string>>(new Set())
const collapsedThoughtIds = ref<Set<string>>(new Set())
const messageStreamRef = ref<HTMLElement | null>(null)
const showNewMessageHint = ref(false)
const lastMessageCount = ref(0)
const escMenuRef = ref<InstanceType<typeof MatchRoomEscMenu> | null>(null)
const autoTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)
const kickoffTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)
const characterCache = ref<Map<string, Character>>(new Map())
const judgeTtsSeen = ref<Set<string>>(new Set())
const ttsSpeakingId = ref<string | null>(null)
const ttsSyncedState = new Map<string, { len: number; status: string }>()
const liveRoomTtsEnabled = ref(false)
const roomInteractive = ref(false)
const streamTick = ref(0)
let streamUiRaf = 0

const matchId = computed(() => route.value.id || '')
const mode = computed(() => (match.value ? gameModeService.get(match.value.gameModeId) : null))
const speechDisplayConfig = computed(() =>
  match.value ? resolveSpeechDisplayConfig(match.value.gameModeId, mode.value?.speechDisplay) : null
)
const participants = computed(() => match.value?.participants ?? [])
const aliveParticipants = computed(() => participants.value.filter((p) => p.alive === 'alive'))
const isCompleted = computed(() => match.value?.status === 'completed')
const actionKind = computed(() => match.value?.runtime.currentActionKind ?? 'idle')
const visibleMessages = computed(() => match.value?.messages.slice(-60) ?? [])
const messageEmotions = computed(() => {
  const map = new Map<string, ReturnType<typeof emotionForMessage>>()
  for (const msg of visibleMessages.value) {
    if (msg.kind === 'speech' && msg.streamStatus === 'done') {
      map.set(msg.id, emotionForMessage(msg))
    }
  }
  return map
})
const publicEvents = computed(() => match.value?.events.slice(0, 40) ?? [])
const sheriffId = computed(() => match.value?.runtime.werewolfState?.sheriffId || match.value?.runtime.sheriffId || null)
const sheriff = computed(() => participants.value.find((p) => p.characterId === sheriffId.value) || null)
const werewolfState = computed(() => match.value?.runtime.werewolfState || null)
const guessOptions = computed(() => mode.value?.roles.map((role) => role.name) || [])
const currentPhaseVotes = computed(() => {
  if (!match.value) return []
  const runtime = match.value.runtime
  return match.value.votes.filter((vote) => vote.round === runtime.currentRound && vote.phaseId === runtime.currentPhaseId)
})
const voteEligibleCount = computed(() => {
  const noVote = new Set(match.value?.runtime.currentPhaseId === 'sheriff-vote' ? [] : werewolfState.value?.revealedIdiotIds || [])
  return aliveParticipants.value.filter((p) => !noVote.has(p.characterId)).length
})
const voteProgress = computed(() => voteEligibleCount.value ? Math.min(100, Math.round((currentPhaseVotes.value.length / voteEligibleCount.value) * 100)) : 0)
const activeSpeakerId = computed(() => match.value?.runtime.currentSpeakerId || participants.value.find((p) => p.isSpeaking)?.characterId || visibleMessages.value.at(-1)?.participantId || null)
const activeSpeaker = computed(() => participants.value.find((p) => p.characterId === activeSpeakerId.value) || aliveParticipants.value[0] || participants.value[0] || null)
const actionMeta = computed(() => {
  if (match.value?.runtime.currentPhaseId === 'last-words') {
    return {
      label: '遗言',
      icon: MessageCircle,
      className: 'is-speech',
      hint: '出局玩家依次发表最后公开发言，结束后进入下一阶段。',
    }
  }
  const map = {
    speech: { label: '公开发言', icon: MessageCircle, className: 'is-speech', hint: '逐位按席发言；裁判在后台审阅，阶段结束时统一处理提醒。' },
    vote: { label: match.value?.runtime.currentPhaseId === 'sheriff-vote' ? '警长投票' : '放逐投票', icon: Vote, className: 'is-vote', hint: '投票会整轮提交并公开票流，警长票按 1.5 票计算。' },
    night: { label: '夜晚行动', icon: MoonStar, className: 'is-night', hint: '守卫、狼人、预言家、女巫依次行动，公开频道只展示允许公开的结果。' },
    judge: { label: '裁判复核', icon: ShieldCheck, className: 'is-judge', hint: '裁判检查胜负、技能触发、警徽流转和异常状态。' },
    system: { label: '流程整理', icon: Sparkles, className: 'is-judge', hint: '系统正在整理阶段结果。' },
    idle: { label: '待命', icon: Radio, className: 'is-idle', hint: '等待下一步推进。' },
  }
  return map[actionKind.value as keyof typeof map] || map.idle
})
const PhaseIcon = computed(() => actionMeta.value.icon)
const phaseClass = computed(() => actionMeta.value.className)
const canAdvance = computed(() => Boolean(match.value && match.value.status === 'active' && !isCompleted.value && !humanInputPending.value && (match.value.runtime.stepAdvanceState === 'ready' || match.value.runtime.stepAdvanceState === 'paused')))
const isPaused = computed(() => match.value?.status === 'paused')
const isModelCalling = computed(() => match.value?.runtime.modelCallStatus === 'calling' || advancing.value)
const isImmersiveLayout = computed(() => settings.value.matchDefaults.matchRoomLayout === 'immersive')
const roomBackdropStyle = computed(() => ({
  '--aa-game-bg-image': `url(${arenaHomeAssets.bgClean})`,
}))

const {
  phase: immersiveSpeechPhase,
  speechProgress: immersiveSpeechProgress,
  presentationHold: immersivePresentationHold,
} = useImmersiveSpeechCadence({
  enabled: isImmersiveLayout,
  match,
  visibleMessages,
  activeSpeakerId,
  ttsSpeakingId,
  ttsEnabled: computed(() => settings.value.ttsEnabled),
  modelCalling: isModelCalling,
  actionKind: computed(() => actionKind.value),
  canAdvance,
  advancing,
  streamTick,
  onAdvance: () => {
    void advance('auto')
  },
})

const immersivePhaseLabel = computed(() => match.value?.runtime.currentPhaseName || '对局中')
const activityHint = computed(() => {
  if (error.value) return error.value
  if (isPaused.value) return match.value?.runtime.waitingHint || '对局已暂停，按 ESC 打开菜单继续。'
  if (isImmersiveLayout.value) {
    if (match.value?.runtime.waitingHint && match.value.runtime.stepAdvanceState === 'ready') {
      return match.value.runtime.waitingHint
    }
    return ''
  }
  if (advancing.value || match.value?.runtime.modelCallStatus === 'calling') {
    const name = participants.value.find((p) => p.characterId === match.value?.runtime.currentSpeakerId)?.characterName
    return name ? `正在等待 ${name} 的模型响应…` : '裁判正在调用模型，请稍候…'
  }
  if (match.value?.runtime.waitingHint && match.value.runtime.stepAdvanceState === 'ready') return match.value.runtime.waitingHint
  return ''
})
const statusBarHintShort = computed(() => {
  if (error.value) return '异常'
  if (isPaused.value) return '已暂停'
  if (isImmersiveLayout.value) return immersivePhaseLabel.value
  if (advancing.value || match.value?.runtime.modelCallStatus === 'calling') {
    const name = participants.value.find((p) => p.characterId === match.value?.runtime.currentSpeakerId)?.characterName
    return name ? `等待 ${name}` : '调用中'
  }
  if (match.value?.runtime.waitingHint && match.value.runtime.stepAdvanceState === 'ready') return actionMeta.value.label
  return '提示'
})
const showTopStatusHint = computed(() => {
  if (!isImmersiveLayout.value) return Boolean(activityHint.value)
  return Boolean(error.value || isPaused.value)
})
const humanInputPending = computed(() => (match.value ? isHumanActionPending(match.value) : false))
const humanInputKind = computed(() => match.value?.runtime.humanInputKind ?? null)
const humanParticipant = computed(() => {
  const id = match.value?.runtime.humanControlledId
  return id ? participantById(id) : null
})
const humanCharacter = computed(() => {
  const id = match.value?.runtime.humanControlledId
  return id ? characterCache.value.get(id) ?? null : null
})
const humanIdentityLabel = computed(() => {
  const p = humanParticipant.value
  if (!p) return ''
  const role = p.roleName || '未知身份'
  const camp = p.roleCamp === 'wolf' ? '狼人阵营' : p.roleCamp === 'good' ? '好人阵营' : '未知阵营'
  return `${role} · ${camp}`
})
const humanRoleSkillText = computed(() => {
  const p = humanParticipant.value
  if (!p?.roleId) return ''
  const skill = roleSkill(p.roleId)
  return skill !== '无技能' ? skill : ''
})
const canTakeOver = computed(() => (match.value ? canTakeOverMatch(match.value, profileCharacterId.value) : false))
const isHumanControlling = computed(() => (match.value ? isHumanControlledMatch(match.value, profileCharacterId.value) : false))
const humanTakeoverLocked = computed(() => Boolean(match.value?.runtime.humanTakeoverLocked))
const showHumanTakeoverButton = computed(
  () =>
    Boolean(
      profileCharacterId.value &&
        match.value &&
        !isDiscussionGameModeId(match.value.gameModeId) &&
        (canTakeOver.value || isHumanControlling.value)
    )
)
const autoAdvanceActive = computed(() => Boolean(match.value?.status === 'active' && settings.value.matchDefaults.autoAdvance && canAdvance.value && !advancing.value && !error.value && !humanInputPending.value && !immersivePresentationHold.value && !(actionKind.value === 'judge' && !settings.value.matchDefaults.autoNextRound)))
const displayMode = computed(() => settings.value.compactLayout ? '高玩视图' : settings.value.modelCallHints ? '新手提示' : '标准视图')
const phaseHint = computed(() => match.value?.runtime.waitingHint || actionMeta.value.hint)
const upcomingPhase = computed(() => {
  if (!match.value || !mode.value) return '等待裁判安排'
  const sorted = [...mode.value.phases].sort((a, b) => a.order - b.order)
  const next = sorted[match.value.runtime.phaseIndex + 1] || sorted.find((phase) => phase.id === 'night') || sorted[0]
  return next ? next.name : '等待裁判安排'
})
const showEmotionTags = computed(() => settings.value.matchDefaults.showEmotionTags !== false)

function participantById(id: string | null | undefined): MatchParticipant | null { return id ? participants.value.find((p) => p.characterId === id) || null : null }
function avatarStyle(p: MatchParticipant | null | undefined) {
  if (!p) return { backgroundImage: 'url(' + arenaHomeAssets.judgeAvatar + ')', backgroundColor: '#7c5cff' }
  return { backgroundImage: 'url(' + characterAvatarByName(p.characterName, p.seatOrder, p.modelId, p.avatarUrl) + ')', backgroundColor: p.accentColor }
}
function messageAvatarStyle(msg: MatchMessage) {
  const participant = participantById(msg.participantId)
  if (participant) return avatarStyle(participant)
  return { backgroundImage: 'url(' + arenaHomeAssets.judgeAvatar + ')', backgroundColor: '#7c5cff' }
}
function aliveLabel(p: MatchParticipant): string { return p.alive === 'alive' ? '在场' : p.alive === 'spectating' ? '旁观' : '出局' }
function realCampLabel(p: MatchParticipant): string { if (p.roleId === 'villager') return '平民'; return p.roleCamp === 'wolf' ? '狼人' : p.roleCamp === 'good' ? '好人' : '未知' }
function campLabel(p: MatchParticipant): string { return viewMode.value === 'god' || p.revealed || p.alive === 'eliminated' || isPlayerSelfSeat(p, selfPlayerId.value, viewMode.value) ? realCampLabel(p) : guessedRoles.value[p.characterId] ? '猜测：' + guessedRoles.value[p.characterId] : '身份未知' }
function campClass(p: MatchParticipant): string { return participantCampClass(p, viewMode.value, guessedRoles.value, selfPlayerId.value) }
function visibleRoleName(p: MatchParticipant): string { return visibleRoleNameForParticipant(p, viewMode.value, guessedRoles.value, selfPlayerId.value) }
function isSelfSeat(p: MatchParticipant): boolean { return isPlayerSelfSeat(p, selfPlayerId.value, viewMode.value) }
function roleSkill(roleId: string | null | undefined): string { return mode.value?.roles.find((role) => role.id === roleId)?.skillName || '无技能' }
function cycleGuess(p: MatchParticipant) { if (viewMode.value !== 'player') return; const options = guessOptions.value; if (!options.length) return; const current = guessedRoles.value[p.characterId]; const index = current ? options.indexOf(current) : -1; guessedRoles.value = { ...guessedRoles.value, [p.characterId]: options[(index + 1) % options.length] } }
function playerGuessLabel(p: MatchParticipant): string | null {
  if (viewMode.value !== 'player') return null
  return guessedRoles.value[p.characterId] || null
}
function onSeatContextMenu(event: MouseEvent, p: MatchParticipant) {
  if (viewMode.value !== 'player') return
  event.preventDefault()
  cycleGuess(p)
}
function toggleViewMode() {
  setViewMode(viewMode.value === 'god' ? 'player' : 'god')
}

async function setViewMode(mode: 'god' | 'player') {
  viewMode.value = mode
  if (mode === 'player') {
    ttsService.interrupt()
    return
  }
  if (!match.value) return
  // 就地更新并后台持久化，避免 save 返回的克隆对象替换掉进行中的流式发言/思考。
  lockTakeoverOnGodView(match.value)
  void matchService.save(match.value).catch(() => undefined)
}
function hasActed(p: MatchParticipant): boolean { return Boolean(match.value?.runtime.actedCharacterIds.includes(p.characterId)) }
function messageTone(msg: MatchMessage): string {
  const human = msg.isHumanPlayer ? ' is-human-player' : ''
  return 'is-' + msg.kind + human + (msg.participantId === 'judge' || msg.kind !== 'speech' ? ' is-referee' : '')
}
function speechMetaLabel(msg: MatchMessage): string | null {
  if (msg.isHumanPlayer) return '真人发言'
  if (msg.kind === 'speech' && msg.phaseId === 'last-words') return '遗言'
  return msg.roleLabel
}
function messageOrder(msg: MatchMessage): string {
  const sameRound = (match.value?.messages || []).filter((item) => item.round === msg.round && item.phaseId === msg.phaseId)
  const index = Math.max(0, sameRound.findIndex((item) => item.id === msg.id)) + 1
  return 'R' + msg.round + ' · #' + index
}
function liveSpeechText(msg: MatchMessage): string {
  void streamTick.value
  return speechDisplayText(msg)
}
function liveThoughtText(msg: MatchMessage): string {
  void streamTick.value
  return thoughtText(msg)
}
function formatClock(value: string | null | undefined): string { return value ? value.slice(11, 16) : '--:--' }
function messageIcon(msg: MatchMessage) { if (msg.kind === 'warning') return AlertTriangle; if (msg.kind === 'vote') return Vote; if (msg.kind === 'resource') return MoonStar; if (msg.kind === 'judge' || msg.kind === 'event' || msg.kind === 'system') return ShieldCheck; return MessageCircle }
function thoughtKey(msg: MatchMessage): string { return msg.id }
function isThoughtOpen(msg: MatchMessage): boolean { return expandedThoughtIds.value.has(thoughtKey(msg)) }
function toggleThought(msg: MatchMessage) {
  if (viewMode.value !== 'god' || !hasThought(msg)) return
  const key = thoughtKey(msg)
  const expanded = new Set(expandedThoughtIds.value)
  const collapsed = new Set(collapsedThoughtIds.value)
  if (showThoughtPanel(msg)) {
    collapsed.add(key)
    expanded.delete(key)
  } else {
    collapsed.delete(key)
    expanded.add(key)
  }
  expandedThoughtIds.value = expanded
  collapsedThoughtIds.value = collapsed
}
function isSpeechStreaming(msg: MatchMessage): boolean {
  return msg.kind === 'speech' && (msg.streamStatus === 'pending' || msg.streamStatus === 'streaming')
}
function isSpeechThinking(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && !liveSpeechText(msg).trim() && !msg.isHumanPlayer
}
function speechBubbleLoadingText(msg: MatchMessage): string {
  if (msg.isHumanPlayer) return '等待真人输入…'
  return liveThoughtText(msg) ? '思考中…' : '正在整理发言…'
}
function showThoughtPanel(msg: MatchMessage): boolean {
  const key = thoughtKey(msg)
  if (collapsedThoughtIds.value.has(key)) return false
  if (isThoughtOpen(msg)) return true
  return isSpeechStreaming(msg) && Boolean(liveThoughtText(msg))
}
function isSpeechLive(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && Boolean(liveSpeechText(msg).trim())
}
function hasThought(msg: MatchMessage): boolean { return Boolean((msg as MatchMessage & { thought?: string }).thought) }
function thoughtText(msg: MatchMessage | null): string { return ((msg as MatchMessage & { thought?: string } | null)?.thought || '').trim() }
function isVoteLive(msg: MatchMessage): boolean {
  return isVoteTallyMessage(msg) && msg.streamStatus === 'streaming'
}
function isVoteDone(msg: MatchMessage): boolean {
  return isVoteTallyMessage(msg) && msg.streamStatus === 'done'
}
function isVoteTallyMessage(msg: MatchMessage): boolean {
  return msg.kind === 'vote' && msg.participantId === 'judge'
}
function onHumanPanelUpdated(next: Match) {
  match.value = next
  error.value = ''
  void nextTick(() => {
    scheduleAutoAdvance()
  })
}
function onHumanPanelError(message: string) {
  error.value = message
}
async function takeOverHuman() {
  if (!match.value || isPaused.value || isCompleted.value) return
  try {
    if (
      profileCharacterId.value &&
      match.value.runtime.currentSpeakerId === profileCharacterId.value &&
      (match.value.runtime.modelCallStatus === 'calling' || match.value.runtime.stepAdvanceState === 'waiting')
    ) {
      await matchEngine.abortAndRollback(match.value.id)
    }
    match.value = await humanPlayerService.takeOver(match.value.id)
    playArenaTone('click')
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}
async function releaseHuman() {
  if (!match.value) return
  try {
    match.value = await humanPlayerService.release(match.value.id)
    playArenaTone('click')
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}
function onHumanActionSubmitted() {
  void nextTick(() => {
    if (match.value?.runtime.humanInputKind) return
    if (settings.value.matchDefaults.autoAdvance && canAdvance.value) {
      void advance('auto')
    }
  })
}
function isNearStreamBottom(): boolean {
  const el = messageStreamRef.value
  if (!el) return true
  return el.scrollHeight - el.scrollTop - el.clientHeight < 84
}
function scrollToLatest(smooth = true) {
  const el = messageStreamRef.value
  if (!el) return
  el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  showNewMessageHint.value = false
}
function onMessageScroll() {
  if (isNearStreamBottom()) showNewMessageHint.value = false
}
function speechDisplayText(msg: MatchMessage): string {
  return msg.kind === 'speech' ? ttsService.stripDisplayText(msg.content) : msg.content
}
function godViewText(msg: MatchMessage): string {
  return msg.godViewContent?.trim() || ''
}

function emotionForMessage(msg: MatchMessage): { icon: string; label: string; energy: string; certainty: string; tags: string[]; className: string } | null {
  if (msg.kind !== 'speech') return null
  const text = speechDisplayText(msg) + ' ' + thoughtText(msg)
  const suspicion = (text.match(/怀疑|可疑|不对|狼人|狼坑|冲票|倒钩|划水|问题/g) || []).length
  const support = (text.match(/同意|相信|好人|支持|认可|站边|保下/g) || []).length
  const push = (text.match(/归票|必须|建议|投|推进|听发言|集中/g) || []).length
  const hedge = (text.match(/可能|也许|暂时|倾向|观察|不确定|先听/g) || []).length
  const info = (text.match(/查验|守护|解药|毒药|昨夜|票型|警徽流|身份/g) || []).length
  const intensity = suspicion + support + push + info
  const label = suspicion >= Math.max(support, push, info) && suspicion > 0 ? '风险追踪' : push >= Math.max(support, info) && push > 0 ? '节奏推进' : support >= Math.max(info, 1) ? '阵营站边' : info > 0 ? '信息整理' : hedge > 0 ? '谨慎试探' : '冷静推理'
  const icon = label === '风险追踪' ? '!' : label === '节奏推进' ? '◆' : label === '阵营站边' ? '✓' : label === '信息整理' ? '◇' : label === '谨慎试探' ? '?' : '·'
  const energy = intensity >= 4 ? '强表达' : intensity >= 2 ? '中表达' : '轻表达'
  const certainty = hedge >= 2 ? '低确定' : /一定|明确|必须|就是|确认/.test(text) ? '高确定' : '中确定'
  const tags = [energy, certainty, suspicion > 0 ? '疑点+' + suspicion : '', support > 0 ? '信任+' + support : '', push > 0 ? '推进+' + push : '', info > 0 ? '信息+' + info : ''].filter(Boolean).slice(0, 4)
  return { icon, label, energy, certainty, tags, className: 'emotion-' + label }
}
function cachedEmotion(msg: MatchMessage) {
  return messageEmotions.value.get(msg.id) ?? null
}
function votesForMessage(msg: MatchMessage): MatchVoteRecord[] {
  return (match.value?.votes || []).filter((vote) => vote.round === msg.round && vote.phaseId === msg.phaseId)
}
function voteAbstainLabel(vote: MatchVoteRecord): string {
  if (!vote.abstain) return vote.targetName || '未知'
  if (vote.abstainReason === 'explicit') return '主动弃权'
  if (vote.abstainReason === 'parse_failed') return '未识别票(计弃权)'
  return '弃权'
}
function voteSummary(msg: MatchMessage) {
  const votes = votesForMessage(msg)
  const sheriffId = match.value?.runtime.werewolfState?.sheriffId || match.value?.runtime.sheriffId || null
  const map = new Map<string, { name: string; count: number; voters: string[] }>()
  for (const vote of votes) {
    const key = vote.abstain || !vote.targetId ? `abstain:${vote.abstainReason || 'unknown'}` : vote.targetId
    const item = map.get(key) || { name: voteAbstainLabel(vote), count: 0, voters: [] }
    const weight = vote.voterId === sheriffId ? 1.5 : 1
    item.count += weight
    item.voters.push(vote.voterName + (weight > 1 ? '×1.5' : ''))
    map.set(key, item)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}
function voteTallyComplete(msg: MatchMessage): boolean {
  if (msg.kind !== 'vote') return false
  const votes = votesForMessage(msg)
  const eligible = voteEligibleCount.value
  return eligible > 0 && votes.length >= eligible
}
function formatVoteCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1)
}
const VOTE_PIE_COLORS = ['#7d62ff', '#d178ff', '#62b8ff', '#ffb362', '#ff7896', '#6dd4a0', '#c4a8ff', '#8a9bb8']
function voteTotalCount(msg: MatchMessage): number {
  return voteSummary(msg).reduce((sum, item) => sum + item.count, 0)
}
function votePieGradient(msg: MatchMessage): string {
  const items = voteSummary(msg)
  const total = voteTotalCount(msg)
  if (!total) return 'conic-gradient(#e8e2ff 0deg 360deg)'
  let acc = 0
  const stops = items.map((item, index) => {
    const start = acc
    acc += (item.count / total) * 100
    return `${VOTE_PIE_COLORS[index % VOTE_PIE_COLORS.length]} ${start}% ${acc}%`
  })
  return `conic-gradient(${stops.join(', ')})`
}
function clearAutoTimer() { if (autoTimer.value) window.clearTimeout(autoTimer.value); autoTimer.value = null }
function clearKickoffTimer() { if (kickoffTimer.value) window.clearTimeout(kickoffTimer.value); kickoffTimer.value = null }

async function resolveCharacter(participantId: string): Promise<Character | null> {
  if (characterCache.value.has(participantId)) return characterCache.value.get(participantId) || null
  try {
    const character = await characterService.get(participantId)
    characterCache.value.set(participantId, character)
    return character
  } catch {
    return null
  }
}

async function preloadCharacters() {
  if (!match.value) return
  const ids = [...new Set(match.value.participants.map((p) => p.characterId))]
  await Promise.all(ids.map((id) => resolveCharacter(id)))
}

function syncMessagesInPlace(target: MatchMessage[], source: MatchMessage[]) {
  for (let i = 0; i < source.length; i++) {
    const sm = source[i]
    const tm = target[i]
    if (!tm || tm.id !== sm.id) {
      target.splice(0, target.length, ...source)
      return
    }
    const targetStreaming = tm.streamStatus === 'pending' || tm.streamStatus === 'streaming'
    const sourceFinalized = sm.streamStatus === 'done' || sm.streamStatus === 'failed'
    const preferTargetContent =
      targetStreaming && !sourceFinalized && sm.content.length < tm.content.length
    const preferTargetThought =
      targetStreaming &&
      !sourceFinalized &&
      (sm.thought || '').length < (tm.thought || '').length
    if (!preferTargetContent && tm.content !== sm.content) tm.content = sm.content
    if (!preferTargetThought && tm.thought !== sm.thought) tm.thought = sm.thought
    if (tm.streamStatus !== sm.streamStatus) tm.streamStatus = sm.streamStatus
    if (tm.confirmed !== sm.confirmed) tm.confirmed = sm.confirmed
    if (tm.roleLabel !== sm.roleLabel) tm.roleLabel = sm.roleLabel
    if (tm.isHumanPlayer !== sm.isHumanPlayer) tm.isHumanPlayer = sm.isHumanPlayer
  }
}

function applyLiveMatch(source: Match) {
  const current = match.value
  if (!current) {
    match.value = source
    return
  }
  if (current === source) return
  current.status = source.status
  current.updatedAt = source.updatedAt
  current.totalCostCents = source.totalCostCents
  current.resultSummary = source.resultSummary
  current.winnerCamp = source.winnerCamp
  if (current.runtime !== source.runtime) current.runtime = source.runtime
  if (current.participants !== source.participants) current.participants = source.participants
  if (current.votes !== source.votes) current.votes = source.votes
  if (current.events !== source.events) current.events = source.events
  if (current.messages !== source.messages) {
    if (source.messages.length !== current.messages.length) {
      current.messages = source.messages
    } else {
      syncMessagesInPlace(current.messages, source.messages)
    }
  }
}

function applyStreamPatch(patch: MatchStreamPatch) {
  if (!match.value) return
  const msg = match.value.messages.find((item) => item.id === patch.messageId)
  if (!msg) return
  msg.content = patch.content
  if (patch.thought !== undefined) msg.thought = patch.thought
  if (patch.streamStatus) msg.streamStatus = patch.streamStatus
  streamTick.value++

  if (streamUiRaf) cancelAnimationFrame(streamUiRaf)
  streamUiRaf = requestAnimationFrame(() => {
    streamUiRaf = 0
    if (isNearStreamBottom()) scrollToLatest(false)
  })

  if (patch.streamStatus === 'done' || patch.streamStatus === 'failed' || patch.streamStatus === 'streaming') {
    void syncMessageTts([msg])
  }
}

function shouldPlayNarrationTts(): boolean {
  return viewMode.value === 'god'
}

async function syncMessageTts(messages: MatchMessage[]) {
  if (!liveRoomTtsEnabled.value || !settings.value.ttsEnabled || settings.value.ttsVolume <= 0) return
  const ordered = [...messages].sort((a, b) => {
    const rank = (msg: MatchMessage) => {
      if (msg.kind === 'judge' && msg.phaseId === 'setup') return 0
      if (msg.kind === 'judge' || msg.kind === 'system' || msg.kind === 'warning') return 1
      return 2
    }
    return rank(a) - rank(b)
  })
  for (const msg of ordered) {
    if (msg.kind === 'speech' && msg.content.trim()) {
      const status = msg.streamStatus || 'done'
      const len = msg.content.length
      const prev = ttsSyncedState.get(msg.id)
      if (prev && prev.len === len && prev.status === status) continue
      ttsSyncedState.set(msg.id, { len, status })
      const character = await resolveCharacter(msg.participantId)
      if (!character) continue
      const isFinal = status === 'done' || status === 'failed'
      ttsService.onSpeechDelta(msg.id, msg.content, character, isFinal)
    }
    if (
      shouldPlayNarrationTts() &&
      settings.value.matchDefaults.judgeTtsEnabled &&
      (msg.kind === 'judge' || msg.kind === 'warning' || msg.kind === 'system')
    ) {
      if (judgeTtsSeen.value.has(msg.id)) continue
      if (!msg.content.trim() || msg.streamStatus === 'streaming' || msg.streamStatus === 'pending') continue
      judgeTtsSeen.value = new Set(judgeTtsSeen.value).add(msg.id)
      const priority = msg.kind === 'judge' && msg.phaseId === 'setup'
      ttsService.speakJudge(msg.content, settings.value.judgeVoiceId, priority)
    }
  }
}

function seedTtsStateFromMatch(source: Match) {
  ttsSyncedState.clear()
  const judgeSeen = new Set<string>()
  const speechSeed: Array<{ id: string; content: string }> = []

  for (const msg of source.messages) {
    if (msg.kind === 'speech' && msg.content.trim()) {
      const status = msg.streamStatus || 'done'
      if (status === 'pending' || status === 'streaming') continue
      ttsSyncedState.set(msg.id, { len: msg.content.length, status })
      speechSeed.push({ id: msg.id, content: msg.content })
    }
    if (
      (msg.kind === 'judge' || msg.kind === 'warning' || msg.kind === 'system') &&
      msg.content.trim() &&
      msg.streamStatus !== 'pending' &&
      msg.streamStatus !== 'streaming'
    ) {
      judgeSeen.add(msg.id)
    }
  }

  judgeTtsSeen.value = judgeSeen
  ttsService.seedSpeechMessages(speechSeed)
}
function shouldKickoffMatch(): boolean {
  return Boolean(match.value && match.value.status === 'active' && !isPaused.value && match.value.messages.length === 0 && match.value.runtime.stepAdvanceState === 'ready')
}
function ensureRoomFlowReady() {
  if (settings.value.matchDefaults.autoAdvance) {
    roomInteractive.value = true
  }
}
function triggerInitialKickoff() {
  if (!roomInteractive.value) return
  if (shouldKickoffMatch()) {
    if (settings.value.matchDefaults.autoAdvance) {
      void advance('auto')
    } else {
      scheduleKickoff()
    }
    return
  }
  scheduleAutoAdvance()
}
function scheduleKickoff() {
  clearKickoffTimer()
  if (!shouldKickoffMatch()) return
  if (settings.value.matchDefaults.autoAdvance) {
    void advance('auto')
    return
  }
  kickoffTimer.value = window.setTimeout(() => { if (shouldKickoffMatch()) void advance('auto') }, 520)
}
function scheduleAutoAdvance() {
  clearAutoTimer()
  if (!autoAdvanceActive.value || isPaused.value) return
  void (async () => {
    await ttsService.waitUntilIdle()
    if (!autoAdvanceActive.value || isPaused.value) return
    const delay = settings.value.matchDefaults.fastMode ? 400 : actionKind.value === 'speech' ? 600 : 400
    autoTimer.value = window.setTimeout(() => {
      if (autoAdvanceActive.value && !isPaused.value) void advance('auto')
    }, delay)
  })()
}
async function copyRoomCode() { if (!match.value?.roomCode) return; await navigator.clipboard?.writeText(match.value.roomCode).catch(() => undefined); copied.value = true; window.setTimeout(() => (copied.value = false), 1200) }
function openEscMenu() { escMenuRef.value?.openMenu() }
async function load() {
  if (!matchId.value) {
    loading.value = false
    error.value = '未找到对局 ID'
    return
  }
  loading.value = true
  error.value = ''
  liveRoomTtsEnabled.value = false
  ttsService.interrupt()
  try {
    const loaded = await matchEngine.load(matchId.value)
    seedTtsStateFromMatch(loaded)
    match.value = loaded
    liveRoomTtsEnabled.value = true
    void preloadCharacters()
    ensureRoomFlowReady()
    triggerInitialKickoff()
  } catch (err) {
    error.value = formatUserMessage(err) || '房间暂时没有准备好'
  } finally {
    loading.value = false
  }
}
async function advance(source: 'manual' | 'auto' = 'manual') {
  if (!match.value || advancing.value || !canAdvance.value || isPaused.value) return
  clearAutoTimer()
  advancing.value = true; error.value = ''
  const knownMessageIds = new Set(match.value.messages.map((msg) => msg.id))
  try {
    if (settings.value.matchDefaults.pauseOnLowBalance || settings.value.balanceReminder) {
      const balance = await billingService.getBalanceCents(true)
      if (balance !== null && balance < settings.value.balanceReminderThresholdCents && settings.value.matchDefaults.pauseOnLowBalance) { error.value = '余额低于阈值，已暂停推进。'; playArenaTone('warn'); return }
    }
    match.value = await matchEngine.advanceStep(match.value.id, {
      onDelta: (next) => {
        applyLiveMatch(next)
      },
      onStream: (patch) => {
        applyStreamPatch(patch)
      },
    })
    const freshMessages = match.value.messages.filter((msg) => !knownMessageIds.has(msg.id))
    if (freshMessages.length) void syncMessageTts(freshMessages)
    playArenaTone(source === 'auto' ? 'click' : 'step')
  } catch (err) {
    const message = formatUserMessage(err)
    if (!/步骤已取消|模型调用已取消/.test(message)) error.value = message
    match.value = await matchService.get(matchId.value)
  } finally {
    advancing.value = false
    void nextTick(() => {
      scheduleKickoff()
      scheduleAutoAdvance()
    })
  }
}
async function reloadSettings() {
  settings.value = await settingsService.get().catch(() => settingsService.defaults())
  if (!settings.value.ttsEnabled) ttsService.interrupt()
}
function onSettingsChange(event: Event) {
  const detail = (event as CustomEvent<ArenaSettings>).detail
  if (detail) {
    settings.value = detail
    if (!detail.ttsEnabled) ttsService.interrupt()
    ensureRoomFlowReady()
    if (roomInteractive.value) triggerInitialKickoff()
    return
  }
  void reloadSettings()
}
function onTtsSpeaking(event: Event) {
  const detail = (event as CustomEvent<{ participantId: string | null }>).detail
  ttsSpeakingId.value = detail?.participantId ?? null
}
watch(isPaused, (paused) => {
  if (paused) {
    clearAutoTimer()
    clearKickoffTimer()
    ttsService.interrupt()
  }
})
watch(() => visibleMessages.value.length, async (count, previous) => {
  await nextTick()
  if (!previous || count <= previous) { lastMessageCount.value = count; scrollToLatest(false); return }
  if (isNearStreamBottom()) scrollToLatest(false)
  else showNewMessageHint.value = true
  lastMessageCount.value = count
})
watch([canAdvance, autoAdvanceActive, isPaused, roomInteractive], () => {
  if (!roomInteractive.value) return
  if (isPaused.value) {
    clearAutoTimer()
    clearKickoffTimer()
    return
  }
  scheduleKickoff()
  scheduleAutoAdvance()
})
function unlockRoomInteraction() {
  if (roomInteractive.value) return
  roomInteractive.value = true
  scheduleKickoff()
  scheduleAutoAdvance()
}

onMounted(async () => {
  unlockArenaAudio()
  profileCharacterId.value = await getUserProfileCharacterId().catch(() => null)
  void matchWindowService.getKind().catch(() => 'main')
  window.addEventListener('arena:settings-change', onSettingsChange)
  window.addEventListener('arena:tts-speaking', onTtsSpeaking)
  window.addEventListener('pointerdown', unlockRoomInteraction, { once: true })
  window.addEventListener('keydown', unlockRoomInteraction, { once: true })
  await reloadSettings()
  ensureRoomFlowReady()
  await load()
})
onUnmounted(() => {
  clearAutoTimer()
  clearKickoffTimer()
  if (streamUiRaf) cancelAnimationFrame(streamUiRaf)
  liveRoomTtsEnabled.value = false
  if (match.value?.id) {
    void matchEngine.abortAndRollback(match.value.id).catch(() => undefined)
  }
  ttsSyncedState.clear()
  ttsService.interrupt()
  window.removeEventListener('arena:settings-change', onSettingsChange)
  window.removeEventListener('arena:tts-speaking', onTtsSpeaking)
  window.removeEventListener('pointerdown', unlockRoomInteraction)
  window.removeEventListener('keydown', unlockRoomInteraction)
})
</script>

<template>
  <div class="aa-game-room" :class="[phaseClass, { 'aa-game-room--immersive': isImmersiveLayout }]">
    <div class="aa-game-backdrop" :style="roomBackdropStyle" />
    <header class="aa-game-topbar aa-room-drag">
      <div class="aa-game-brand">
        <div class="aa-game-brand__mark"><Sparkles :size="18" /></div>
        <div class="aa-game-title-wrap">
          <strong>{{ match?.title || '对局房间' }}</strong>
          <div class="aa-title-actions"><button type="button" class="aa-game-room-code aa-room-no-drag" @click="copyRoomCode">{{ match?.roomCode || '---' }}<Copy :size="12" /><em>{{ copied ? '已复制' : '复制' }}</em></button><button v-if="match" type="button" class="aa-event-open aa-room-no-drag" @click="showEvents = true"><ListChecks :size="12" />事件</button></div>
        </div>
      </div>
      <div class="aa-game-top-pills aa-room-no-drag">
        <div
          v-if="match && showTopStatusHint"
          class="aa-top-status"
          :class="{ 'is-error': Boolean(error), 'is-paused': isPaused, 'is-calling': isModelCalling && !error && !isImmersiveLayout, 'is-immersive': isImmersiveLayout }"
        >
          <Loader2 v-if="isModelCalling && !error && !isImmersiveLayout" :size="14" class="spin" />
          <AlertTriangle v-else-if="error || isPaused" :size="14" />
          <component v-else :is="PhaseIcon" :size="14" />
          <span class="aa-top-status__label">{{ statusBarHintShort }}</span>
          <div v-if="activityHint" class="aa-top-status__tip">
            <p>{{ activityHint }}</p>
            <button v-if="error || isPaused" type="button" @click="openEscMenu">打开菜单</button>
          </div>
        </div>
        <span v-else-if="match && isImmersiveLayout" class="aa-immersive-phase-pill"><component :is="PhaseIcon" :size="13" />{{ immersivePhaseLabel }}</span>
        <span><Users :size="14" />{{ aliveParticipants.length }}/{{ participants.length }}</span>
        <span><Crown :size="14" />{{ sheriff?.characterName || '无警长' }}</span>
        <button type="button" class="aa-view-toggle" @click="toggleViewMode"><Eye :size="14" />{{ viewMode === 'god' ? '上帝视角' : '玩家视角' }}</button>
        <button
          v-if="showHumanTakeoverButton"
          type="button"
          class="aa-human-toggle"
          :class="{ 'is-active': isHumanControlling, 'is-locked': humanTakeoverLocked && !isHumanControlling }"
          :disabled="humanTakeoverLocked && !isHumanControlling"
          :title="humanTakeoverLocked && !isHumanControlling ? '本局已开启上帝视角，无法再次接管' : undefined"
          @click="isHumanControlling ? releaseHuman() : takeOverHuman()"
        >
          <Gamepad2 :size="14" />{{ isHumanControlling ? '交还 AI' : '替代分身' }}
        </button>
        <span v-if="isHumanControlling && humanParticipant" class="aa-human-identity-pill">
          <ShieldCheck :size="13" />你的身份：{{ humanIdentityLabel }}
        </span>
        <button type="button" @click="openEscMenu"><component :is="PhaseIcon" :size="14" />ESC</button>
      </div>
    </header>

    <ArenaPageState
      :loading="loading"
      :error="error && !match ? error : undefined"
      skeleton="match-room"
      loading-label="裁判正在布置房间..."
      :min-reveal-ms="0"
      :stagger="false"
      @retry="load"
    >
      <main v-if="match" class="aa-game-layout" :class="{ 'aa-game-layout--immersive': isImmersiveLayout, 'has-floating-action': humanInputKind }">
      <MatchRoomImmersiveStage
        v-if="isImmersiveLayout"
        :match="match"
        :participants="participants"
        :visible-messages="visibleMessages"
        :votes="match.votes"
        :active-speaker-id="activeSpeakerId"
        :tts-speaking-id="ttsSpeakingId"
        :sheriff-id="sheriffId"
        :view-mode="viewMode"
        :show-emotion-tags="showEmotionTags"
        :speech-display-config="speechDisplayConfig"
        :character-cache="characterCache"
        :guessed-roles="guessedRoles"
        :self-player-id="selfPlayerId"
        :vote-eligible-count="voteEligibleCount"
        :vote-progress="voteProgress"
        :stream-tick="streamTick"
        :speech-phase="immersiveSpeechPhase"
        :speech-progress="immersiveSpeechProgress"
        @cycle-guess="cycleGuess"
      />
      <template v-else>
      <aside class="aa-seat-board">
        <div class="aa-phase-token">
          <component :is="PhaseIcon" :size="18" />
          <div><strong>{{ match.runtime.currentPhaseName }}</strong><span>第 {{ match.runtime.currentRound }} 轮 · {{ displayMode }}</span><small>即将进行：{{ upcomingPhase }}</small></div>
        </div>
        <div class="aa-player-orbit">
          <button v-for="p in participants" :key="p.characterId" type="button" class="aa-seat-card" :class="[{ 'is-speaking': activeSpeakerId === p.characterId, 'is-tts-speaking': ttsSpeakingId === p.characterId, 'is-self': isSelfSeat(p), 'is-out': p.alive !== 'alive', 'is-sheriff': sheriffId === p.characterId, 'has-acted': hasActed(p), 'has-guess': Boolean(playerGuessLabel(p)) }, campClass(p)]" :title="viewMode === 'player' ? '右键循环标记身份' : undefined" @contextmenu="onSeatContextMenu($event, p)">
            <span class="aa-player-avatar" :class="{ 'is-tts-speaking': ttsSpeakingId === p.characterId }" :style="avatarStyle(p)">
              <i v-if="ttsSpeakingId === p.characterId" class="aa-tts-waves" aria-hidden="true"><i></i><i></i><i></i></i>
            </span>
            <span class="aa-seat-copy"><strong>{{ p.seatOrder }} · {{ p.characterName }}</strong><small>{{ visibleRoleName(p) }} / {{ campLabel(p) }}</small></span>
            <span v-if="playerGuessLabel(p)" class="aa-guess-badge">标记 · {{ playerGuessLabel(p) }}</span>
            <span v-if="isSelfSeat(p)" class="aa-self-badge">我</span>
            <span v-if="hasActed(p)" class="aa-spoken-mark">已发言</span><i v-if="sheriffId === p.characterId">警</i>
            <span class="aa-player-peek"><b>{{ viewMode === 'god' ? (p.roleName || '未知身份') : visibleRoleName(p) }}</b><p>{{ viewMode === 'god' ? roleSkill(p.roleId) : '玩家视角下右键席位可循环标记身份猜测。' }}</p><em>{{ aliveLabel(p) }}</em></span>
          </button>
        </div>
      </aside>

      <section class="aa-story-stage">
        <div class="aa-stage-glow" />
        <div ref="messageStreamRef" class="aa-message-stream" @scroll="onMessageScroll">
          <div v-if="!visibleMessages.length" class="aa-empty-talk"><Bot :size="24" />公开频道还很安静，裁判会把发言、投票和结算依次写入这里。</div>
          <article v-for="msg in visibleMessages" :key="msg.id" class="aa-talk-row" :class="messageTone(msg)">
            <div class="aa-talk-avatar" :style="messageAvatarStyle(msg)"></div>
            <div class="aa-talk-shell">
                  <div class="aa-talk-meta"><component :is="messageIcon(msg)" :size="13" /><strong>{{ msg.participantName }}</strong><span>{{ messageOrder(msg) }}</span><em v-if="speechMetaLabel(msg)">{{ speechMetaLabel(msg) }}</em></div>

              <template v-if="msg.kind === 'speech'">
                <div
                  v-if="viewMode === 'god' && liveThoughtText(msg)"
                  class="aa-thought-block"
                  :class="{
                    open: showThoughtPanel(msg),
                    'is-streaming': isSpeechStreaming(msg),
                    'has-emotion': showEmotionTags && !isSpeechStreaming(msg) && msg.streamStatus === 'done' && !!cachedEmotion(msg),
                  }"
                >
                  <div class="aa-thought-toolbar">
                    <button type="button" class="aa-thought-toggle" @click="toggleThought(msg)"><Brain :size="12" />{{ showThoughtPanel(msg) ? '收起思考' : '展开思考' }}</button>
                    <span v-if="showEmotionTags && !isSpeechStreaming(msg) && cachedEmotion(msg)" class="aa-emotion" :class="cachedEmotion(msg)?.className">
                      <b>{{ cachedEmotion(msg)?.icon }}</b><span>{{ cachedEmotion(msg)?.label }}</span>
                      <span class="aa-emotion-pop"><strong>{{ cachedEmotion(msg)?.label }}</strong><em v-for="tag in cachedEmotion(msg)?.tags" :key="tag">{{ tag }}</em></span>
                    </span>
                  </div>
                  <div v-if="showThoughtPanel(msg)" class="aa-thought-panel">
                    <strong>思考过程</strong>
                    <p>{{ liveThoughtText(msg) }}<i v-if="isSpeechStreaming(msg) && liveThoughtText(msg)" class="aa-live-caret"></i></p>
                  </div>
                </div>
                <div class="aa-speech-wrap">
                  <div class="aa-speech-bubble" :class="{ 'has-thought': viewMode === 'god' && hasThought(msg) && !isSpeechThinking(msg), 'is-thinking': isSpeechThinking(msg), 'is-live': isSpeechLive(msg), 'is-tts-speaking': ttsSpeakingId === msg.participantId, 'is-human-player': msg.isHumanPlayer }">
                    <div v-if="msg.isHumanPlayer" class="aa-human-speech-tag">真人发言</div>
                    <div v-if="isSpeechThinking(msg)" class="aa-thinking-inline">
                      <Loader2 :size="14" class="spin" /><i></i><i></i><i></i><span>{{ showThoughtPanel(msg) && liveThoughtText(msg) ? '整理公开发言中…' : speechBubbleLoadingText(msg) }}</span>
                    </div>
                    <template v-else>
                      <MatchSpeechContent
                        class="aa-stream-text"
                        :text="liveSpeechText(msg)"
                        :streaming="isSpeechLive(msg)"
                        :config="speechDisplayConfig"
                        :participants="participants"
                      /><i v-if="isSpeechLive(msg)" class="aa-live-caret"></i>
                    </template>
                  </div>
                </div>
              </template>

              <div v-else-if="isVoteTallyMessage(msg)" class="aa-event-card aa-vote-widget" :class="{ 'is-live': isVoteLive(msg), 'is-tally': isVoteDone(msg) && voteTallyComplete(msg) }">
                <div class="aa-widget-head"><Vote :size="16" /><strong>{{ isVoteLive(msg) ? '投票进行中' : '投票唱票' }}</strong><span>{{ messageOrder(msg) }}</span></div>
                <p>{{ msg.content }}</p>
                <div v-if="isVoteLive(msg)" class="aa-vote-progress"><i :style="{ width: voteProgress + '%' }"></i><span>{{ voteProgress }}%</span></div>
                <div v-if="isVoteDone(msg) && voteTallyComplete(msg)" class="aa-vote-tally">
                  <div class="aa-vote-pie-wrap">
                    <div class="aa-vote-pie" :style="{ background: votePieGradient(msg) }"></div>
                    <span class="aa-vote-pie-total">共 {{ formatVoteCount(voteTotalCount(msg)) }} 票</span>
                  </div>
                  <div class="aa-vote-detail">
                    <div v-for="(item, index) in voteSummary(msg)" :key="item.name + index" class="aa-vote-detail-line" :class="{ 'is-leader': index === 0 && item.name !== '弃权' && item.name !== '主动弃权' && !String(item.name).includes('未识别') }">
                      <i :style="{ background: VOTE_PIE_COLORS[index % VOTE_PIE_COLORS.length] }"></i>
                      <span class="aa-vote-detail-name">{{ item.name }}</span>
                      <b>{{ formatVoteCount(item.count) }}票</b>
                      <small>{{ item.voters.join('、') }}</small>
                    </div>
                  </div>
                </div>
                <div v-else class="aa-vote-bars">
                  <div v-for="(item, index) in voteSummary(msg)" :key="item.name + index" class="aa-vote-line" :class="{ 'is-leader': isVoteDone(msg) && voteTallyComplete(msg) && index === 0 && item.name !== '弃权' }">
                    <span>{{ item.name }}</span><i :style="{ width: Math.max(18, (item.count / Math.max(voteSummary(msg)[0]?.count || 1, 1)) * 100) + '%' }"></i><b>{{ formatVoteCount(item.count) }}票</b>
                    <small>{{ item.voters.join('、') }}</small>
                  </div>
                </div>
                <ul v-if="votesForMessage(msg).length" class="aa-vote-feed">
                  <li v-for="vote in votesForMessage(msg)" :key="vote.id">{{ vote.voterName }} → {{ vote.abstain ? '弃权' : vote.targetName || '无效' }}</li>
                </ul>
              </div>

              <div v-else-if="msg.kind === 'resource'" class="aa-event-card aa-skill-widget">
                <div class="aa-widget-head"><MoonStar :size="16" /><strong>技能结算</strong><span>{{ messageOrder(msg) }}</span></div>
                <p>{{ msg.content }}</p>
                <div v-if="viewMode === 'god' && godViewText(msg)" class="aa-god-view-note">
                  <ShieldCheck :size="14" />
                  <div>
                    <b>裁判说明（上帝视角）</b>
                    <p>{{ godViewText(msg) }}</p>
                  </div>
                </div>
              </div>

              <div v-else-if="msg.kind === 'warning'" class="aa-judge-note"><AlertTriangle :size="14" /><b>裁判提醒</b><p>{{ msg.content }}</p><span>{{ messageOrder(msg) }}</span></div>

              <div v-else class="aa-event-card" :class="'aa-event-' + msg.kind">
                <div class="aa-widget-head"><component :is="messageIcon(msg)" :size="16" /><strong>{{ msg.kind === 'judge' ? '裁判裁定' : '公开事件' }}</strong><span>{{ messageOrder(msg) }}</span></div>
                <p>{{ msg.content }}</p>
              </div>
            </div>
          </article>
        </div>
        <button v-if="showNewMessageHint" type="button" class="aa-new-message" @click="scrollToLatest()"><MessageCircle :size="14" />有新的发言</button>
        <MatchRoomFloatingAction
          v-if="humanInputKind"
          :match="match"
          :profile-character-id="profileCharacterId"
          :view-mode="viewMode"
          :input-kind="humanInputKind"
          :human-participant="humanParticipant"
          :character="humanCharacter"
          :speech-terms="speechDisplayConfig?.terms"
          :role-skill-text="humanRoleSkillText"
          :disabled="isPaused || isCompleted"
          @updated="onHumanPanelUpdated"
          @error="onHumanPanelError"
          @submitted="onHumanActionSubmitted"
        />
      </section>
      </template>
      <MatchRoomFloatingAction
        v-if="isImmersiveLayout && humanInputKind"
        :match="match"
        :profile-character-id="profileCharacterId"
        :view-mode="viewMode"
        :input-kind="humanInputKind"
        :human-participant="humanParticipant"
        :character="humanCharacter"
        :speech-terms="speechDisplayConfig?.terms"
        :role-skill-text="humanRoleSkillText"
        :disabled="isPaused || isCompleted"
        @updated="onHumanPanelUpdated"
        @error="onHumanPanelError"
        @submitted="onHumanActionSubmitted"
      />
    </main>
    </ArenaPageState>


    <div v-if="showEvents" class="aa-info-overlay aa-room-no-drag" @click.self="showEvents = false">
      <section class="aa-events-dialog">
        <button type="button" class="aa-info-close" @click="showEvents = false">×</button>
        <span class="aa-dialog-kicker"><ListChecks :size="14" />公开事件</span>
        <h2>事件记录</h2>
        <div class="aa-event-list">
          <article v-for="event in publicEvents" :key="event.id"><i>{{ event.icon || '✦' }}</i><div><time>{{ formatClock(event.createdAt) }} · 第 {{ event.round }} 轮</time><p>{{ event.text }}</p></div></article>
          <p v-if="!publicEvents.length" class="aa-event-empty">暂无公开事件</p>
        </div>
      </section>
    </div>

    <MatchRoomEscMenu
      ref="escMenuRef"
      :match="match"
      :view-mode="viewMode"
      @updated="load"
      @update:view-mode="setViewMode"
    />
  </div>
</template>

<style scoped>
.aa-game-room { position: relative; flex: 1 1 0; min-height: 0; height: 100%; overflow: hidden; display: flex; flex-direction: column; color: #17134a; font-family: var(--arena-font-family); background: #eee9ff; -webkit-app-region: no-drag; }
.aa-game-room :deep(.arena-page-state),
.aa-game-room :deep(.arena-page-state__frame),
.aa-game-room :deep(.arena-page-state__revealed),
.aa-game-room :deep(.arena-page-state__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.aa-game-backdrop { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(135deg, rgba(251,249,255,.42), rgba(235,226,255,.76)), var(--aa-game-bg-image, none) center/cover no-repeat; opacity: .96; }
.aa-game-backdrop::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 56% 38%, rgba(143,105,255,.18), transparent 32%), radial-gradient(circle at 78% 72%, rgba(255,147,212,.14), transparent 24%); }
.aa-room-drag { -webkit-app-region: drag; } .aa-room-no-drag, button, details { -webkit-app-region: no-drag; }
.aa-game-topbar { position: relative; z-index: 4; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; }
.aa-game-brand { display: flex; align-items: center; gap: 11px; min-width: 0; } .aa-game-brand__mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 15px; color: #fff; background: linear-gradient(135deg,#8a68ff,#6c5cff); box-shadow: 0 14px 30px rgba(105,91,255,.22); }
.aa-game-title-wrap { display: grid; gap: 4px; } .aa-title-actions { display: flex; align-items: center; gap: 8px; } .aa-game-title-wrap strong { font-size: 19px; line-height: 1; letter-spacing: 0; } .aa-game-room-code, .aa-event-open { display: inline-flex; align-items: center; gap: 5px; width: max-content; border: 0; background: transparent; color: #756e9d; font-size: 12px; cursor: pointer; } .aa-game-room-code em { font-style: normal; color: #7b5cff; } .aa-event-open { width: auto; border: 0; background: rgba(255,255,255,.56); padding: 0 7px; height: 22px; border-radius: 999px; color: #7467a3; cursor: pointer; }
.aa-game-top-pills { display: flex; gap: 8px; align-items: center; } .aa-game-top-pills span, .aa-game-top-pills button { height: 31px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.62); border: 1px solid rgba(132,112,210,.1); color: #342b78; font-size: 12px; font-weight: 650; } .aa-game-top-pills button { cursor: pointer; }
.aa-human-toggle.is-active { background: rgba(124,92,255,.14); border-color: rgba(124,92,255,.34); color: #6d4cff; }
.aa-human-toggle.is-locked, .aa-human-toggle:disabled { opacity: .55; cursor: not-allowed; }
.aa-human-identity-pill { height: 31px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 999px; background: rgba(124,92,255,.12); border: 1px solid rgba(124,92,255,.24); color: #5a46c8; font-size: 12px; font-weight: 650; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.aa-game-layout { position: relative; }
.aa-game-layout.has-floating-action :deep(.aa-story-stage) { padding-bottom: 168px; }
.aa-game-layout--immersive.has-floating-action { padding-bottom: 168px; }
.aa-story-stage { position: relative; }
.aa-top-status { position: relative; height: 31px; display: inline-flex; align-items: center; gap: 6px; max-width: 168px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.72); border: 1px solid rgba(126,99,255,.18); color: #4a3f8f; font-size: 12px; font-weight: 650; cursor: default; flex: none; }
.aa-top-status.is-calling { border-color: rgba(126,99,255,.28); background: rgba(244,240,255,.88); }
.aa-top-status.is-paused, .aa-top-status.is-error { border-color: rgba(213,88,130,.22); background: rgba(255,241,247,.88); color: #b64b70; }
.aa-top-status__label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aa-top-status__tip { position: absolute; left: 50%; top: calc(100% + 10px); z-index: 20; width: max-content; max-width: min(360px, calc(100vw - 48px)); display: grid; gap: 10px; padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,.97); border: 1px solid rgba(126,99,255,.14); box-shadow: 0 18px 42px rgba(53,45,110,.18); color: #4f4778; font-size: 13px; line-height: 1.55; font-weight: 500; opacity: 0; pointer-events: none; transform: translate(-50%, -4px); transition: opacity 160ms ease, transform 160ms ease; }
.aa-top-status.is-immersive { background: rgba(255,255,255,.58); border-color: rgba(126,99,255,.14); color: #5f538f; }
.aa-top-status.is-immersive .aa-top-status__label { color: #4a3f8f; font-weight: 700; }
.aa-immersive-phase-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,.62); border: 1px solid rgba(126,99,255,.12); color: #4a3f8f; font-size: 12px; font-weight: 700; }
.aa-top-status:hover .aa-top-status__tip, .aa-top-status:focus-within .aa-top-status__tip { opacity: 1; pointer-events: auto; transform: translate(-50%, 0); }
.aa-top-status__tip p { margin: 0; white-space: pre-wrap; word-break: break-word; }
.aa-top-status__tip button { justify-self: start; height: 28px; padding: 0 10px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(135deg,#8d6bff,#5b58f7); font-size: 12px; font-weight: 650; cursor: pointer; }
.aa-game-layout { position: relative; z-index: 1; flex: 1 1 0; min-height: 0; overflow: hidden; display: grid; grid-template-columns: clamp(250px, 23vw, 330px) minmax(0, 1fr); gap: 16px; padding: 0 28px 20px; -webkit-app-region: no-drag; }
.aa-game-layout--immersive { grid-template-columns: minmax(0, 1fr); padding-inline: 16px; }
.aa-game-room--immersive .aa-game-backdrop { opacity: 1; background: linear-gradient(180deg, rgba(18, 14, 48, 0.18), rgba(235, 226, 255, 0.82)), var(--aa-game-bg-image, none) center/cover no-repeat; }
.aa-seat-board { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 14px; border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.64), rgba(248,245,255,.42)); border: 1px solid rgba(137,113,214,.13); box-shadow: 0 22px 58px rgba(73,58,130,.1); }
.aa-phase-token { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 20px; background: linear-gradient(135deg, rgba(135,99,255,.16), rgba(255,255,255,.58)); } .aa-phase-token svg { color: #7458e8; } .aa-phase-token div { display: grid; gap: 3px; } .aa-phase-token strong { font-size: 16px; } .aa-phase-token span, .aa-phase-token small { color: #756e9a; font-size: 12px; } .aa-phase-token small { color: #948cac; }
.aa-player-orbit { min-height: 0; overflow: auto; scrollbar-width: none; display: grid; align-content: start; gap: 8px; padding: 2px; } .aa-player-orbit::-webkit-scrollbar { display: none; }
.aa-seat-card { position: relative; min-width: 0; width: 100%; min-height: 56px; display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px; border-radius: 18px; border: 1px solid rgba(120,101,180,.1); background: rgba(255,255,255,.55); color: inherit; text-align: left; cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease; } .aa-seat-card:hover { transform: translateX(4px); background: rgba(255,255,255,.82); } .aa-seat-card.is-speaking { transform: translateX(6px); box-shadow: inset 3px 0 0 #7d62ff, 0 14px 30px rgba(102,81,190,.14); } .aa-seat-card.is-out { opacity: .42; filter: grayscale(.55); }
.aa-seat-card.camp-good { border-color: rgba(47,177,120,.22); } .aa-seat-card.camp-wolf { border-color: rgba(218,73,116,.28); } .aa-seat-card.camp-villager { border-color: rgba(73,145,218,.22); } .aa-seat-card.camp-neutral { border-color: rgba(139,110,255,.18); } .aa-seat-card.camp-hidden { border-color: rgba(131,123,164,.16); background: rgba(255,255,255,.48); }
.aa-seat-card.camp-guess { border-color: rgba(124,92,255,.52); background: linear-gradient(135deg, rgba(244,239,255,.94), rgba(255,248,230,.82)); box-shadow: inset 0 0 0 1px rgba(124,92,255,.18), 0 10px 24px rgba(102,81,190,.12); }
.aa-seat-card.has-guess { padding-bottom: 22px; }
.aa-guess-badge { position: absolute; left: 8px; bottom: 5px; z-index: 2; padding: 3px 9px; border-radius: 999px; background: linear-gradient(135deg,#8d6bff,#5b58f7); color: #fff; font-size: 10px; font-weight: 800; letter-spacing: .03em; box-shadow: 0 6px 16px rgba(93,88,247,.38); pointer-events: none; }
.aa-seat-card.is-tts-speaking { border-color: rgba(125,92,255,.42); box-shadow: inset 3px 0 0 #8a68ff, 0 14px 30px rgba(102,81,190,.18); }
.aa-seat-card.is-self { border-color: rgba(255,147,212,.32); background: linear-gradient(135deg, rgba(255,248,252,.88), rgba(244,238,255,.72)); }
.aa-self-badge { position: absolute; left: 38px; bottom: 6px; z-index: 2; width: 18px; height: 18px; display: grid; place-items: center; border-radius: 50%; background: linear-gradient(135deg, rgba(255,147,212,.32), rgba(124,92,255,.18)); color: #9b3fd0; font-size: 10px; font-weight: 900; box-shadow: 0 4px 10px rgba(180,92,200,.18); }
.aa-player-avatar, .aa-talk-avatar { background-size: cover; background-position: center; flex: none; } .aa-player-avatar { position: relative; width: 38px; height: 38px; border-radius: 14px; }
.aa-player-avatar.is-tts-speaking { box-shadow: 0 0 0 2px rgba(125,92,255,.55), 0 0 16px rgba(125,92,255,.32); animation: ttsAvatarGlow 1.15s ease-in-out infinite; }
.aa-tts-waves { position: absolute; right: -3px; bottom: -2px; display: flex; align-items: flex-end; gap: 2px; width: 14px; height: 12px; padding: 2px 3px; border-radius: 8px; background: rgba(255,255,255,.92); box-shadow: 0 4px 10px rgba(68,55,130,.16); }
.aa-tts-waves i { display: block; width: 2px; border-radius: 999px; background: linear-gradient(180deg,#9b7bff,#6d54d8); animation: ttsWave 760ms ease-in-out infinite; }
.aa-tts-waves i:nth-child(1) { height: 4px; animation-delay: 0ms; }
.aa-tts-waves i:nth-child(2) { height: 7px; animation-delay: 120ms; }
.aa-tts-waves i:nth-child(3) { height: 5px; animation-delay: 240ms; } .aa-seat-copy { min-width: 0; display: grid; gap: 3px; } .aa-seat-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; } .aa-seat-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6f688f; font-size: 11px; }
.aa-seat-card.has-acted { box-shadow: inset 2px 0 0 rgba(125,92,255,.3); } .aa-spoken-mark { position: absolute; right: 34px; top: 7px; padding: 2px 6px; border-radius: 999px; background: rgba(124,92,255,.1); color: #6d54d8; font-size: 10px; font-weight: 800; } .aa-seat-card i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-style: normal; color: #9b6410; background: #fff1cc; font-size: 11px; font-weight: 900; } .aa-player-peek { position: absolute; left: 44px; top: 48px; z-index: 10; width: 210px; padding: 10px; border-radius: 15px; background: rgba(255,255,255,.96); box-shadow: 0 18px 44px rgba(53,45,110,.18); opacity: 0; pointer-events: none; transform: translateY(-4px); transition: 160ms ease; } .aa-seat-card:hover .aa-player-peek { opacity: 1; transform: translateY(0); } .aa-player-peek p { margin: 5px 0; color: #5a527e; font-size: 12px; } .aa-player-peek em { color: #8a83a6; font-size: 11px; font-style: normal; }
.aa-story-stage { position: relative; min-height: 0; overflow: hidden; display: grid; grid-template-rows: minmax(0,1fr); padding: 16px; border-radius: 32px; background: linear-gradient(145deg, rgba(255,255,255,.5), rgba(246,241,255,.34)); border: 1px solid rgba(137,113,214,.13); box-shadow: 0 24px 70px rgba(73,58,130,.12); }
.aa-stage-glow { position: absolute; inset: 12px; border-radius: 28px; pointer-events: none; background: radial-gradient(circle at 50% 0%, rgba(143,105,255,.14), transparent 36%); }
.aa-message-stream { position: relative; z-index: 1; min-height: 0; overflow: auto; scrollbar-width: none; padding: 18px max(30px, 6vw) 52px; display: flex; flex-direction: column; gap: 16px; align-items: stretch; } .aa-message-stream::-webkit-scrollbar { display: none; } .aa-empty-talk { margin: auto; display: grid; place-items: center; gap: 8px; color: #746d98; font-size: 13px; }
.aa-talk-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; width: min(940px, 96%); max-width: 100%; animation: messageIn 260ms ease both; } .aa-talk-row.is-speech { margin-left: 0; } .aa-talk-row.is-event, .aa-talk-row.is-system, .aa-talk-row.is-judge, .aa-talk-row.is-warning, .aa-talk-row.is-vote, .aa-talk-row.is-resource { width: min(820px, 92%); margin-inline: auto; }
.aa-talk-avatar { width: 44px; height: 44px; border-radius: 16px; box-shadow: 0 8px 18px rgba(56,46,120,.12); } .aa-talk-row.is-referee .aa-talk-avatar { border: 1px solid rgba(132,92,255,.2); box-shadow: 0 10px 24px rgba(110,83,210,.16); }
.aa-talk-shell { min-width: 0; display: grid; gap: 6px; width: 100%; } .aa-talk-meta { display: flex; align-items: center; gap: 6px; color: #867da5; font-size: 11px; } .aa-talk-meta strong { color: #211950; font-size: 13px; } .aa-talk-meta span, .aa-talk-meta em { padding: 2px 7px; border-radius: 999px; background: rgba(125,92,255,.09); color: #6d54d4; font-style: normal; }
.aa-speech-wrap { display: block; width: 100%; max-width: min(760px, 100%); }
.aa-speech-bubble { position: relative; width: 100%; max-width: min(760px, 100%); padding: 13px 15px 12px; border-radius: 20px 20px 20px 8px; background: rgba(255,255,255,.82); color: #2e2855; text-align: left; box-shadow: 0 16px 38px rgba(68,55,130,.1); overflow: hidden; transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease; }
.aa-stream-text { display: block; line-height: 1.72; font-size: 14px; }
.aa-stream-text.match-speech-content { white-space: pre-wrap; }
.aa-speech-bubble.is-live .aa-live-caret { display: inline-block; width: 7px; height: 1em; margin-left: 2px; vertical-align: -2px; border-right: 2px solid rgba(125,92,255,.5); animation: caretBlink 760ms steps(1) infinite; }
.aa-speech-bubble.is-thinking { color: #766d99; background: rgba(255,255,255,.66); border: 1px dashed rgba(125,92,255,.22); }
.aa-speech-bubble.is-tts-speaking { border-color: rgba(98,184,255,.42); box-shadow: 0 16px 38px rgba(98,184,255,.14), inset 0 0 0 1px rgba(98,184,255,.12); animation: ttsAvatarGlow 1.15s ease-in-out infinite; }
.aa-thought-block { width: 100%; max-width: min(760px, 100%); display: grid; gap: 8px; }
.aa-thought-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.aa-thought-toggle, .aa-emotion { width: auto; min-width: 94px; box-sizing: border-box; justify-content: center; } .aa-thought-toggle { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 11px; border: 0; border-radius: 999px; background: rgba(125,92,255,.09); color: #6d54d8; font-size: 11px; font-weight: 760; cursor: pointer; } .aa-thought-toggle:hover { background: rgba(125,92,255,.16); transform: translateY(-1px); }
.aa-thought-panel { width: 100%; max-width: min(760px, 100%); padding: 13px 15px; border-radius: 20px 20px 20px 8px; background: linear-gradient(135deg, rgba(68,48,130,.08), rgba(255,255,255,.72)); border: 1px solid rgba(125,92,255,.13); box-shadow: 0 12px 28px rgba(68,55,130,.08); animation: thoughtOpen 180ms ease both; }
.aa-thought-block.is-streaming .aa-thought-panel { border-color: rgba(125,92,255,.22); }
.aa-thought-panel strong { display: block; color: #5f4cdf; font-size: 12px; margin-bottom: 6px; } .aa-thought-panel p { margin: 0; color: #514a72; font-size: 14px; line-height: 1.72; white-space: pre-wrap; word-break: break-word; }
.aa-emotion { position: relative; height: 24px; display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; border-radius: 999px; background: rgba(125,92,255,.09); color: #6655c8; font-size: 11px; font-weight: 760; cursor: default; white-space: nowrap; } .aa-emotion b { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; background: #fff; color: #7a5cff; flex: none; font-size: 10px; } .aa-emotion > span:not(.aa-emotion-pop) { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; } .aa-emotion-pop { position: absolute; left: 0; top: calc(100% + 8px); z-index: 12; min-width: 210px; max-width: 260px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px; border-radius: 15px; background: rgba(255,255,255,.96); border: 1px solid rgba(126,99,255,.12); box-shadow: 0 18px 42px rgba(53,45,110,.18); color: #6655c8; opacity: 0; pointer-events: none; transform: translateY(-4px); transition: opacity 160ms ease, transform 160ms ease; } .aa-emotion:hover .aa-emotion-pop { opacity: 1; transform: translateY(0); } .aa-emotion-pop strong { flex: 1 0 100%; color: #211950; font-size: 12px; } .aa-emotion-pop em { padding: 3px 6px; border-radius: 999px; background: rgba(125,92,255,.09); color: #8176a8; font-style: normal; font-size: 10px; font-weight: 700; } .aa-emotion.emotion-风险追踪 { background: rgba(255,120,161,.12); color: #bf3e72; } .aa-emotion.emotion-节奏推进 { background: rgba(125,92,255,.13); color: #6047d8; } .aa-emotion.emotion-阵营站边 { background: rgba(66,195,142,.13); color: #248962; }
.aa-thinking-inline, .aa-thinking-bubble { width: 100%; display: flex; align-items: center; gap: 6px; color: #766d99; font-size: 13px; } .aa-thinking-inline i, .aa-thinking-bubble i { width: 7px; height: 7px; border-radius: 50%; background: #8a68ff; animation: thinkingPulse 900ms ease-in-out infinite; flex: none; } .aa-thinking-inline i:nth-child(2), .aa-thinking-bubble i:nth-child(2) { animation-delay: 120ms; } .aa-thinking-inline i:nth-child(3), .aa-thinking-bubble i:nth-child(3) { animation-delay: 240ms; }
.aa-judge-note { width: min(680px, 100%); display: grid; grid-template-columns: 18px auto minmax(0,1fr) auto; align-items: center; gap: 7px; padding: 9px 11px; border-radius: 16px; background: rgba(255,247,235,.78); border: 1px solid rgba(224,163,74,.2); color: #6b5277; font-size: 12px; } .aa-judge-note b { color: #44345d; } .aa-judge-note p { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .aa-judge-note span { color: #9a8ca8; font-size: 11px; }
.aa-god-view-note { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 10px; align-items: start; margin-top: 10px; padding: 11px 12px; border-radius: 16px; background: rgba(244,240,255,.88); border: 1px solid rgba(125,92,255,.16); color: #5f4f8f; font-size: 12px; }
.aa-god-view-note svg { margin-top: 2px; color: #7a5cff; flex: none; }
.aa-god-view-note b { display: block; margin-bottom: 6px; color: #44345d; font-size: 12px; }
.aa-god-view-note p { margin: 0; white-space: pre-wrap; line-height: 1.62; word-break: break-word; color: #514974; }
.aa-event-card { width: 100%; box-sizing: border-box; padding: 14px; border-radius: 21px; background: rgba(255,255,255,.66); border: 1px solid rgba(127,105,200,.12); box-shadow: 0 14px 34px rgba(68,55,130,.08); } .aa-widget-head { display: flex; align-items: center; gap: 8px; color: #6f668f; font-size: 12px; } .aa-widget-head strong { color: #211950; font-size: 14px; } .aa-widget-head span { margin-left: auto; color: #8b84aa; } .aa-event-card p { margin: 9px 0 0; color: #514974; line-height: 1.58; font-size: 13px; }
.aa-vote-widget { background: linear-gradient(135deg, rgba(244,240,255,.88), rgba(255,255,255,.7)); } .aa-vote-widget.is-tally .aa-vote-detail-line.is-leader { border-color: rgba(125,92,255,.28); box-shadow: 0 0 0 1px rgba(125,92,255,.12); }
.aa-vote-tally { display: grid; grid-template-columns: 148px minmax(0, 1fr); gap: 16px; align-items: start; margin-top: 12px; }
.aa-vote-pie-wrap { display: grid; gap: 8px; justify-items: center; }
.aa-vote-pie { width: 128px; height: 128px; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(125,92,255,.12), 0 12px 28px rgba(68,55,130,.1); }
.aa-vote-pie-total { color: #6f668f; font-size: 12px; font-weight: 700; }
.aa-vote-detail { display: grid; gap: 8px; min-width: 0; }
.aa-vote-detail-line { display: grid; grid-template-columns: 10px minmax(72px, auto) auto; gap: 8px 10px; align-items: center; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.58); border: 1px solid rgba(125,92,255,.08); font-size: 12px; color: #5b527d; animation: messageIn 220ms ease both; }
.aa-vote-detail-line > i { width: 10px; height: 10px; border-radius: 50%; flex: none; }
.aa-vote-detail-name { font-weight: 700; color: #3f3768; }
.aa-vote-detail-line b { margin-left: auto; color: #6d54d8; white-space: nowrap; }
.aa-vote-detail-line small { grid-column: 2 / -1; color: #938bac; line-height: 1.45; word-break: break-word; } .aa-vote-progress { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; margin-top: 10px; font-size: 11px; color: #7a7199; } .aa-vote-progress i { display: block; height: 6px; border-radius: 999px; background: linear-gradient(90deg,#7d62ff,#d178ff); transition: width 260ms ease; } .aa-vote-bars { display: grid; gap: 8px; margin-top: 12px; } .aa-vote-line { display: grid; grid-template-columns: 70px minmax(0,1fr) 52px; gap: 8px; align-items: center; font-size: 12px; color: #5b527d; animation: messageIn 220ms ease both; } .aa-vote-line i { height: 8px; min-width: 18px; max-width: 100%; border-radius: 999px; background: linear-gradient(90deg,#7d62ff,#d178ff); transition: width 320ms ease; } .aa-vote-line small { grid-column: 2 / -1; color: #938bac; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .aa-vote-feed { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; max-height: 120px; overflow: auto; } .aa-vote-feed li { padding: 4px 8px; border-radius: 10px; background: rgba(125,92,255,.06); color: #6f668f; font-size: 11px; animation: messageIn 180ms ease both; }
.aa-skill-widget { background: linear-gradient(135deg, rgba(238,244,255,.84), rgba(255,255,255,.68)); } .aa-event-warning { background: rgba(255,246,232,.86); border-color: rgba(235,166,65,.25); }
.aa-info-overlay { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(25,18,64,.42); -webkit-app-region: no-drag; pointer-events: auto; } .aa-info-dialog, .aa-thought-dialog, .aa-events-dialog { position: relative; width: min(680px, calc(100vw - 80px)); max-height: min(620px, calc(100vh - 80px)); overflow: auto; padding: 22px; border-radius: 26px; background: rgba(255,255,255,.94); box-shadow: 0 34px 90px rgba(37,28,100,.28); } .aa-thought-dialog { width: min(520px, calc(100vw - 80px)); } .aa-events-dialog { width: min(620px, calc(100vw - 80px)); } .aa-dialog-kicker { display: inline-flex; align-items: center; gap: 6px; color: #7a5cff; font-size: 12px; font-weight: 800; } .aa-thought-dialog h2, .aa-info-dialog h2 { margin: 10px 0 14px; font-size: 22px; } .aa-thought-dialog p { color: #4f4771; line-height: 1.7; }
.aa-event-list { display: grid; gap: 8px; max-height: min(460px, calc(100vh - 220px)); overflow: auto; scrollbar-width: none; } .aa-event-list::-webkit-scrollbar { display: none; } .aa-event-list article { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 10px; padding: 11px; border-radius: 15px; background: rgba(246,243,255,.72); } .aa-event-list i { font-style: normal; } .aa-event-list time { color: #8b84a8; font-size: 11px; } .aa-event-list p { margin: 3px 0 0; color: #504873; font-size: 12px; line-height: 1.55; } .aa-event-empty { color: #8b84a8; } .aa-info-close { position: absolute; right: 16px; top: 14px; border: 0; background: transparent; font-size: 26px; color: #6f668f; cursor: pointer; } .aa-resource-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; } .aa-resource-grid span { display: grid; gap: 6px; padding: 13px; border-radius: 16px; background: rgba(246,243,255,.76); color: #7b739e; font-size: 12px; } .aa-resource-grid b { color: #251f5d; font-size: 16px; } .aa-info-note { color: #6f688f; line-height: 1.6; }
.aa-new-message { position: absolute; right: 28px; bottom: 26px; z-index: 5; height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(135deg,#8d6bff,#6a5cff); box-shadow: 0 16px 34px rgba(92,78,230,.26); font-size: 12px; font-weight: 800; cursor: pointer; animation: messageIn 180ms ease both; } .aa-new-message:hover { transform: translateY(-2px); }
.aa-game-state { position: relative; z-index: 2; height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center; gap: 10px; color: #5f5690; font-size: 16px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes ttsAvatarGlow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.08); } } @keyframes ttsWave { 0%, 100% { transform: scaleY(.55); opacity: .55; } 50% { transform: scaleY(1); opacity: 1; } } @keyframes messageIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes caretBlink { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } } @keyframes thoughtOpen { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } } @keyframes thinkingPulse { 0%, 80%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } } @keyframes tallyPulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
.aa-talk-row.is-human-player .aa-talk-meta em { background: linear-gradient(135deg, rgba(255,147,212,.22), rgba(124,92,255,.18)); color: #8b3fd4; font-weight: 800; }
.aa-speech-bubble.is-human-player { background: linear-gradient(135deg, rgba(255,248,252,.96), rgba(244,238,255,.92)); border: 1px solid rgba(255,120,180,.28); box-shadow: 0 16px 38px rgba(180,92,200,.12), inset 0 0 0 1px rgba(255,255,255,.72); }
.aa-human-speech-tag { display: inline-flex; align-items: center; height: 22px; margin-bottom: 8px; padding: 0 10px; border-radius: 999px; background: linear-gradient(135deg, rgba(255,147,212,.24), rgba(124,92,255,.16)); color: #9b3fd0; font-size: 11px; font-weight: 800; letter-spacing: .04em; }
@media (max-width: 1320px) { .aa-game-layout { grid-template-columns: 255px minmax(0, 1fr); padding-inline: 20px; } .aa-message-stream { padding-inline: 28px; } .aa-game-topbar { padding-inline: 20px; } .aa-vote-tally { grid-template-columns: 1fr; } .aa-vote-pie-wrap { justify-items: start; } }
</style>
