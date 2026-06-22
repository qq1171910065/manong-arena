<script setup lang="ts">
import { computed } from 'vue'
import { NButton } from 'naive-ui'

type Variant = 'default' | 'primary' | 'secondary' | 'danger'
type Size = 'sm' | 'md'

const props = withDefaults(
  defineProps<{
    variant?: Variant
    size?: Size
    native?: boolean
    block?: boolean
    disabled?: boolean
    loading?: boolean
    type?: 'button' | 'submit' | 'reset'
  }>(),
  {
    variant: 'default',
    size: 'md',
    native: false,
    block: false,
    disabled: false,
    loading: false,
    type: 'button',
  }
)

const naiveType = computed(() => {
  if (props.variant === 'primary') return 'primary'
  if (props.variant === 'danger') return 'error'
  if (props.variant === 'secondary') return 'default'
  return 'default'
})

const naiveSecondary = computed(() => props.variant === 'secondary')

const cssClass = computed(() => {
  const classes = ['btn']
  if (props.variant === 'primary') classes.push('primary')
  if (props.variant === 'secondary') classes.push('secondary')
  if (props.variant === 'danger') classes.push('danger')
  if (props.size === 'sm') classes.push('btn-sm')
  if (props.block) classes.push('btn-block')
  return classes
})
</script>

<template>
  <button
    v-if="native"
    :type="type"
    :class="cssClass"
    :disabled="disabled || loading"
  >
    <slot />
  </button>
  <NButton
    v-else
    :type="naiveType"
    :secondary="naiveSecondary"
    :size="size === 'sm' ? 'small' : 'medium'"
    :block="block"
    :disabled="disabled"
    :loading="loading"
    :attr-type="type"
  >
    <slot />
  </NButton>
</template>
