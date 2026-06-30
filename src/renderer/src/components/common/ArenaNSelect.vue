<script setup lang="ts">
import { NSelect, type SelectOption } from '../../ui'

withDefaults(
  defineProps<{
    options?: SelectOption[]
    placeholder?: string
    disabled?: boolean
    clearable?: boolean
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    options: () => [],
    size: 'medium',
    clearable: false,
  }
)

const model = defineModel<string | null>('value', { required: true })
</script>

<template>
  <NSelect
    v-model:value="model"
    class="arena-n-select"
    :options="options"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
    :size="size"
  />
</template>

<style scoped>
.arena-n-select :deep(.n-base-selection) {
  --n-border: 1px solid rgba(130, 142, 207, 0.18) !important;
  --n-border-hover: 1px solid rgba(112, 105, 255, 0.28) !important;
  --n-border-active: 1px solid rgba(91, 87, 243, 0.42) !important;
  --n-border-focus: 1px solid rgba(91, 87, 243, 0.42) !important;
  --n-box-shadow-active: 0 0 0 3px rgba(112, 105, 255, 0.12) !important;
  --n-box-shadow-focus: 0 0 0 3px rgba(112, 105, 255, 0.12) !important;
  --n-color: rgba(255, 255, 255, 0.82) !important;
  --n-color-active: rgba(255, 255, 255, 0.92) !important;
  --n-text-color: #243066 !important;
  --n-placeholder-color: #9aa3c7 !important;
  --n-border-radius: 12px !important;
  --n-height: 38px !important;
  --n-font-size: 13.5px !important;
  backdrop-filter: blur(8px);
}

.arena-n-select :deep(.n-base-selection-label) {
  color: #243066;
}
</style>
