import { computed, onUnmounted, ref, watch, type Ref } from 'vue'
import {
  estimateSpeechDurationMs,
  isSpeechLive,
  isSpeechStreaming,
  isSpeechThinking,
  pickLiveSpeechMessage,
  speechDisplayText,
} from '@renderer/services/arena/match-room-presenters'
import type { Match, MatchMessage } from '@shared/arena/types'

export type ImmersiveSpeechPhase = 'idle' | 'thinking' | 'speaking' | 'tts' | 'cooldown'

const COOLDOWN_MS = 3000

export function useImmersiveSpeechCadence(options: {
  enabled: Ref<boolean>
  match: Ref<Match | null>
  visibleMessages: Ref<MatchMessage[]>
  activeSpeakerId: Ref<string | null>
  ttsSpeakingId: Ref<string | null>
  ttsEnabled: Ref<boolean>
  modelCalling: Ref<boolean>
  actionKind: Ref<string>
  canAdvance: Ref<boolean>
  advancing: Ref<boolean>
  streamTick: Ref<number>
  onAdvance: () => void
}) {
  const phase = ref<ImmersiveSpeechPhase>('idle')
  const speechProgress = ref(0)
  const speechDurationMs = ref(12000)

  let speechStartedAt = 0
  let progressRaf = 0
  let cooldownTimer: ReturnType<typeof setTimeout> | null = null
  let ttsWaitTimer: ReturnType<typeof setTimeout> | null = null
  let handledMessageId: string | null = null
  let ttsSeenForMessage = false

  const presentationHold = computed(
    () =>
      options.enabled.value &&
      options.actionKind.value === 'speech' &&
      phase.value !== 'idle'
  )

  const liveSpeechMessage = computed(() => {
    void options.streamTick.value
    return pickLiveSpeechMessage(options.visibleMessages.value, options.activeSpeakerId.value)
  })

  function clearTimers() {
    if (progressRaf) {
      cancelAnimationFrame(progressRaf)
      progressRaf = 0
    }
    if (cooldownTimer) {
      clearTimeout(cooldownTimer)
      cooldownTimer = null
    }
    if (ttsWaitTimer) {
      clearTimeout(ttsWaitTimer)
      ttsWaitTimer = null
    }
  }

  function resetCadence() {
    clearTimers()
    phase.value = 'idle'
    speechProgress.value = 0
    handledMessageId = null
    ttsSeenForMessage = false
  }

  function tickProgress() {
    if (phase.value !== 'speaking') return
    const elapsed = Date.now() - speechStartedAt
    speechProgress.value = Math.min(1, elapsed / speechDurationMs.value)
    progressRaf = requestAnimationFrame(tickProgress)
  }

  function beginSpeaking(msg: MatchMessage) {
    phase.value = 'speaking'
    const text = speechDisplayText(msg)
    speechDurationMs.value = estimateSpeechDurationMs(text, Boolean(msg.isHumanPlayer))
    if (!speechStartedAt) speechStartedAt = Date.now()
    if (!progressRaf) progressRaf = requestAnimationFrame(tickProgress)
  }

  function freezeSpeaking() {
    if (progressRaf) {
      cancelAnimationFrame(progressRaf)
      progressRaf = 0
    }
    speechProgress.value = Math.min(1, Math.max(speechProgress.value, 0.98))
  }

  function startCooldown() {
    phase.value = 'cooldown'
    freezeSpeaking()
    cooldownTimer = setTimeout(() => {
      cooldownTimer = null
      resetCadence()
      if (options.canAdvance.value && !options.advancing.value) {
        options.onAdvance()
      }
    }, COOLDOWN_MS)
  }

  function waitForTtsThenCooldown(msg: MatchMessage) {
    phase.value = 'tts'
    freezeSpeaking()
    handledMessageId = msg.id

    if (!options.ttsEnabled.value || !speechDisplayText(msg).trim()) {
      startCooldown()
      return
    }

    const finish = () => {
      if (ttsWaitTimer) {
        clearTimeout(ttsWaitTimer)
        ttsWaitTimer = null
      }
      window.removeEventListener('arena:tts-idle', onTtsIdle)
      startCooldown()
    }

    const onTtsIdle = () => {
      if (options.ttsSpeakingId.value !== null) return
      finish()
    }

    if (options.ttsSpeakingId.value === null && ttsSeenForMessage) {
      finish()
      return
    }

    window.addEventListener('arena:tts-idle', onTtsIdle)
    ttsWaitTimer = setTimeout(() => {
      window.removeEventListener('arena:tts-idle', onTtsIdle)
      finish()
    }, 90000)
  }

  function syncPhase() {
    if (!options.enabled.value || options.actionKind.value !== 'speech') {
      resetCadence()
      return
    }

    const msg = liveSpeechMessage.value
    const calling = options.modelCalling.value

    if (!msg) {
      if (calling) {
        clearTimers()
        phase.value = 'thinking'
        speechProgress.value = 0
        speechStartedAt = 0
      } else if (phase.value !== 'cooldown') {
        resetCadence()
      }
      return
    }

    if (handledMessageId === msg.id && (phase.value === 'tts' || phase.value === 'cooldown')) {
      return
    }

    if (options.ttsSpeakingId.value === msg.participantId) {
      ttsSeenForMessage = true
    }

    if (isSpeechThinking(msg) || (isSpeechStreaming(msg) && calling && !speechDisplayText(msg).trim())) {
      clearTimers()
      phase.value = 'thinking'
      speechProgress.value = 0
      speechStartedAt = 0
      handledMessageId = null
      ttsSeenForMessage = false
      return
    }

    if (isSpeechLive(msg) || (isSpeechStreaming(msg) && speechDisplayText(msg).trim())) {
      if (msg.isHumanPlayer && msg.streamStatus === 'streaming') {
        if (phase.value === 'thinking' || phase.value === 'idle') {
          speechStartedAt = Date.now()
          speechProgress.value = 0
        }
        speechDurationMs.value = estimateSpeechDurationMs(speechDisplayText(msg), true)
        beginSpeaking(msg)
        return
      }
      if (phase.value === 'thinking' || phase.value === 'idle') {
        speechStartedAt = Date.now()
        speechProgress.value = 0
      }
      speechDurationMs.value = estimateSpeechDurationMs(speechDisplayText(msg))
      beginSpeaking(msg)
      return
    }

    if (msg.isHumanPlayer && msg.streamStatus === 'streaming' && !speechDisplayText(msg).trim()) {
      clearTimers()
      phase.value = 'thinking'
      speechProgress.value = 0
      speechStartedAt = 0
      handledMessageId = null
      ttsSeenForMessage = false
      return
    }

    if (msg.streamStatus === 'done' || msg.streamStatus === 'failed') {
      if (handledMessageId !== msg.id) {
        waitForTtsThenCooldown(msg)
      }
    }
  }

  watch(
    [
      options.enabled,
      options.actionKind,
      options.activeSpeakerId,
      options.streamTick,
      () => options.match.value?.runtime.modelCallStatus,
      () => options.match.value?.runtime.currentSpeakerId,
      options.ttsSpeakingId,
      options.ttsEnabled,
      options.modelCalling,
      liveSpeechMessage,
    ],
    syncPhase,
    { immediate: true }
  )

  watch(options.enabled, (on) => {
    if (!on) resetCadence()
  })

  onUnmounted(resetCadence)

  return {
    phase,
    speechProgress,
    speechDurationMs,
    presentationHold,
    liveSpeechMessage,
  }
}
