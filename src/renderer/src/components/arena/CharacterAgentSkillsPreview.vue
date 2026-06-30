<script setup lang="ts">
import { computed } from 'vue'
import { normalizeAgentSkills } from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'
import DetailFeedPreview from './DetailFeedPreview.vue'

const props = defineProps<{ character: Character }>()

const skills = computed(() => normalizeAgentSkills(props.character.agentSkills).filter((s) => s.enabled))
const previewItems = computed(() =>
  skills.value.slice(0, 5).map((skill) => ({
    id: skill.id,
    title: skill.name,
    text: skill.description || skill.triggerTiming,
  }))
)
const moreCount = computed(() => Math.max(0, skills.value.length - previewItems.value.length))
</script>

<template>
  <DetailFeedPreview :items="previewItems" :more-count="moreCount" :clamp="2" />
</template>
