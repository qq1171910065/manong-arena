<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { AlertTriangle, Bot, Brain, Copy, Crown, Eye, ListChecks, Loader2, MessageCircle, MoonStar, Radio, ShieldCheck, Sparkles, Users, Vote, Zap } from 'lucide-vue-next'
import MatchRoomEscMenu from '@renderer/components/arena/MatchRoomEscMenu.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName } from '@renderer/data/arena-visual-assets'
import judgeAvatar from '@renderer/assets/home/judge-avatar.png'
import { route } from '../router'
import { billingService, formatUserMessage, gameModeService, matchEngine, matchService, matchWindowService, playArenaTone, settingsService } from '@renderer/services/arena'
import { formatYuan } from '@renderer/utils/id'
import type { Match, MatchMessage, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'

const match = ref<Match | null>(null)
const loading = ref(true)
const advancing = ref(false)
const error = ref('')
const settings = ref(settingsService.defaults())
const copied = ref(false)
const viewMode = ref<'god' | 'player'>('god')
const guessedRoles = ref<Record<string, string>>({})
const showEvents = ref(false)
const expandedThoughtIds = ref<Set<string>>(new Set())
const messageStreamRef = ref<HTMLElement | null>(null)
const showNewMessageHint = ref(false)
const lastMessageCount = ref(0)
const escMenuRef = ref<InstanceType<typeof MatchRoomEscMenu> | null>(null)
const autoTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)
const kickoffTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)

const matchId = computed(() => route.value.id || '')
const mode = computed(() => (match.value ? gameModeService.get(match.value.gameModeId) : null))
const participants = computed(() => match.value?.participants ?? [])
const aliveParticipants = computed(() => participants.value.filter((p) => p.alive === 'alive'))
const isCompleted = computed(() => match.value?.status === 'completed')
const actionKind = computed(() => match.value?.runtime.currentActionKind ?? 'idle')
const spentLabel = computed(() => formatYuan(match.value?.totalCostCents || 0))
const visibleMessages = computed(() => match.value?.messages.slice(-60) ?? [])
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
  const map = {
    speech: { label: '公开发言', icon: MessageCircle, className: 'is-speech', hint: '逐位发言，裁判会审阅并记录必要提醒。' },
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
const canAdvance = computed(() => Boolean(match.value && match.value.status === 'active' && !isCompleted.value && (match.value.runtime.stepAdvanceState === 'ready' || match.value.runtime.stepAdvanceState === 'paused')))
const autoAdvanceActive = computed(() => Boolean(match.value?.status === 'active' && settings.value.matchDefaults.autoAdvance && canAdvance.value && !advancing.value && !error.value && !(actionKind.value === 'judge' && !settings.value.matchDefaults.autoNextRound)))
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
  if (!p) return { backgroundImage: 'url(' + judgeAvatar + ')', backgroundColor: '#7c5cff' }
  return { backgroundImage: 'url(' + characterAvatarByName(p.characterName, p.seatOrder, p.modelId, p.avatarUrl) + ')', backgroundColor: p.accentColor }
}
function messageAvatarStyle(msg: MatchMessage) {
  const participant = participantById(msg.participantId)
  if (participant) return avatarStyle(participant)
  return { backgroundImage: 'url(' + judgeAvatar + ')', backgroundColor: '#7c5cff' }
}
function aliveLabel(p: MatchParticipant): string { return p.alive === 'alive' ? '在场' : p.alive === 'spectating' ? '旁观' : '出局' }
function realCampLabel(p: MatchParticipant): string { if (p.roleId === 'villager') return '平民'; return p.roleCamp === 'wolf' ? '狼人' : p.roleCamp === 'good' ? '好人' : '未知' }
function campLabel(p: MatchParticipant): string { return viewMode.value === 'god' || p.revealed || p.alive === 'eliminated' ? realCampLabel(p) : guessedRoles.value[p.characterId] ? '猜测：' + guessedRoles.value[p.characterId] : '身份未知' }
function campClass(p: MatchParticipant): string { if (viewMode.value === 'player' && !p.revealed && p.alive !== 'eliminated') return guessedRoles.value[p.characterId] ? 'camp-guess' : 'camp-hidden'; if (p.roleId === 'villager') return 'camp-villager'; return p.roleCamp === 'wolf' ? 'camp-wolf' : p.roleCamp === 'good' ? 'camp-good' : 'camp-neutral' }
function visibleRoleName(p: MatchParticipant): string { return viewMode.value === 'god' || p.revealed || p.alive === 'eliminated' ? p.roleName || '未知' : guessedRoles.value[p.characterId] ? '疑似' + guessedRoles.value[p.characterId] : '未公开' }
function roleSkill(roleId: string | null | undefined): string { return mode.value?.roles.find((role) => role.id === roleId)?.skillName || '无技能' }
function cycleGuess(p: MatchParticipant) { if (viewMode.value !== 'player') return; const options = guessOptions.value; if (!options.length) return; const current = guessedRoles.value[p.characterId]; const index = current ? options.indexOf(current) : -1; guessedRoles.value = { ...guessedRoles.value, [p.characterId]: options[(index + 1) % options.length] } }
function toggleViewMode() { viewMode.value = viewMode.value === 'god' ? 'player' : 'god' }
function hasActed(p: MatchParticipant): boolean { return Boolean(match.value?.runtime.actedCharacterIds.includes(p.characterId)) }
function messageTone(msg: MatchMessage): string { return 'is-' + msg.kind + (msg.participantId === 'judge' || msg.kind !== 'speech' ? ' is-referee' : '') }
function messageOrder(msg: MatchMessage): string {
  const sameRound = (match.value?.messages || []).filter((item) => item.round === msg.round && item.phaseId === msg.phaseId)
  const index = Math.max(0, sameRound.findIndex((item) => item.id === msg.id)) + 1
  return 'R' + msg.round + ' · #' + index
}
function hasThought(msg: MatchMessage): boolean { return Boolean((msg as MatchMessage & { thought?: string }).thought) }
function thoughtText(msg: MatchMessage | null): string { return ((msg as MatchMessage & { thought?: string } | null)?.thought || '').trim() }
function formatClock(value: string | null | undefined): string { return value ? value.slice(11, 16) : '--:--' }
function messageIcon(msg: MatchMessage) { if (msg.kind === 'warning') return AlertTriangle; if (msg.kind === 'vote') return Vote; if (msg.kind === 'resource') return MoonStar; if (msg.kind === 'judge' || msg.kind === 'event' || msg.kind === 'system') return ShieldCheck; return MessageCircle }
function thoughtKey(msg: MatchMessage): string { return msg.id }
function isThoughtOpen(msg: MatchMessage): boolean { return expandedThoughtIds.value.has(thoughtKey(msg)) }
function toggleThought(msg: MatchMessage) {
  if (viewMode.value !== 'god' || !hasThought(msg)) return
  const next = new Set(expandedThoughtIds.value)
  const key = thoughtKey(msg)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedThoughtIds.value = next
}
function isSpeechStreaming(msg: MatchMessage): boolean {
  return msg.kind === 'speech' && msg.streamStatus !== undefined && msg.streamStatus !== 'done'
}
function isSpeechThinking(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && !msg.content.trim()
}
function isSpeechLive(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && Boolean(msg.content.trim())
}
function isVoteLive(msg: MatchMessage): boolean {
  return msg.kind === 'vote' && msg.streamStatus === 'streaming'
}
function isVoteDone(msg: MatchMessage): boolean {
  return msg.kind === 'vote' && msg.streamStatus === 'done'
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
function emotionForMessage(msg: MatchMessage): { icon: string; label: string; energy: string; certainty: string; tags: string[]; className: string } | null {
  if (msg.kind !== 'speech') return null
  const text = msg.content + ' ' + thoughtText(msg)
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
function votesForMessage(msg: MatchMessage): MatchVoteRecord[] {
  return (match.value?.votes || []).filter((vote) => vote.round === msg.round && vote.phaseId === msg.phaseId)
}
function voteSummary(msg: MatchMessage) {
  const votes = votesForMessage(msg)
  const sheriffId = match.value?.runtime.werewolfState?.sheriffId || match.value?.runtime.sheriffId || null
  const map = new Map<string, { name: string; count: number; voters: string[] }>()
  for (const vote of votes) {
    const key = vote.abstain || !vote.targetId ? 'abstain' : vote.targetId
    const item = map.get(key) || { name: vote.abstain ? '弃权' : vote.targetName || '未知', count: 0, voters: [] }
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
function clearAutoTimer() { if (autoTimer.value) window.clearTimeout(autoTimer.value); autoTimer.value = null }
function clearKickoffTimer() { if (kickoffTimer.value) window.clearTimeout(kickoffTimer.value); kickoffTimer.value = null }
function shouldKickoffMatch(): boolean {
  return Boolean(match.value && match.value.status === 'active' && match.value.messages.length === 0 && match.value.runtime.stepAdvanceState === 'ready')
}
function scheduleKickoff() {
  clearKickoffTimer()
  if (!shouldKickoffMatch()) return
  kickoffTimer.value = window.setTimeout(() => { if (shouldKickoffMatch()) void advance('auto') }, 520)
}
function scheduleAutoAdvance() { clearAutoTimer(); if (!autoAdvanceActive.value) return; const delay = settings.value.matchDefaults.fastMode ? 500 : actionKind.value === 'speech' ? 1200 : 780; autoTimer.value = window.setTimeout(() => { if (autoAdvanceActive.value) void advance('auto') }, delay) }
async function copyRoomCode() { if (!match.value?.roomCode) return; await navigator.clipboard?.writeText(match.value.roomCode).catch(() => undefined); copied.value = true; window.setTimeout(() => (copied.value = false), 1200) }
function openEscMenu() { escMenuRef.value?.openMenu() }
async function load() { if (!matchId.value) return; loading.value = true; error.value = ''; try { match.value = await matchEngine.load(matchId.value); scheduleKickoff() } catch (err) { error.value = formatUserMessage(err) || '房间暂时没有准备好' } finally { loading.value = false } }
async function advance(source: 'manual' | 'auto' = 'manual') {
  if (!match.value || advancing.value || !canAdvance.value) return
  clearAutoTimer(); advancing.value = true; error.value = ''
  try {
    if (settings.value.matchDefaults.pauseOnLowBalance || settings.value.balanceReminder) {
      const balance = await billingService.getBalanceCents(true)
      if (balance !== null && balance < settings.value.balanceReminderThresholdCents && settings.value.matchDefaults.pauseOnLowBalance) { error.value = '余额低于阈值，已暂停推进。'; playArenaTone('warn'); return }
    }
    match.value = await matchEngine.advanceStep(match.value.id, {
      onDelta: (next) => {
        match.value = next
        void nextTick(() => {
          if (isNearStreamBottom()) scrollToLatest(false)
        })
      },
    })
    playArenaTone(source === 'auto' ? 'click' : 'step')
  } catch (err) { error.value = formatUserMessage(err); match.value = await matchService.get(matchId.value) } finally { advancing.value = false }
}
async function reloadSettings() { settings.value = await settingsService.get().catch(() => settingsService.defaults()) }
watch(() => visibleMessages.value.length, async (count, previous) => {
  await nextTick()
  if (!previous || count <= previous) { lastMessageCount.value = count; scrollToLatest(false); return }
  if (isNearStreamBottom()) scrollToLatest(false)
  else showNewMessageHint.value = true
  lastMessageCount.value = count
})
watch([match, canAdvance, autoAdvanceActive], () => { scheduleKickoff(); scheduleAutoAdvance() }, { deep: true })
onMounted(async () => { await matchWindowService.getKind().catch(() => 'main'); await reloadSettings(); window.addEventListener('arena:settings-change', reloadSettings); await load() })
onUnmounted(() => { clearAutoTimer(); clearKickoffTimer(); window.removeEventListener('arena:settings-change', reloadSettings) })
</script>

<template>
  <div class="aa-game-room" :class="phaseClass">
    <div class="aa-game-backdrop" />
    <header class="aa-game-topbar aa-room-drag">
      <div class="aa-game-brand">
        <div class="aa-game-brand__mark"><Sparkles :size="18" /></div>
        <div class="aa-game-title-wrap">
          <strong>{{ match?.title || '对局房间' }}</strong>
          <div class="aa-title-actions"><button type="button" class="aa-game-room-code aa-room-no-drag" @click="copyRoomCode">{{ match?.roomCode || '---' }}<Copy :size="12" /><em>{{ copied ? '已复制' : '复制' }}</em></button><button v-if="match" type="button" class="aa-event-open aa-room-no-drag" @click="showEvents = true"><ListChecks :size="12" />事件</button></div>
        </div>
      </div>
      <div class="aa-game-top-pills aa-room-no-drag">
        <span><Users :size="14" />{{ aliveParticipants.length }}/{{ participants.length }}</span>
        <span><Crown :size="14" />{{ sheriff?.characterName || '无警长' }}</span>
        <button type="button" class="aa-view-toggle" @click="toggleViewMode"><Eye :size="14" />{{ viewMode === 'god' ? '上帝视角' : '玩家视角' }}</button>
        <span><Zap :size="14" />{{ spentLabel }}</span>
        <button type="button" @click="openEscMenu"><component :is="PhaseIcon" :size="14" />ESC</button>
      </div>
    </header>

    <ArenaPageState
      :loading="loading"
      :error="error && !match ? error : undefined"
      skeleton="match-room"
      loading-label="裁判正在布置房间..."
      :stagger="false"
      @retry="load"
    >
      <main v-if="match" class="aa-game-layout">
      <aside class="aa-seat-board">
        <div class="aa-phase-token">
          <component :is="PhaseIcon" :size="18" />
          <div><strong>{{ match.runtime.currentPhaseName }}</strong><span>第 {{ match.runtime.currentRound }} 轮 · {{ displayMode }}</span><small>即将进行：{{ upcomingPhase }}</small></div>
        </div>
        <div class="aa-player-orbit">
          <button v-for="p in participants" :key="p.characterId" type="button" class="aa-seat-card" :class="[{ 'is-speaking': activeSpeakerId === p.characterId, 'is-out': p.alive !== 'alive', 'is-sheriff': sheriffId === p.characterId, 'has-acted': hasActed(p) }, campClass(p)]" @click="cycleGuess(p)">
            <span class="aa-player-avatar" :style="avatarStyle(p)"></span>
            <span class="aa-seat-copy"><strong>{{ p.seatOrder }} · {{ p.characterName }}</strong><small>{{ visibleRoleName(p) }} / {{ campLabel(p) }}</small></span>
            <span v-if="hasActed(p)" class="aa-spoken-mark">已发言</span><i v-if="sheriffId === p.characterId">警</i>
            <span class="aa-player-peek"><b>{{ viewMode === 'god' ? (p.roleName || '未知身份') : visibleRoleName(p) }}</b><p>{{ viewMode === 'god' ? roleSkill(p.roleId) : '玩家视角仅显示公开信息。点击席位可循环标记你的身份猜测。' }}</p><em>{{ aliveLabel(p) }}</em></span>
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
              <div class="aa-talk-meta"><component :is="messageIcon(msg)" :size="13" /><strong>{{ msg.participantName }}</strong><span>{{ messageOrder(msg) }}</span><em v-if="msg.roleLabel">{{ msg.roleLabel }}</em></div>

              <template v-if="msg.kind === 'speech'">
                <div v-if="viewMode === 'god' && thoughtText(msg) && !isSpeechThinking(msg)" class="aa-thought-block" :class="{ open: isThoughtOpen(msg), 'has-emotion': showEmotionTags && msg.streamStatus === 'done' && !!emotionForMessage(msg) }">
                  <button type="button" class="aa-thought-toggle" @click="toggleThought(msg)"><Brain :size="12" />{{ isThoughtOpen(msg) ? '收起思考' : '展开思考' }}</button>
                  <span v-if="showEmotionTags && !isSpeechStreaming(msg) && emotionForMessage(msg)" class="aa-emotion" :class="emotionForMessage(msg)?.className">
                    <b>{{ emotionForMessage(msg)?.icon }}</b><span>{{ emotionForMessage(msg)?.label }}</span>
                    <span class="aa-emotion-pop"><strong>{{ emotionForMessage(msg)?.label }}</strong><em v-for="tag in emotionForMessage(msg)?.tags" :key="tag">{{ tag }}</em></span>
                  </span>
                  <div v-if="isThoughtOpen(msg)" class="aa-thought-panel"><strong>内心活动</strong><p>{{ thoughtText(msg) }}</p></div>
                </div>
                <div class="aa-speech-wrap">
                  <div class="aa-speech-bubble" :class="{ 'has-thought': viewMode === 'god' && hasThought(msg) && !isSpeechThinking(msg), 'is-thinking': isSpeechThinking(msg), 'is-live': isSpeechLive(msg) }">
                    <div v-if="isSpeechThinking(msg)" class="aa-thinking-inline"><i></i><i></i><i></i><span>正在整理身份视角、公开发言和本轮目标…</span></div>
                    <span v-else class="aa-stream-text">{{ msg.content }}<i v-if="isSpeechLive(msg)" class="aa-live-caret"></i></span>
                  </div>
                </div>
              </template>

              <div v-else-if="msg.kind === 'vote'" class="aa-event-card aa-vote-widget" :class="{ 'is-live': isVoteLive(msg), 'is-tally': isVoteDone(msg) && voteTallyComplete(msg) }">
                <div class="aa-widget-head"><Vote :size="16" /><strong>{{ isVoteLive(msg) ? '投票进行中' : '投票唱票' }}</strong><span>{{ messageOrder(msg) }}</span></div>
                <p>{{ msg.content }}</p>
                <div v-if="isVoteLive(msg)" class="aa-vote-progress"><i :style="{ width: voteProgress + '%' }"></i><span>{{ voteProgress }}%</span></div>
                <div class="aa-vote-bars">
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
      </section>
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

    <MatchRoomEscMenu ref="escMenuRef" :match="match" @updated="load" />
  </div>
</template>

<style scoped>
.aa-game-room { position: relative; height: 100vh; overflow: hidden; color: #17134a; font-family: var(--arena-font-family); background: #eee9ff; }
.aa-game-backdrop { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(251,249,255,.42), rgba(235,226,255,.76)), url('@renderer/assets/home/home-bg-clean.png') center/cover no-repeat; opacity: .96; }
.aa-game-backdrop::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle at 56% 38%, rgba(143,105,255,.18), transparent 32%), radial-gradient(circle at 78% 72%, rgba(255,147,212,.14), transparent 24%); }
.aa-room-drag { -webkit-app-region: drag; } .aa-room-no-drag, button, details { -webkit-app-region: no-drag; }
.aa-game-topbar { position: relative; z-index: 4; height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 28px; }
.aa-game-brand { display: flex; align-items: center; gap: 11px; min-width: 0; } .aa-game-brand__mark { width: 38px; height: 38px; display: grid; place-items: center; border-radius: 15px; color: #fff; background: linear-gradient(135deg,#8a68ff,#6c5cff); box-shadow: 0 14px 30px rgba(105,91,255,.22); }
.aa-game-title-wrap { display: grid; gap: 4px; } .aa-title-actions { display: flex; align-items: center; gap: 8px; } .aa-game-title-wrap strong { font-size: 19px; line-height: 1; letter-spacing: 0; } .aa-game-room-code, .aa-event-open { display: inline-flex; align-items: center; gap: 5px; width: max-content; border: 0; background: transparent; color: #756e9d; font-size: 12px; cursor: pointer; } .aa-game-room-code em { font-style: normal; color: #7b5cff; } .aa-event-open { width: auto; border: 0; background: rgba(255,255,255,.56); padding: 0 7px; height: 22px; border-radius: 999px; color: #7467a3; cursor: pointer; }
.aa-game-top-pills { display: flex; gap: 8px; align-items: center; } .aa-game-top-pills span, .aa-game-top-pills button { height: 31px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border-radius: 999px; background: rgba(255,255,255,.62); border: 1px solid rgba(132,112,210,.1); color: #342b78; font-size: 12px; font-weight: 650; } .aa-game-top-pills button { cursor: pointer; }
.aa-game-layout { position: relative; z-index: 1; height: calc(100vh - 78px); display: grid; grid-template-columns: clamp(250px, 23vw, 330px) minmax(0, 1fr); gap: 16px; padding: 0 28px 20px; }
.aa-seat-board { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 12px; padding: 14px; border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.64), rgba(248,245,255,.42)); border: 1px solid rgba(137,113,214,.13); box-shadow: 0 22px 58px rgba(73,58,130,.1); backdrop-filter: blur(18px); }
.aa-phase-token { display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 20px; background: linear-gradient(135deg, rgba(135,99,255,.16), rgba(255,255,255,.58)); } .aa-phase-token svg { color: #7458e8; } .aa-phase-token div { display: grid; gap: 3px; } .aa-phase-token strong { font-size: 16px; } .aa-phase-token span, .aa-phase-token small { color: #756e9a; font-size: 12px; } .aa-phase-token small { color: #948cac; }
.aa-player-orbit { min-height: 0; overflow: auto; scrollbar-width: none; display: grid; align-content: start; gap: 8px; padding: 2px; } .aa-player-orbit::-webkit-scrollbar { display: none; }
.aa-seat-card { position: relative; min-width: 0; width: 100%; min-height: 56px; display: grid; grid-template-columns: 38px minmax(0,1fr) auto; align-items: center; gap: 8px; padding: 8px; border-radius: 18px; border: 1px solid rgba(120,101,180,.1); background: rgba(255,255,255,.55); color: inherit; text-align: left; cursor: pointer; transition: transform 180ms ease, border-color 180ms ease, background 180ms ease; } .aa-seat-card:hover { transform: translateX(4px); background: rgba(255,255,255,.82); } .aa-seat-card.is-speaking { transform: translateX(6px); box-shadow: inset 3px 0 0 #7d62ff, 0 14px 30px rgba(102,81,190,.14); } .aa-seat-card.is-out { opacity: .42; filter: grayscale(.55); }
.aa-seat-card.camp-good { border-color: rgba(47,177,120,.22); } .aa-seat-card.camp-wolf { border-color: rgba(218,73,116,.28); } .aa-seat-card.camp-villager { border-color: rgba(73,145,218,.22); } .aa-seat-card.camp-neutral { border-color: rgba(139,110,255,.18); } .aa-seat-card.camp-hidden { border-color: rgba(131,123,164,.16); background: rgba(255,255,255,.48); } .aa-seat-card.camp-guess { border-color: rgba(132,92,255,.26); background: rgba(244,239,255,.72); }
.aa-player-avatar, .aa-talk-avatar { background-size: cover; background-position: center; flex: none; } .aa-player-avatar { width: 38px; height: 38px; border-radius: 14px; } .aa-seat-copy { min-width: 0; display: grid; gap: 3px; } .aa-seat-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; } .aa-seat-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #6f688f; font-size: 11px; }
.aa-seat-card.has-acted { box-shadow: inset 2px 0 0 rgba(125,92,255,.3); } .aa-spoken-mark { position: absolute; right: 34px; top: 7px; padding: 2px 6px; border-radius: 999px; background: rgba(124,92,255,.1); color: #6d54d8; font-size: 10px; font-weight: 800; } .aa-seat-card i { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-style: normal; color: #9b6410; background: #fff1cc; font-size: 11px; font-weight: 900; } .aa-player-peek { position: absolute; left: 44px; top: 48px; z-index: 10; width: 210px; padding: 10px; border-radius: 15px; background: rgba(255,255,255,.96); box-shadow: 0 18px 44px rgba(53,45,110,.18); opacity: 0; pointer-events: none; transform: translateY(-4px); transition: 160ms ease; } .aa-seat-card:hover .aa-player-peek { opacity: 1; transform: translateY(0); } .aa-player-peek p { margin: 5px 0; color: #5a527e; font-size: 12px; } .aa-player-peek em { color: #8a83a6; font-size: 11px; font-style: normal; }
.aa-story-stage { position: relative; min-height: 0; overflow: hidden; display: grid; grid-template-rows: minmax(0,1fr); padding: 16px; border-radius: 32px; background: linear-gradient(145deg, rgba(255,255,255,.5), rgba(246,241,255,.34)); border: 1px solid rgba(137,113,214,.13); box-shadow: 0 24px 70px rgba(73,58,130,.12); backdrop-filter: blur(18px); }
.aa-stage-glow { position: absolute; inset: 12px; border-radius: 28px; pointer-events: none; background: radial-gradient(circle at 50% 0%, rgba(143,105,255,.14), transparent 36%); }
.aa-message-stream { position: relative; z-index: 1; min-height: 0; overflow: auto; scrollbar-width: none; padding: 18px max(30px, 6vw) 52px; display: flex; flex-direction: column; gap: 16px; align-items: stretch; } .aa-message-stream::-webkit-scrollbar { display: none; } .aa-empty-talk { margin: auto; display: grid; place-items: center; gap: 8px; color: #746d98; font-size: 13px; }
.aa-talk-row { display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 10px; width: min(940px, 96%); max-width: 100%; animation: messageIn 260ms ease both; } .aa-talk-row.is-speech { margin-left: 0; } .aa-talk-row.is-event, .aa-talk-row.is-system, .aa-talk-row.is-judge, .aa-talk-row.is-warning, .aa-talk-row.is-vote, .aa-talk-row.is-resource { width: min(820px, 92%); margin-inline: auto; }
.aa-talk-avatar { width: 44px; height: 44px; border-radius: 16px; box-shadow: 0 8px 18px rgba(56,46,120,.12); } .aa-talk-row.is-referee .aa-talk-avatar { border: 1px solid rgba(132,92,255,.2); box-shadow: 0 10px 24px rgba(110,83,210,.16); }
.aa-talk-shell { min-width: 0; display: grid; gap: 6px; width: 100%; } .aa-talk-meta { display: flex; align-items: center; gap: 6px; color: #867da5; font-size: 11px; } .aa-talk-meta strong { color: #211950; font-size: 13px; } .aa-talk-meta span, .aa-talk-meta em { padding: 2px 7px; border-radius: 999px; background: rgba(125,92,255,.09); color: #6d54d4; font-style: normal; }
.aa-speech-wrap { display: block; width: 100%; max-width: min(760px, 100%); }
.aa-speech-bubble { position: relative; width: 100%; max-width: min(760px, 100%); padding: 13px 15px 12px; border-radius: 20px 20px 20px 8px; background: rgba(255,255,255,.82); color: #2e2855; text-align: left; box-shadow: 0 16px 38px rgba(68,55,130,.1); overflow: hidden; transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease; } .aa-stream-text { display: block; line-height: 1.72; font-size: 14px; white-space: pre-wrap; } .aa-speech-bubble.is-live .aa-live-caret { display: inline-block; width: 7px; height: 1em; margin-left: 2px; vertical-align: -2px; border-right: 2px solid rgba(125,92,255,.5); animation: caretBlink 760ms steps(1) infinite; } .aa-speech-bubble.is-thinking { color: #766d99; background: rgba(255,255,255,.66); }
.aa-thought-block { width: min(760px, 100%); display: grid; grid-template-columns: 94px 94px; justify-content: start; align-items: start; gap: 7px 8px; } .aa-thought-block:not(.has-emotion) { grid-template-columns: 94px; } .aa-thought-toggle, .aa-emotion { width: 94px; box-sizing: border-box; justify-content: center; } .aa-thought-toggle { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 9px; border: 0; border-radius: 999px; background: rgba(125,92,255,.09); color: #6d54d8; font-size: 11px; font-weight: 760; cursor: pointer; } .aa-thought-toggle:hover { background: rgba(125,92,255,.16); transform: translateY(-1px); } .aa-thought-panel { grid-column: 1 / -1; width: min(740px, 100%); padding: 11px 12px; border-radius: 15px; background: linear-gradient(135deg, rgba(68,48,130,.08), rgba(255,255,255,.6)); border: 1px solid rgba(125,92,255,.13); animation: thoughtOpen 180ms ease both; } .aa-thought-panel strong { display: block; color: #5f4cdf; font-size: 12px; margin-bottom: 4px; } .aa-thought-panel p { margin: 0; color: #514a72; font-size: 12px; line-height: 1.62; white-space: pre-wrap; }
.aa-emotion { position: relative; height: 24px; display: inline-flex; align-items: center; gap: 5px; padding: 0 8px; border-radius: 999px; background: rgba(125,92,255,.09); color: #6655c8; font-size: 11px; font-weight: 760; cursor: default; white-space: nowrap; } .aa-emotion b { display: inline-grid; place-items: center; width: 14px; height: 14px; border-radius: 50%; background: #fff; color: #7a5cff; flex: none; font-size: 10px; } .aa-emotion > span:not(.aa-emotion-pop) { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-size: 11px; } .aa-emotion-pop { position: absolute; left: 0; top: calc(100% + 8px); z-index: 12; min-width: 210px; max-width: 260px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px; border-radius: 15px; background: rgba(255,255,255,.96); border: 1px solid rgba(126,99,255,.12); box-shadow: 0 18px 42px rgba(53,45,110,.18); color: #6655c8; opacity: 0; pointer-events: none; transform: translateY(-4px); transition: opacity 160ms ease, transform 160ms ease; } .aa-emotion:hover .aa-emotion-pop { opacity: 1; transform: translateY(0); } .aa-emotion-pop strong { flex: 1 0 100%; color: #211950; font-size: 12px; } .aa-emotion-pop em { padding: 3px 6px; border-radius: 999px; background: rgba(125,92,255,.09); color: #8176a8; font-style: normal; font-size: 10px; font-weight: 700; } .aa-emotion.emotion-风险追踪 { background: rgba(255,120,161,.12); color: #bf3e72; } .aa-emotion.emotion-节奏推进 { background: rgba(125,92,255,.13); color: #6047d8; } .aa-emotion.emotion-阵营站边 { background: rgba(66,195,142,.13); color: #248962; }
.aa-thinking-inline, .aa-thinking-bubble { width: 100%; display: flex; align-items: center; gap: 6px; color: #766d99; font-size: 13px; } .aa-thinking-inline i, .aa-thinking-bubble i { width: 7px; height: 7px; border-radius: 50%; background: #8a68ff; animation: thinkingPulse 900ms ease-in-out infinite; flex: none; } .aa-thinking-inline i:nth-child(2), .aa-thinking-bubble i:nth-child(2) { animation-delay: 120ms; } .aa-thinking-inline i:nth-child(3), .aa-thinking-bubble i:nth-child(3) { animation-delay: 240ms; }
.aa-judge-note { width: min(680px, 100%); display: grid; grid-template-columns: 18px auto minmax(0,1fr) auto; align-items: center; gap: 7px; padding: 9px 11px; border-radius: 16px; background: rgba(255,247,235,.78); border: 1px solid rgba(224,163,74,.2); color: #6b5277; font-size: 12px; } .aa-judge-note b { color: #44345d; } .aa-judge-note p { margin: 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .aa-judge-note span { color: #9a8ca8; font-size: 11px; }
.aa-event-card { width: 100%; box-sizing: border-box; padding: 14px; border-radius: 21px; background: rgba(255,255,255,.66); border: 1px solid rgba(127,105,200,.12); box-shadow: 0 14px 34px rgba(68,55,130,.08); } .aa-widget-head { display: flex; align-items: center; gap: 8px; color: #6f668f; font-size: 12px; } .aa-widget-head strong { color: #211950; font-size: 14px; } .aa-widget-head span { margin-left: auto; color: #8b84aa; } .aa-event-card p { margin: 9px 0 0; color: #514974; line-height: 1.58; font-size: 13px; }
.aa-vote-widget { background: linear-gradient(135deg, rgba(244,240,255,.88), rgba(255,255,255,.7)); } .aa-vote-widget.is-tally .aa-vote-line.is-leader i { box-shadow: 0 0 0 2px rgba(125,92,255,.25); animation: tallyPulse 900ms ease-in-out 2; } .aa-vote-progress { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 8px; align-items: center; margin-top: 10px; font-size: 11px; color: #7a7199; } .aa-vote-progress i { display: block; height: 6px; border-radius: 999px; background: linear-gradient(90deg,#7d62ff,#d178ff); transition: width 260ms ease; } .aa-vote-bars { display: grid; gap: 8px; margin-top: 12px; } .aa-vote-line { display: grid; grid-template-columns: 70px minmax(0,1fr) 52px; gap: 8px; align-items: center; font-size: 12px; color: #5b527d; animation: messageIn 220ms ease both; } .aa-vote-line i { height: 8px; min-width: 18px; max-width: 100%; border-radius: 999px; background: linear-gradient(90deg,#7d62ff,#d178ff); transition: width 320ms ease; } .aa-vote-line small { grid-column: 2 / -1; color: #938bac; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .aa-vote-feed { list-style: none; margin: 10px 0 0; padding: 0; display: grid; gap: 4px; max-height: 120px; overflow: auto; } .aa-vote-feed li { padding: 4px 8px; border-radius: 10px; background: rgba(125,92,255,.06); color: #6f668f; font-size: 11px; animation: messageIn 180ms ease both; }
.aa-skill-widget { background: linear-gradient(135deg, rgba(238,244,255,.84), rgba(255,255,255,.68)); } .aa-event-warning { background: rgba(255,246,232,.86); border-color: rgba(235,166,65,.25); }
.aa-info-overlay { position: fixed; inset: 0; z-index: 20; display: grid; place-items: center; background: rgba(25,18,64,.26); backdrop-filter: blur(10px); } .aa-info-dialog, .aa-thought-dialog, .aa-events-dialog { position: relative; width: min(680px, calc(100vw - 80px)); max-height: min(620px, calc(100vh - 80px)); overflow: auto; padding: 22px; border-radius: 26px; background: rgba(255,255,255,.94); box-shadow: 0 34px 90px rgba(37,28,100,.28); } .aa-thought-dialog { width: min(520px, calc(100vw - 80px)); } .aa-events-dialog { width: min(620px, calc(100vw - 80px)); } .aa-dialog-kicker { display: inline-flex; align-items: center; gap: 6px; color: #7a5cff; font-size: 12px; font-weight: 800; } .aa-thought-dialog h2, .aa-info-dialog h2 { margin: 10px 0 14px; font-size: 22px; } .aa-thought-dialog p { color: #4f4771; line-height: 1.7; }
.aa-event-list { display: grid; gap: 8px; max-height: min(460px, calc(100vh - 220px)); overflow: auto; scrollbar-width: none; } .aa-event-list::-webkit-scrollbar { display: none; } .aa-event-list article { display: grid; grid-template-columns: 28px minmax(0,1fr); gap: 10px; padding: 11px; border-radius: 15px; background: rgba(246,243,255,.72); } .aa-event-list i { font-style: normal; } .aa-event-list time { color: #8b84a8; font-size: 11px; } .aa-event-list p { margin: 3px 0 0; color: #504873; font-size: 12px; line-height: 1.55; } .aa-event-empty { color: #8b84a8; } .aa-info-close { position: absolute; right: 16px; top: 14px; border: 0; background: transparent; font-size: 26px; color: #6f668f; cursor: pointer; } .aa-resource-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; } .aa-resource-grid span { display: grid; gap: 6px; padding: 13px; border-radius: 16px; background: rgba(246,243,255,.76); color: #7b739e; font-size: 12px; } .aa-resource-grid b { color: #251f5d; font-size: 16px; } .aa-info-note { color: #6f688f; line-height: 1.6; }
.aa-new-message { position: absolute; right: 28px; bottom: 26px; z-index: 5; height: 34px; display: inline-flex; align-items: center; gap: 7px; padding: 0 13px; border: 0; border-radius: 999px; color: #fff; background: linear-gradient(135deg,#8d6bff,#6a5cff); box-shadow: 0 16px 34px rgba(92,78,230,.26); font-size: 12px; font-weight: 800; cursor: pointer; animation: messageIn 180ms ease both; } .aa-new-message:hover { transform: translateY(-2px); }
.aa-game-state { position: relative; z-index: 2; height: calc(100vh - 80px); display: flex; align-items: center; justify-content: center; gap: 10px; color: #5f5690; font-size: 16px; }
.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } } @keyframes messageIn { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } } @keyframes caretBlink { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } } @keyframes thoughtOpen { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } } @keyframes thinkingPulse { 0%, 80%, 100% { opacity: .35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } } @keyframes tallyPulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.15); } }
@media (max-width: 1320px) { .aa-game-layout { grid-template-columns: 255px minmax(0, 1fr); padding-inline: 20px; } .aa-message-stream { padding-inline: 28px; } .aa-game-topbar { padding-inline: 20px; } .aa-thought-block:not(.has-emotion) { grid-template-columns: 94px; } .aa-thought-block.has-emotion { grid-template-columns: 94px 94px; } }
</style>
