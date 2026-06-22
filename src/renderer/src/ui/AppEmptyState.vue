<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title?: string
  description?: string
  icon?: Component
}>()
</script>

<template>
  <div class="app-empty-state">
    <component :is="icon" v-if="icon" :size="40" class="app-empty-state__icon" />
    <strong v-if="title" class="app-empty-state__title">{{ title }}</strong>
    <p v-if="description" class="app-empty-state__desc">{{ description }}</p>
    <div v-if="$slots.default" class="app-empty-state__actions">
      <slot />
    </div>
  </div>
</template>
