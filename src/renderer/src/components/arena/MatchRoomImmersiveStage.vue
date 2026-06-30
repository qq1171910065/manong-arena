<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertTriangle,
  Bot,
  Brain,
  Crown,
  Loader2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Vote,
} from 'lucide-vue-next'
import MatchSpeechContent from '@renderer/components/arena/MatchSpeechContent.vue'
import type { ImmersiveSpeechPhase } from '@renderer/composables/useImmersiveSpeechCadence'
import { characterAvatarByName } from '@renderer/data/arena-visual-assets'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'
import {
  emotionForMessage,
  focusStageKind,
  isSpeechLive,
  isSpeechStreaming,
  isSpeechThinking,
  isVoteDone,
  isVoteLive,
  isVoteTallyMessage,
  participantExpressionUrl,
  isPlayerSelfSeat,
  participantCampClass,
  pickFocusMessage,
  resolveSpeechExpressionId,
  speechDisplayText,
  thoughtText,
  visibleRoleNameForParticipant,
  voteSummaryForMessage,
} from '@renderer/services/arena/match-room-presenters'
import type { Character, Match, MatchMessage, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'
import type { SpeechDisplayConfig } from '@shared/arena/speech-display'

const props = defineProps<{
  match: Match
  participants: MatchParticipant[]
  visibleMessages: MatchMessage[]
  votes: MatchVoteRecord[]
  activeSpeakerId: string | null
  ttsSpeakingId: string | null
  sheriffId: string | null
  viewMode: 'god' | 'player'
  showEmotionTags: boolean
  speechDisplayConfig: SpeechDisplayConfig | null
  characterCache: Map<string, Character>
  guessedRoles: Record<string, string>
  selfPlayerId: string | null
  voteEligibleCount: number
  voteProgress: number
  streamTick: number
  speechPhase: ImmersiveSpeechPhase
  speechProgress: number
}>()
const emit = defineEmits<{ cycleGuess: [MatchParticipant] }>()

const focusMessage = computed(() => pickFocusMessage(props.visibleMessages, props.activeSpeakerId))

const focusSpeechText = computed(() => {
  void props.streamTick
  const msg = focusMessage.value
  if (!msg || msg.kind !== 'speech') return ''
  return speechDisplayText(msg)
})

const focusThoughtText = computed(() => {
  void props.streamTick
  const msg = focusMessage.value
  if (!msg || msg.kind !== 'speech') return ''
  return thoughtText(msg)
})

const focusSpeechStreaming = computed(() => {
  void props.streamTick
  const msg = focusMessage.value
  return Boolean(msg && isSpeechStreaming(msg))
})

const focusSpeechLive = computed(() => {
  void props.streamTick
  const msg = focusMessage.value
  return Boolean(msg && isSpeechLive(msg))
})

const focusSpeechThinking = computed(() => {
  void props.streamTick
  const msg = focusMessage.value
  return Boolean(msg && isSpeechThinking(msg))
})

const showThoughtPanel = computed(
  () => props.viewMode === 'god' && Boolean(focusThoughtText.value || (focusSpeechThinking.value && props.speechPhase === 'thinking'))
)

function progressRingStyle(progress: number) {
  const radius = 46
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - Math.max(0, Math.min(1, progress)))
  return {
    strokeDasharray: `${circumference} ${circumference}`,
    strokeDashoffset: String(offset),
  }
}

function seatProgress(p: MatchParticipant): number {
  if (p.characterId !== props.activeSpeakerId) return 0
  if (props.speechPhase === 'speaking') return props.speechProgress
  if (props.speechPhase === 'tts' || props.speechPhase === 'cooldown') return 1
  return 0
}

function seatPhaseClass(p: MatchParticipant): string {
  if (p.characterId !== props.activeSpeakerId) return ''
  if (props.speechPhase === 'thinking') return 'is-thinking-phase'
  if (props.speechPhase === 'speaking') return 'is-speaking-phase'
  if (props.speechPhase === 'tts') return 'is-tts-phase'
  if (props.speechPhase === 'cooldown') return 'is-cooldown-phase'
  return ''
}
const focusKind = computed(() => focusStageKind(focusMessage.value))
const focusParticipant = computed(() =>
  focusMessage.value?.participantId && focusMessage.value.participantId !== 'judge'
    ? props.participants.find((p) => p.characterId === focusMessage.value?.participantId) || null
    : null
)

const stageStatusLabel = computed(() => {
  if (props.speechPhase === 'thinking') return '思考中'
  if (props.speechPhase === 'speaking') return '发言中'
  if (props.speechPhase === 'tts') return '播报中'
  if (props.speechPhase === 'cooldown') return '发言结束'
  if (props.ttsSpeakingId && focusParticipant.value?.characterId === props.ttsSpeakingId) return '播报中'
  return ''
})

const focusCharacter = computed(() => {
  const id = focusParticipant.value?.characterId
  return id ? props.characterCache.get(id) || null : null
})
const focusExpressionId = computed(() => resolveSpeechExpressionId(focusMessage.value))
const focusEmotion = computed(() =>
  focusMessage.value && props.showEmotionTags ? emotionForMessage(focusMessage.value) : null
)
const focusPortraitUrl = computed(() => {
  if (focusKind.value === 'judge' || focusKind.value === 'vote' || focusKind.value === 'event') {
    return arenaHomeAssets.judgeAvatar
  }
  if (focusParticipant.value) {
    return participantExpressionUrl(focusCharacter.value, focusParticipant.value, focusExpressionId.value)
  }
  return arenaHomeAssets.judgeAvatar
})

const orderedParticipants = computed(() => [...props.participants].sort((a, b) => a.seatOrder - b.seatOrder))

const leftSeats = computed(() => {
  const list = orderedParticipants.value
  const mid = Math.ceil(list.length / 2)
  return list.slice(0, mid)
})

const rightSeats = computed(() => {
  const list = orderedParticipants.value
  const mid = Math.ceil(list.length / 2)
  return list.slice(mid)
})

function isSeatFocused(p: MatchParticipant): boolean {
  if (props.activeSpeakerId === p.characterId) return true
  if (focusParticipant.value?.characterId === p.characterId) return true
  return false
}

function avatarStyle(p: MatchParticipant) {
  return {
    backgroundImage: `url(${characterAvatarByName(p.characterName, p.seatOrder, p.modelId, p.avatarUrl, p.characterId)})`,
    backgroundColor: p.accentColor,
  }
}

function visibleRoleName(p: MatchParticipant): string {
  return visibleRoleNameForParticipant(p, props.viewMode, props.guessedRoles, props.selfPlayerId)
}

function campClass(p: MatchParticipant): string {
  return participantCampClass(p, props.viewMode, props.guessedRoles, props.selfPlayerId)
}

function isSelfSeat(p: MatchParticipant): boolean {
  return isPlayerSelfSeat(p, props.selfPlayerId, props.viewMode)
}

const focusTtsSpeaking = computed(
  () => Boolean(focusParticipant.value && props.ttsSpeakingId === focusParticipant.value.characterId)
)

function playerGuessLabel(p: MatchParticipant): string | null {
  if (props.viewMode !== 'player') return null
  return props.guessedRoles[p.characterId] || null
}

function onSeatContextMenu(event: MouseEvent, p: MatchParticipant) {
  if (props.viewMode !== 'player') return
  event.preventDefault()
  emit('cycleGuess', p)
}

function focusTitle(msg: MatchMessage | null): string {
  if (!msg) return '等待开始'
  if (msg.kind === 'vote') return isVoteLive(msg) ? '投票进行中' : '投票唱票'
  if (msg.kind === 'judge') return '裁判裁定'
  if (msg.kind === 'warning') return '裁判提醒'
  if (msg.kind === 'resource') return '技能结算'
  if (msg.kind === 'system' || msg.kind === 'event') return '公开事件'
  return msg.participantName || '发言'
}

function voteSummary(msg: MatchMessage) {
  return voteSummaryForMessage(msg, props.votes, props.sheriffId)
}

function formatVoteCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1)
}
</script>

<template>
  <section class="imm-stage" aria-label="沉浸对局舞台">
    <div class="imm-phase-chip">
      <Crown v-if="sheriffId" :size="13" />
      <span>{{ match.runtime.currentPhaseName }} · 第 {{ match.runtime.currentRound }} 轮</span>
      <small v-if="viewMode === 'player'" class="imm-phase-chip__hint">右键席位标记身份</small>
    </div>

    <div class="imm-layout">
      <aside class="imm-seats imm-seats--left" aria-label="左侧席位">
        <button
          v-for="p in leftSeats"
          :key="p.characterId"
          type="button"
          class="imm-seat"
          :class="[
            campClass(p),
            seatPhaseClass(p),
            {
              'is-speaking': activeSpeakerId === p.characterId,
              'is-focus': isSeatFocused(p),
              'is-tts-speaking': ttsSpeakingId === p.characterId,
              'is-self': isSelfSeat(p),
              'is-out': p.alive !== 'alive',
              'is-sheriff': sheriffId === p.characterId,
              'has-guess': Boolean(playerGuessLabel(p)),
            },
          ]"
          :title="viewMode === 'player' ? '右键循环标记身份' : undefined"
          @contextmenu="onSeatContextMenu($event, p)"
        >
          <span class="imm-seat__avatar-wrap">
            <svg v-if="seatProgress(p) > 0 || speechPhase === 'thinking' && activeSpeakerId === p.characterId" class="imm-seat__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="imm-seat__ring-track" cx="50" cy="50" r="46" />
              <circle
                class="imm-seat__ring-bar"
                :class="{
                  'is-frozen': speechPhase === 'tts' || speechPhase === 'cooldown',
                  'is-thinking': speechPhase === 'thinking' && activeSpeakerId === p.characterId,
                }"
                cx="50"
                cy="50"
                r="46"
                :style="progressRingStyle(seatProgress(p))"
              />
            </svg>
            <span class="imm-seat__avatar" :style="avatarStyle(p)">
              <i v-if="ttsSpeakingId === p.characterId" class="imm-tts-waves" aria-hidden="true"><i></i><i></i><i></i></i>
            </span>
          </span>
          <span class="imm-seat__copy">
            <strong>{{ p.seatOrder }} · {{ p.characterName }}</strong>
            <small>{{ visibleRoleName(p) }}</small>
          </span>
          <span v-if="playerGuessLabel(p)" class="imm-seat__guess">标记 · {{ playerGuessLabel(p) }}</span>
          <span v-if="isSelfSeat(p)" class="imm-seat__self">我</span>
          <em v-if="activeSpeakerId === p.characterId && stageStatusLabel" class="imm-seat__mark">{{ stageStatusLabel }}</em>
          <em v-else-if="activeSpeakerId === p.characterId || isSeatFocused(p)" class="imm-seat__mark">发言中</em>
          <i v-if="sheriffId === p.characterId" class="imm-seat__badge">警</i>
        </button>
      </aside>

      <div class="imm-center" :class="`imm-center--${focusKind}`">
        <div class="imm-center__portrait-wrap">
          <svg
            v-if="focusParticipant && (speechProgress > 0 || speechPhase === 'thinking')"
            class="imm-center__ring"
            viewBox="0 0 100 100"
            aria-hidden="true"
          >
            <circle class="imm-center__ring-track" cx="50" cy="50" r="46" />
            <circle
              class="imm-center__ring-bar"
              :class="{
                'is-thinking': speechPhase === 'thinking',
                'is-frozen': speechPhase === 'tts' || speechPhase === 'cooldown',
              }"
              cx="50"
              cy="50"
              r="46"
              :style="progressRingStyle(speechPhase === 'thinking' ? 0 : speechProgress)"
            />
          </svg>
          <img
            class="imm-center__portrait"
            :class="{
              'is-live': focusSpeechLive,
              'is-thinking': focusSpeechThinking || speechPhase === 'thinking',
              'is-judge': focusKind === 'judge' || focusKind === 'vote' || focusKind === 'event',
            }"
            :src="focusPortraitUrl"
            :alt="focusTitle(focusMessage)"
          />
          <span v-if="stageStatusLabel" class="imm-center__phase-tag">{{ stageStatusLabel }}</span>
          <span v-if="focusParticipant && focusEmotion && !focusSpeechStreaming" class="imm-center__emotion">
            {{ focusEmotion.label }}
          </span>
        </div>

        <div class="imm-center__card">
          <header class="imm-center__head">
            <component
              :is="focusKind === 'vote' ? Vote : focusKind === 'judge' ? ShieldCheck : focusKind === 'event' ? Sparkles : MessageCircle"
              :size="16"
            />
            <strong>{{ focusTitle(focusMessage) }}</strong>
            <span v-if="focusParticipant">{{ visibleRoleName(focusParticipant) }}</span>
            <span v-else-if="focusKind === 'judge'" class="imm-center__judge-tag">裁判</span>
          </header>

          <div v-if="!focusMessage" class="imm-center__empty">
            <Bot :size="22" />
            <p>公开频道还很安静，发言与裁判公告会显示在舞台中央。</p>
          </div>

          <template v-else-if="focusMessage.kind === 'speech'">
            <div v-if="showThoughtPanel" class="imm-thought-panel">
              <div class="imm-thought-panel__head">
                <Brain :size="14" />
                <strong>思考过程</strong>
                <span v-if="focusSpeechThinking && speechPhase === 'thinking'" class="imm-thought-panel__live">思考中</span>
              </div>
              <div class="imm-thought-panel__body">
                <p v-if="focusThoughtText">
                  {{ focusThoughtText }}<i v-if="focusSpeechThinking && speechPhase === 'thinking'" class="imm-live-caret" />
                </p>
                <p v-else class="imm-thought-panel__placeholder">
                  <Loader2 :size="14" class="spin" /><span>正在整理思路…</span>
                </p>
              </div>
            </div>

            <div class="imm-speech-panel" :class="{ 'is-live': focusSpeechLive, 'is-thinking': focusSpeechThinking && !focusSpeechText, 'is-tts-speaking': focusTtsSpeaking }">
              <div class="imm-speech-panel__head">
                <MessageCircle :size="14" />
                <strong>公开发言</strong>
                <span v-if="focusTtsSpeaking" class="imm-speech-panel__tts" aria-hidden="true"><i></i><i></i><i></i></span>
              </div>
              <div class="imm-speech-panel__body">
                <div v-if="focusSpeechThinking && !focusSpeechText" class="imm-speech-panel__waiting">
                  <span class="imm-dots" aria-hidden="true"><i></i><i></i><i></i></span>
                  <span>思考中，尚未开始公开发言</span>
                </div>
                <template v-else>
                  <MatchSpeechContent
                    class="imm-speech-panel__text"
                    :text="focusSpeechText"
                    :streaming="focusSpeechLive"
                    :config="speechDisplayConfig"
                    :participants="participants"
                  />
                  <i v-if="focusSpeechLive" class="imm-live-caret" />
                </template>
              </div>
            </div>
          </template>

          <div v-else-if="isVoteTallyMessage(focusMessage)" class="imm-vote">
            <p>{{ focusMessage.content }}</p>
            <div v-if="isVoteLive(focusMessage)" class="imm-vote__progress">
              <i :style="{ width: voteProgress + '%' }"></i><span>{{ voteProgress }}%</span>
            </div>
            <div v-if="isVoteDone(focusMessage)" class="imm-vote__lines">
              <div v-for="(item, index) in voteSummary(focusMessage)" :key="item.name + index" class="imm-vote__line">
                <span>{{ item.name }}</span><b>{{ formatVoteCount(item.count) }}票</b>
              </div>
            </div>
          </div>

          <div v-else-if="focusMessage.kind === 'warning'" class="imm-judge imm-judge--warn">
            <AlertTriangle :size="16" /><p>{{ focusMessage.content }}</p>
          </div>

          <div v-else class="imm-judge">
            <p>{{ focusMessage.content }}</p>
          </div>
        </div>
      </div>

      <aside class="imm-seats imm-seats--right" aria-label="右侧席位">
        <button
          v-for="p in rightSeats"
          :key="p.characterId"
          type="button"
          class="imm-seat"
          :class="[
            campClass(p),
            seatPhaseClass(p),
            {
              'is-speaking': activeSpeakerId === p.characterId,
              'is-focus': isSeatFocused(p),
              'is-tts-speaking': ttsSpeakingId === p.characterId,
              'is-self': isSelfSeat(p),
              'is-out': p.alive !== 'alive',
              'is-sheriff': sheriffId === p.characterId,
              'has-guess': Boolean(playerGuessLabel(p)),
            },
          ]"
          :title="viewMode === 'player' ? '右键循环标记身份' : undefined"
          @contextmenu="onSeatContextMenu($event, p)"
        >
          <span class="imm-seat__avatar-wrap">
            <svg v-if="seatProgress(p) > 0 || speechPhase === 'thinking' && activeSpeakerId === p.characterId" class="imm-seat__ring" viewBox="0 0 100 100" aria-hidden="true">
              <circle class="imm-seat__ring-track" cx="50" cy="50" r="46" />
              <circle
                class="imm-seat__ring-bar"
                :class="{
                  'is-frozen': speechPhase === 'tts' || speechPhase === 'cooldown',
                  'is-thinking': speechPhase === 'thinking' && activeSpeakerId === p.characterId,
                }"
                cx="50"
                cy="50"
                r="46"
                :style="progressRingStyle(seatProgress(p))"
              />
            </svg>
            <span class="imm-seat__avatar" :style="avatarStyle(p)">
              <i v-if="ttsSpeakingId === p.characterId" class="imm-tts-waves" aria-hidden="true"><i></i><i></i><i></i></i>
            </span>
          </span>
          <span class="imm-seat__copy">
            <strong>{{ p.seatOrder }} · {{ p.characterName }}</strong>
            <small>{{ visibleRoleName(p) }}</small>
          </span>
          <span v-if="playerGuessLabel(p)" class="imm-seat__guess">标记 · {{ playerGuessLabel(p) }}</span>
          <span v-if="isSelfSeat(p)" class="imm-seat__self">我</span>
          <em v-if="activeSpeakerId === p.characterId && stageStatusLabel" class="imm-seat__mark">{{ stageStatusLabel }}</em>
          <em v-else-if="activeSpeakerId === p.characterId || isSeatFocused(p)" class="imm-seat__mark">发言中</em>
          <i v-if="sheriffId === p.characterId" class="imm-seat__badge">警</i>
        </button>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.imm-stage {
  position: relative;
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 12px 14px;
}

.imm-phase-chip {
  position: relative;
  z-index: 2;
  align-self: center;
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(126, 99, 255, 0.14);
  color: #4a3f8f;
  font-size: 12px;
  font-weight: 700;
}

.imm-phase-chip__hint {
  padding: 2px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(141, 107, 255, 0.16), rgba(91, 88, 247, 0.12));
  color: #6d54d8;
  font-size: 10px;
  font-weight: 800;
}

.imm-layout {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: grid;
  grid-template-columns: minmax(132px, 190px) minmax(320px, 1fr) minmax(132px, 190px);
  gap: 14px 18px;
  align-items: stretch;
}

.imm-seats {
  min-height: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  overflow-y: auto;
  scrollbar-width: none;
  padding: 4px 2px;
}

.imm-seats::-webkit-scrollbar {
  display: none;
}

.imm-seat {
  position: relative;
  width: 100%;
  min-height: 62px;
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid rgba(120, 101, 180, 0.12);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.52);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease, box-shadow 180ms ease;
}

.imm-seats--left .imm-seat:hover {
  transform: translateX(3px);
  background: rgba(255, 255, 255, 0.78);
}

.imm-seats--right .imm-seat:hover {
  transform: translateX(-3px);
  background: rgba(255, 255, 255, 0.78);
}

.imm-seat__avatar-wrap {
  position: relative;
  width: 54px;
  height: 54px;
  flex: none;
}

.imm-seat__ring {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  transform: rotate(-90deg);
  pointer-events: none;
}

.imm-seat__ring-track,
.imm-center__ring-track {
  fill: none;
  stroke: rgba(125, 92, 255, 0.12);
  stroke-width: 4;
}

.imm-seat__ring-bar,
.imm-center__ring-bar {
  fill: none;
  stroke: #7d62ff;
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke-dashoffset 120ms linear;
}

.imm-seat__ring-bar.is-frozen,
.imm-center__ring-bar.is-frozen {
  stroke: #62b8ff;
}

.imm-center__ring-bar.is-thinking {
  stroke: rgba(125, 92, 255, 0.28);
  animation: immRingPulse 1.4s ease-in-out infinite;
}

.imm-seat__avatar {
  position: relative;
  width: 54px;
  height: 54px;
  border-radius: 18px;
  background-size: cover;
  background-position: center;
  border: 2px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 8px 18px rgba(56, 46, 120, 0.14);
}

.imm-seat__copy {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.imm-seat__copy strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #211950;
}

.imm-seat__copy small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #6f688f;
  font-size: 10px;
}

.imm-seat__mark {
  position: absolute;
  top: 6px;
  right: 8px;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(124, 92, 255, 0.12);
  color: #6d54d8;
  font-size: 9px;
  font-style: normal;
  font-weight: 800;
}

.imm-seat__badge {
  position: absolute;
  left: 44px;
  top: 4px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  color: #9b6410;
  background: #fff1cc;
}

.imm-seat.camp-good { border-color: rgba(47, 177, 120, 0.22); }
.imm-seat.camp-wolf { border-color: rgba(218, 73, 116, 0.28); }
.imm-seat.camp-villager { border-color: rgba(73, 145, 218, 0.22); }
.imm-seat.camp-neutral { border-color: rgba(139, 110, 255, 0.18); }
.imm-seat.camp-hidden { border-color: rgba(131, 123, 164, 0.16); background: rgba(255, 255, 255, 0.44); }
.imm-seat.camp-guess {
  border-color: rgba(124, 92, 255, 0.52);
  background: linear-gradient(135deg, rgba(244, 239, 255, 0.94), rgba(255, 248, 230, 0.82));
  box-shadow: inset 0 0 0 1px rgba(124, 92, 255, 0.18), 0 10px 24px rgba(102, 81, 190, 0.12);
}

.imm-seat.has-guess {
  padding-bottom: 24px;
}

.imm-seat__guess {
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: 5px;
  z-index: 2;
  padding: 3px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, #8d6bff, #5b58f7);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-align: center;
  box-shadow: 0 6px 16px rgba(93, 88, 247, 0.38);
  pointer-events: none;
}

.imm-seat.is-speaking,
.imm-seat.is-focus {
  background: rgba(255, 255, 255, 0.9);
  border-color: rgba(125, 92, 255, 0.34);
  box-shadow: 0 14px 30px rgba(102, 81, 190, 0.16);
}

.imm-seats--left .imm-seat.is-speaking,
.imm-seats--left .imm-seat.is-focus {
  box-shadow: inset 3px 0 0 #7d62ff, 0 14px 30px rgba(102, 81, 190, 0.16);
}

.imm-seats--right .imm-seat.is-speaking,
.imm-seats--right .imm-seat.is-focus {
  box-shadow: inset -3px 0 0 #7d62ff, 0 14px 30px rgba(102, 81, 190, 0.16);
}

.imm-seat.is-speaking .imm-seat__avatar,
.imm-seat.is-focus .imm-seat__avatar {
  box-shadow: 0 0 0 2px rgba(125, 92, 255, 0.55), 0 0 18px rgba(125, 92, 255, 0.28);
}

.imm-seat.is-tts-speaking .imm-seat__avatar {
  animation: immAvatarGlow 1.15s ease-in-out infinite;
}

.imm-seat.is-self {
  border-color: rgba(255, 147, 212, 0.32);
  background: linear-gradient(135deg, rgba(255, 248, 252, 0.88), rgba(244, 238, 255, 0.72));
}

.imm-seat__self {
  position: absolute;
  left: 6px;
  top: 4px;
  width: 18px;
  height: 18px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  font-style: normal;
  font-size: 10px;
  font-weight: 900;
  color: #9b3fd0;
  background: linear-gradient(135deg, rgba(255, 147, 212, 0.32), rgba(124, 92, 255, 0.18));
  box-shadow: 0 4px 10px rgba(180, 92, 200, 0.18);
}

.imm-seat.is-out {
  opacity: 0.38;
  filter: grayscale(0.55);
}

.imm-tts-waves {
  position: absolute;
  right: -2px;
  bottom: -2px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  padding: 2px 3px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
}

.imm-tts-waves i {
  display: block;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, #9b7bff, #6d54d8);
  animation: immWave 760ms ease-in-out infinite;
}

.imm-tts-waves i:nth-child(1) { height: 4px; }
.imm-tts-waves i:nth-child(2) { height: 7px; animation-delay: 120ms; }
.imm-tts-waves i:nth-child(3) { height: 5px; animation-delay: 240ms; }

.imm-center {
  position: relative;
  z-index: 2;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  justify-items: center;
  gap: 12px;
  padding: 8px 4px;
}

.imm-center::before {
  content: '';
  position: absolute;
  inset: 0 8%;
  border-radius: 28px;
  background: radial-gradient(circle at 50% 28%, rgba(143, 105, 255, 0.12), transparent 72%);
  pointer-events: none;
}

.imm-center__portrait-wrap {
  position: relative;
  z-index: 1;
  padding: 8px;
}

.imm-center__ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
  pointer-events: none;
}

.imm-center__phase-tag {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translate(-50%, -20%);
  padding: 4px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, rgba(141, 107, 255, 0.92), rgba(91, 88, 247, 0.92));
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  box-shadow: 0 10px 24px rgba(93, 88, 247, 0.28);
}

.imm-center__portrait {
  width: min(240px, 100%);
  height: min(300px, 34vh);
  object-fit: cover;
  object-position: center 12%;
  border-radius: 28px;
  border: 2px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 24px 54px rgba(68, 55, 130, 0.18);
  background: rgba(255, 255, 255, 0.42);
  transition: transform 220ms ease, filter 220ms ease, box-shadow 220ms ease;
}

.imm-center__portrait.is-live {
  transform: scale(1.02);
  box-shadow: 0 28px 60px rgba(102, 81, 190, 0.22);
}

.imm-center__portrait.is-thinking {
  filter: saturate(0.92);
}

.imm-center__portrait.is-judge {
  object-fit: contain;
  object-position: center;
  background: linear-gradient(180deg, rgba(244, 240, 255, 0.92), rgba(255, 255, 255, 0.82));
}

.imm-center--judge .imm-center__card,
.imm-center--vote .imm-center__card,
.imm-center--event .imm-center__card {
  border-color: rgba(126, 99, 255, 0.22);
  background: rgba(255, 255, 255, 0.86);
}

.imm-center__emotion {
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #6d54d8;
  font-size: 11px;
  font-weight: 760;
  box-shadow: 0 8px 18px rgba(68, 55, 130, 0.12);
}

.imm-center__card {
  position: relative;
  z-index: 1;
  width: min(620px, 100%);
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
  padding: 14px 16px 16px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(137, 113, 214, 0.14);
  box-shadow: 0 20px 48px rgba(73, 58, 130, 0.12);
}

.imm-center__card::-webkit-scrollbar {
  display: none;
}

.imm-center__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #867da5;
  font-size: 12px;
}

.imm-center__head strong {
  color: #211950;
  font-size: 14px;
}

.imm-center__head span,
.imm-center__judge-tag {
  margin-left: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(125, 92, 255, 0.09);
  color: #6d54d4;
}

.imm-center__judge-tag {
  font-style: normal;
  font-size: 11px;
  font-weight: 700;
}

.imm-center__empty {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 8px 0;
  color: #746d98;
  font-size: 13px;
  text-align: center;
}

.imm-thought-panel {
  margin-bottom: 12px;
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(125, 92, 255, 0.14);
  background: linear-gradient(180deg, rgba(244, 240, 255, 0.94), rgba(248, 245, 255, 0.82));
}

.imm-thought-panel__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(125, 92, 255, 0.08);
  color: #5f4cdf;
  font-size: 11px;
}

.imm-thought-panel__head strong {
  font-size: 12px;
}

.imm-thought-panel__live {
  margin-left: auto;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(125, 92, 255, 0.12);
  color: #6d54d8;
  font-size: 10px;
  font-weight: 800;
}

.imm-thought-panel__body {
  padding: 10px 12px 12px;
}

.imm-thought-panel__body p {
  margin: 0;
  color: #514a72;
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
}

.imm-thought-panel__placeholder {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #766d99;
}

.imm-speech-panel {
  border-radius: 18px;
  overflow: hidden;
  border: 1px solid rgba(120, 101, 180, 0.12);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.72);
}

.imm-speech-panel.is-live {
  border-color: rgba(125, 92, 255, 0.24);
  box-shadow: 0 12px 28px rgba(102, 81, 190, 0.1);
}

.imm-speech-panel.is-tts-speaking {
  border-color: rgba(98, 184, 255, 0.42);
  box-shadow: 0 12px 28px rgba(98, 184, 255, 0.14), inset 0 0 0 1px rgba(98, 184, 255, 0.12);
  animation: immSpeechTtsPulse 1.15s ease-in-out infinite;
}

.imm-speech-panel__tts {
  margin-left: auto;
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
}

.imm-speech-panel__tts i {
  display: block;
  width: 2px;
  border-radius: 999px;
  background: linear-gradient(180deg, #62b8ff, #6d54d8);
  animation: immWave 760ms ease-in-out infinite;
}

.imm-speech-panel__tts i:nth-child(1) { height: 4px; }
.imm-speech-panel__tts i:nth-child(2) { height: 7px; animation-delay: 120ms; }
.imm-speech-panel__tts i:nth-child(3) { height: 5px; animation-delay: 240ms; }

.imm-speech-panel__head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgba(120, 101, 180, 0.08);
  color: #6f688f;
  font-size: 11px;
}

.imm-speech-panel__head strong {
  color: #211950;
  font-size: 12px;
}

.imm-speech-panel__body {
  padding: 12px 14px 14px;
  color: #2e2855;
  font-size: 14px;
  line-height: 1.72;
}

.imm-speech-panel__waiting {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #766d99;
  font-size: 13px;
}

.imm-speech-panel__text :deep(.match-speech-content) {
  white-space: pre-wrap;
}

.imm-dots {
  display: inline-flex;
  gap: 4px;
}

.imm-dots i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #8d6bff;
  animation: immDot 900ms ease-in-out infinite;
}

.imm-dots i:nth-child(2) { animation-delay: 150ms; }
.imm-dots i:nth-child(3) { animation-delay: 300ms; }

.imm-live-caret {
  display: inline-block;
  width: 7px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  border-right: 2px solid rgba(125, 92, 255, 0.5);
  animation: immCaret 760ms steps(1) infinite;
}

.imm-vote p,
.imm-judge p {
  margin: 0;
  color: #514974;
  line-height: 1.62;
  font-size: 13px;
  white-space: pre-wrap;
}

.imm-vote__progress {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  margin-top: 10px;
  font-size: 11px;
  color: #7a7199;
}

.imm-vote__progress i {
  display: block;
  height: 6px;
  border-radius: 999px;
  background: linear-gradient(90deg, #7d62ff, #d178ff);
}

.imm-vote__lines {
  display: grid;
  gap: 6px;
  margin-top: 10px;
}

.imm-vote__line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.58);
  font-size: 12px;
  color: #5b527d;
}

.imm-vote__line b {
  color: #6d54d8;
}

.imm-judge--warn {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  color: #6b5277;
}

.spin { animation: immSpin 1s linear infinite; }

@media (max-width: 1180px) {
  .imm-layout {
    grid-template-columns: minmax(112px, 148px) minmax(0, 1fr) minmax(112px, 148px);
    gap: 10px 12px;
  }

  .imm-seat {
    grid-template-columns: 46px minmax(0, 1fr);
    min-height: 56px;
    padding: 7px 8px;
  }

  .imm-seat__avatar {
    width: 46px;
    height: 46px;
    border-radius: 15px;
  }

  .imm-seat__copy strong {
    font-size: 11px;
  }
}

@keyframes immSpeechTtsPulse { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.04); } }
@keyframes immSpin { to { transform: rotate(360deg); } }
@keyframes immAvatarGlow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.08); } }
@keyframes immWave { 0%, 100% { transform: scaleY(.55); opacity: .55; } 50% { transform: scaleY(1); opacity: 1; } }
@keyframes immCaret { 0%, 48% { opacity: 1; } 49%, 100% { opacity: 0; } }
@keyframes immRingPulse { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
@keyframes immDot { 0%, 100% { transform: translateY(0); opacity: 0.45; } 50% { transform: translateY(-3px); opacity: 1; } }
</style>
