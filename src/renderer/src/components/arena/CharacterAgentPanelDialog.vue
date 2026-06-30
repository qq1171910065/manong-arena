<script setup lang="ts">
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'

const show = defineModel<boolean>({ default: false })

defineProps<{
  title: string
  subtitle?: string
  wide?: boolean
}>()
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    :title="title"
    :subtitle="subtitle"
    variant="preview"
    :size="wide ? 'xl' : 'lg'"
    body-flush
    show-header-close
  >
    <div class="agent-panel-dialog__body">
      <slot />
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.agent-panel-dialog__body {
  padding: 16px 20px 20px;
}
</style>
