<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'

defineProps<{
  label: string
  hint: string
  modelValue: number
  min?: number
  max?: number
  step?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  change: []
}>()
</script>

<template>
  <SettingsRow :label="label" :hint="hint" inline-hint>
    <input
      :value="modelValue"
      type="range"
      class="settings-volume-range"
      :min="min ?? 0"
      :max="max ?? 100"
      :step="step ?? 1"
      @input="emit('update:modelValue', Number(($event.target as HTMLInputElement).value))"
      @change="emit('change')"
    />
  </SettingsRow>
</template>

<style scoped>
.settings-volume-range {
  width: min(220px, 100%);
  accent-color: var(--brand);
}
</style>
