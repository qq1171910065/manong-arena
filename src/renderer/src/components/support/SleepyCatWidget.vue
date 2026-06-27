<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import DeveloperWechatModal from './DeveloperWechatModal.vue'
import { arenaHomeAssets } from '../../data/arena-home-assets'

withDefaults(
  defineProps<{
    placement?: 'footer' | 'stage'
  }>(),
  { placement: 'footer' }
)

const showDeveloperWechat = ref(false)

const catBubbleLines = [
  '点我可以加开发者微信哦～',
  '有问题？扫码加我反馈～',
  '想提建议也可以找我喵。',
  '悄悄告诉你，开发者微信在这里～',
  '遇到 bug 了？来跟我聊聊吧。',
]

const catBubbleShown = ref(false)
const catBubbleTyped = ref('')
const catBubbleTyping = ref(false)
const catHovered = ref(false)
const catNudge = ref(false)

let catBubbleStartTimer: number | undefined
let catBubblePauseTimer: number | undefined
let catBubbleTypingTimer: number | undefined
let catNudgeTimer: number | undefined

function clearCatBubbleTimers() {
  if (catBubbleStartTimer) window.clearTimeout(catBubbleStartTimer)
  if (catBubblePauseTimer) window.clearTimeout(catBubblePauseTimer)
  if (catBubbleTypingTimer) window.clearInterval(catBubbleTypingTimer)
}

function openWechat() {
  showDeveloperWechat.value = true
}

function pickNextLine(): string {
  return catBubbleLines[Math.floor(Math.random() * catBubbleLines.length)]
}

function typeNextLine() {
  if (showDeveloperWechat.value || catHovered.value) return

  if (catBubblePauseTimer) window.clearTimeout(catBubblePauseTimer)
  if (catBubbleTypingTimer) window.clearInterval(catBubbleTypingTimer)

  catBubbleShown.value = true
  catBubbleTyped.value = ''
  catBubbleTyping.value = true

  const nextText = pickNextLine()
  let cursor = 0

  catBubbleTypingTimer = window.setInterval(() => {
    if (cursor <= nextText.length) {
      catBubbleTyped.value = nextText.slice(0, cursor)
      cursor += 1
      return
    }

    if (catBubbleTypingTimer) window.clearInterval(catBubbleTypingTimer)
    catBubbleTypingTimer = undefined
    catBubbleTyping.value = false

    catBubblePauseTimer = window.setTimeout(() => {
      catBubbleTyped.value = ''
      typeNextLine()
    }, 2000)
  }, 58)
}

function scheduleTyping(delay = 0) {
  if (catBubbleStartTimer) window.clearTimeout(catBubbleStartTimer)
  catBubbleStartTimer = window.setTimeout(typeNextLine, delay)
}

function onCatMouseEnter() {
  catHovered.value = true
  catBubbleShown.value = false
  catBubbleTyping.value = false
  catBubbleTyped.value = ''
  clearCatBubbleTimers()
}

function onCatMouseLeave() {
  catHovered.value = false
  scheduleTyping(1200)
}

function startCatNudge() {
  catNudgeTimer = window.setInterval(() => {
    if (showDeveloperWechat.value || catHovered.value) return
    catNudge.value = true
    window.setTimeout(() => {
      catNudge.value = false
    }, 520)
  }, 4200)
}

watch(showDeveloperWechat, (open) => {
  if (open) {
    catBubbleShown.value = false
    catBubbleTyping.value = false
    catBubbleTyped.value = ''
    clearCatBubbleTimers()
    return
  }
  scheduleTyping(900)
})

onMounted(() => {
  scheduleTyping(1600)
  startCatNudge()
})

onUnmounted(() => {
  clearCatBubbleTimers()
  if (catNudgeTimer) window.clearInterval(catNudgeTimer)
})
</script>

<template>
  <div
    class="arena-sleepy-cat-wrap"
    :class="{
      'is-stage': placement === 'stage',
      'is-nudge': catNudge,
    }"
    @mouseenter="onCatMouseEnter"
    @mouseleave="onCatMouseLeave"
  >
    <p
      v-show="catBubbleShown"
      class="speech arena-cat-speech"
      :class="{ 'is-typing': catBubbleTyping }"
      aria-live="polite"
      role="button"
      tabindex="0"
      @click="openWechat"
      @keydown.enter.prevent="openWechat"
      @keydown.space.prevent="openWechat"
    >
      {{ catBubbleTyped }}<span v-if="catBubbleTyping" class="speech-caret" />
    </p>
    <button
      type="button"
      class="arena-sleepy-cat-btn"
      aria-label="添加开发者微信"
      @click="openWechat"
    >
      <span class="arena-sleepy-cat-glow" aria-hidden="true" />
      <img class="arena-sleepy-cat" :src="arenaHomeAssets.sleepyCat" alt="" />
    </button>
  </div>

  <DeveloperWechatModal v-model="showDeveloperWechat" />
</template>

<style scoped>
.arena-sleepy-cat-wrap {
  position: absolute;
  right: 22px;
  bottom: 0;
  width: 178px;
  height: 68px;
  z-index: 12;
}

.arena-sleepy-cat-wrap.is-stage {
  right: 14px;
  bottom: 38px;
  width: 178px;
  height: 68px;
  z-index: 5;
}

.arena-cat-speech {
  top: -18px;
  right: 52px;
  left: auto;
  bottom: auto;
  cursor: pointer;
  pointer-events: auto;
  text-align: right;
}

.speech {
  position: absolute;
  z-index: 20;
  display: block;
  width: max-content;
  min-width: 76px;
  max-width: 232px;
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
  transform: translateY(-100%);
  transform-origin: bottom right;
  animation: bubble-stack-attention 1.8s ease-in-out infinite;
}

.speech.arena-cat-speech {
  width: max-content;
  min-width: 72px;
  max-width: 228px;
  text-align: right;
  white-space: normal;
  word-break: break-word;
}

.speech.arena-cat-speech::after {
  content: '';
  position: absolute;
  top: auto;
  bottom: -7px;
  right: 24px;
  left: auto;
  width: 15px;
  height: 15px;
  background: rgba(255, 255, 255, 0.76);
  transform: rotate(45deg);
  border-right: 1px solid rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
  border-left: none;
  border-top: none;
}

.speech.arena-cat-speech:hover {
  color: #5a6298;
  background: rgba(255, 255, 255, 0.94);
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

.arena-sleepy-cat-btn {
  position: relative;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  animation: arena-sleepy-cat-idle 2.6s ease-in-out infinite;
  transform-origin: center bottom;
  transition:
    filter 0.18s ease,
    transform 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.arena-sleepy-cat-wrap.is-nudge .arena-sleepy-cat-btn {
  animation: arena-sleepy-cat-nudge 0.52s cubic-bezier(0.34, 1.45, 0.64, 1);
}

.arena-sleepy-cat-glow {
  position: absolute;
  inset: 8% 10% 0;
  border-radius: 999px;
  background: radial-gradient(circle at 50% 70%, rgba(112, 102, 255, 0.34), transparent 68%);
  opacity: 0.55;
  animation: cat-glow-pulse 2.2s ease-in-out infinite;
  pointer-events: none;
}

.arena-sleepy-cat-btn:hover {
  animation: arena-sleepy-cat-wiggle 0.42s ease-in-out infinite;
  filter: drop-shadow(0 18px 24px rgba(76, 82, 151, 0.28));
}

.arena-sleepy-cat-btn:hover .arena-sleepy-cat-glow {
  opacity: 0.95;
  animation: cat-glow-pulse 0.9s ease-in-out infinite;
}

.arena-sleepy-cat-btn:active {
  animation: none;
  transform: translateY(2px) scale(0.96);
}

.arena-sleepy-cat-btn:focus-visible {
  outline: 3px solid rgba(99, 91, 255, 0.34);
  outline-offset: 4px;
  border-radius: 18px;
}

.arena-sleepy-cat {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  filter: drop-shadow(0 12px 16px rgba(76, 82, 151, 0.16));
  pointer-events: none;
  transition: filter 0.18s ease;
}

.arena-sleepy-cat-btn:hover .arena-sleepy-cat {
  filter: drop-shadow(0 16px 22px rgba(76, 82, 151, 0.24));
}

@keyframes bubble-stack-attention {
  0%,
  100% {
    transform: translateY(-100%) scale(1);
    filter: drop-shadow(0 0 0 rgba(112, 102, 255, 0));
  }
  50% {
    transform: translateY(calc(-100% - 3px)) scale(1.03);
    filter: drop-shadow(0 0 12px rgba(112, 102, 255, 0.18));
  }
}

@keyframes arena-sleepy-cat-idle {
  0%,
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  35% {
    transform: translateY(-4px) rotate(-1.2deg) scale(1.02);
  }
  70% {
    transform: translateY(-2px) rotate(1deg) scale(1.01);
  }
}

@keyframes arena-sleepy-cat-nudge {
  0% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
  30% {
    transform: translateY(-7px) rotate(-2deg) scale(1.06);
  }
  55% {
    transform: translateY(-3px) rotate(2deg) scale(1.04);
  }
  100% {
    transform: translateY(0) rotate(0deg) scale(1);
  }
}

@keyframes arena-sleepy-cat-wiggle {
  0%,
  100% {
    transform: translateY(-3px) rotate(-1.6deg) scale(1.03);
  }
  25% {
    transform: translateY(-6px) rotate(2deg) scale(1.05);
  }
  50% {
    transform: translateY(-3px) rotate(-1.2deg) scale(1.03);
  }
  75% {
    transform: translateY(-7px) rotate(1.6deg) scale(1.05);
  }
}

@keyframes cat-glow-pulse {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.96);
  }
  50% {
    opacity: 0.9;
    transform: scale(1.06);
  }
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
