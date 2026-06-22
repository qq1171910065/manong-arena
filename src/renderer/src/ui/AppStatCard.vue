<script setup lang="ts">
import type { Component } from 'vue'

withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    trend?: 'up' | 'down' | 'neutral'
    trendLabel?: string
    icon?: Component
  }>(),
  {
    trend: 'neutral',
  }
)
</script>

<template>
  <div class="app-stat-card">
    <div class="app-stat-card__head">
      <span class="app-stat-card__label">{{ label }}</span>
      <component :is="icon" v-if="icon" :size="16" class="app-stat-card__icon" />
    </div>
    <div class="app-stat-card__value">{{ value }}</div>
    <div v-if="hint || trendLabel" class="app-stat-card__foot">
      <span
        v-if="trendLabel"
        class="app-stat-card__trend"
        :class="{
          'is-up': trend === 'up',
          'is-down': trend === 'down',
        }"
      >
        {{ trendLabel }}
      </span>
      <span v-if="hint" class="text-muted">{{ hint }}</span>
    </div>
  </div>
</template>
