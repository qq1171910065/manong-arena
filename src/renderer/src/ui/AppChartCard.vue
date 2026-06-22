<script setup lang="ts">
import type { ECBasicOption } from 'echarts/types/dist/shared'
import AppChart from './charts/AppChart.vue'
import { NCard } from 'naive-ui'

withDefaults(
  defineProps<{
    title?: string
    option: ECBasicOption
    height?: string
    loading?: boolean
  }>(),
  {
    height: '280px',
    loading: false,
  }
)
</script>

<template>
  <NCard class="mntools-panel app-chart-card" :title="title">
    <AppChart :option="option" :height="height" :loading="loading" />
  </NCard>
</template>

<style scoped>
.app-chart-card :deep(.n-card-header) {
  padding-bottom: var(--space-2);
}
</style>
