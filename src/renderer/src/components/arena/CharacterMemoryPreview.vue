<script setup lang="ts">
import { computed } from 'vue'
import { MEMORY_CATEGORY_LABELS, normalizeAgentMemories } from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'
import DetailFeedPreview from './DetailFeedPreview.vue'

const props = defineProps<{ character: Character }>()

const memories = computed(() => normalizeAgentMemories(props.character.agentMemories))
const previewItems = computed(() => {
  const pinned = memories.value.filter((m) => m.pinned)
  const rest = memories.value.filter((m) => !m.pinned)
  return [...pinned, ...rest].slice(0, 5).map((item) => ({
    id: item.id,
    label: MEMORY_CATEGORY_LABELS[item.category],
    text: item.content,
  }))
})
const moreCount = computed(() => Math.max(0, memories.value.length - previewItems.value.length))
</script>

<template>
  <DetailFeedPreview :items="previewItems" :more-count="moreCount" :clamp="2" />
</template>
