<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  inlineHint?: boolean
}>()
</script>

<template>
  <div class="settings-row" :class="{ 'settings-row--inline-hint': inlineHint }">
    <div class="settings-row__label">
      <span class="settings-row__title">{{ label }}</span>
      <span v-if="hint" class="settings-row__hint" :title="hint">{{ hint }}</span>
    </div>
    <div class="settings-row__control">
      <slot />
    </div>
  </div>
</template>
