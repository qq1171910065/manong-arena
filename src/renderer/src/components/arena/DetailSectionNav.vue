<script setup lang="ts">
import type { ScrollSpyTab } from '@renderer/composables/useScrollSpySections'

defineProps<{
  tabs: ScrollSpyTab[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()
</script>

<template>
  <nav class="aa-detail-section-nav aa-detail-float-panel" aria-label="页面目录">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      type="button"
      class="aa-detail-section-nav__item"
      :class="{ active: activeId === tab.id }"
      @click="emit('select', tab.id)"
    >
      {{ tab.label }}
    </button>
  </nav>
</template>
