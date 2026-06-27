<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import MatchSpeechContent from '@renderer/components/arena/MatchSpeechContent.vue'
import type { MatchParticipant, SpeechDisplayConfig } from '@shared/arena/types'

const props = defineProps<{
  text: string
  side?: 'left' | 'right'
  active?: boolean
  speechConfig?: SpeechDisplayConfig | null
  participants?: Pick<MatchParticipant, 'characterId' | 'characterName' | 'seatOrder'>[]
}>()

const typedText = ref('')
const visible = ref(false)

let revealTimer: ReturnType<typeof setTimeout> | undefined
let typingTimer: ReturnType<typeof setInterval> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined

const bubbleSide = computed(() => props.side || 'right')

function clearTimers() {
  if (revealTimer) clearTimeout(revealTimer)
  if (typingTimer) clearInterval(typingTimer)
  if (hideTimer) clearTimeout(hideTimer)
  revealTimer = undefined
  typingTimer = undefined
  hideTimer = undefined
}

function startTyping(fullText: string) {
  typedText.value = ''
  visible.value = true
  let cursor = 0
  typingTimer = setInterval(() => {
    if (cursor <= fullText.length) {
      typedText.value = fullText.slice(0, cursor)
      cursor += 1
      return
    }
    if (typingTimer) clearInterval(typingTimer)
    typingTimer = undefined
    hideTimer = setTimeout(() => {
      visible.value = false
      typedText.value = ''
    }, 1400)
  }, 58)
}

watch(
  () => [props.active, props.text] as const,
  ([active, text]) => {
    clearTimers()
    visible.value = false
    typedText.value = ''
    if (!active || !text) return
    revealTimer = setTimeout(() => startTyping(text), 680)
  },
  { immediate: true }
)

onUnmounted(() => clearTimers())
</script>

<template>
  <Transition name="bubble-pop">
    <p
      v-if="visible && active"
      class="speech"
      :class="{
        'speech--left': bubbleSide === 'left',
        'speech--right': bubbleSide === 'right',
      }"
    >
      <MatchSpeechContent
        v-if="speechConfig"
        :text="typedText"
        :config="speechConfig"
        :participants="participants"
      />
      <template v-else>{{ typedText }}</template><span class="speech-caret"></span>
    </p>
  </Transition>
</template>

<style scoped>
.speech {
  position: absolute;
  top: 44%;
  z-index: 10;
  display: block;
  width: max-content;
  min-width: 76px;
  max-width: min(232px, 88vw);
  min-height: 36px;
  margin: 0;
  padding: 9px 13px 10px;
  white-space: pre-wrap;
  text-align: left;
  color: #69729f;
  font-size: 12px;
  font-weight: 450;
  line-height: 1.35;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 14px 24px rgba(84, 93, 166, 0.13);
  backdrop-filter: blur(12px);
  transform: translateY(-50%);
  pointer-events: none;
}

.speech::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 15px;
  height: 15px;
  background: rgba(255, 255, 255, 0.76);
  transform: translateY(-50%) rotate(45deg);
}

.speech--right {
  left: calc(100% - 6px);
}

.speech--right::after {
  left: -7px;
  border-left: 1px solid rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
}

.speech--left {
  right: calc(100% - 6px);
}

.speech--left::after {
  right: -7px;
  border-right: 1px solid rgba(255, 255, 255, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.8);
}

.speech-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.15em;
  border-radius: 999px;
  background: #7066ff;
  animation: caretBlink 0.9s steps(2, end) infinite;
}

.bubble-pop-enter-active {
  transition: opacity 0.24s ease, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), filter 0.34s ease;
}

.bubble-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.18s ease;
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
  opacity: 0;
  filter: blur(6px);
}

.bubble-pop-enter-from.speech--right,
.bubble-pop-leave-to.speech--right {
  transform: translate(-10px, -50%) scale(0.88);
}

.bubble-pop-enter-to.speech--right,
.bubble-pop-leave-from.speech--right {
  transform: translate(0, -50%) scale(1);
}

.bubble-pop-enter-from.speech--left,
.bubble-pop-leave-to.speech--left {
  transform: translate(10px, -50%) scale(0.88);
}

.bubble-pop-enter-to.speech--left,
.bubble-pop-leave-from.speech--left {
  transform: translate(0, -50%) scale(1);
}

@keyframes caretBlink {
  0%,
  48% {
    opacity: 1;
  }
  49%,
  100% {
    opacity: 0;
  }
}
</style>
