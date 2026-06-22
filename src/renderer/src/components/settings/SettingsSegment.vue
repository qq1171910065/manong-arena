<script setup lang="ts">
defineProps<{
  modelValue: string | boolean
  options: Array<{ label: string; value: string | boolean; disabled?: boolean }>
  disabled?: boolean
  variant?: 'default' | 'bool'
}>()

const emit = defineEmits<{ 'update:modelValue': [string | boolean] }>()
</script>

<template>
  <div class="settings-segment" :class="{ 'settings-segment--bool': variant === 'bool' }" role="group">
    <button
      v-for="opt in options"
      :key="String(opt.value)"
      type="button"
      class="settings-segment__btn"
      :class="{
        'is-active': modelValue === opt.value,
        'is-on': variant === 'bool' && opt.value === true,
        'is-off': variant === 'bool' && opt.value === false,
      }"
      :disabled="disabled || opt.disabled"
      @click="emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>
