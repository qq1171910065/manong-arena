<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'

defineProps<{
  label: string
  hint?: string
  value?: string
}>()
</script>

<template>
  <SettingsRow :label="label" :hint="hint">
    <div class="settings-info-value">
      <slot>
        <span>{{ value }}</span>
      </slot>
    </div>
  </SettingsRow>
</template>

<style scoped>
.settings-info-value {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  max-width: 100%;
  text-align: right;
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 500;
  line-height: 1.45;
  word-break: break-word;
}

.settings-info-value :deep(code) {
  font-size: 12px;
}
</style>
