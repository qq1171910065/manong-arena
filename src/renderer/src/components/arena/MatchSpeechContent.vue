<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { renderMatchSpeechHtml } from '@shared/arena/speech-display'
import type { MatchParticipant, SpeechDisplayConfig } from '@shared/arena/types'

const props = defineProps<{
  text: string
  config?: SpeechDisplayConfig | null
  participants?: Pick<MatchParticipant, 'characterId' | 'characterName' | 'seatOrder'>[]
  streaming?: boolean
}>()

const visibleText = ref('')
let revealRaf = 0

function cancelReveal() {
  if (revealRaf) cancelAnimationFrame(revealRaf)
  revealRaf = 0
}

function syncVisibleText(force = false) {
  const target = props.text
  if (!props.streaming || force) {
    cancelReveal()
    visibleText.value = target
    return
  }
  if (!target.startsWith(visibleText.value)) visibleText.value = ''
  if (visibleText.value.length >= target.length) return
  if (!revealRaf) revealRaf = requestAnimationFrame(revealTick)
}

function revealTick() {
  const target = props.text
  const backlog = target.length - visibleText.value.length
  if (backlog <= 0) {
    revealRaf = 0
    return
  }
  const step = backlog > 24 ? Math.min(8, Math.ceil(backlog / 6)) : Math.max(1, Math.min(3, backlog))
  visibleText.value = target.slice(0, visibleText.value.length + step)
  revealRaf = requestAnimationFrame(revealTick)
}

watch(() => props.text, () => syncVisibleText())
watch(
  () => props.streaming,
  (live) => {
    if (!live) syncVisibleText(true)
  }
)
syncVisibleText(true)
onUnmounted(cancelReveal)

const html = computed(() =>
  renderMatchSpeechHtml(visibleText.value, {
    config: props.config,
    participants: props.participants,
  })
)
</script>

<template>
  <span class="match-speech-content" v-html="html" />
</template>

<style scoped>
.match-speech-content {
  white-space: pre-wrap;
}

.match-speech-content :deep(.speech-mention) {
  display: inline;
  padding: 0 5px;
  border-radius: 7px;
  color: #4f46e5;
  font-weight: 650;
  background: rgba(91, 87, 243, 0.14);
  box-shadow: inset 0 0 0 1px rgba(91, 87, 243, 0.12);
}

.match-speech-content :deep(.speech-term) {
  display: inline;
  padding: 0 1px;
  border-bottom: 1px dashed rgba(15, 118, 110, 0.38);
  color: #0f766e;
  font-weight: 560;
  cursor: help;
}
</style>
