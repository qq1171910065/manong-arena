<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'

const show = defineModel<boolean>({ default: false })

defineProps<{
  title: string
  subtitle?: string
  saving?: boolean
  saveLabel?: string
}>()

const emit = defineEmits<{
  save: []
  close: []
}>()

function close() {
  show.value = false
  emit('close')
}

function save() {
  emit('save')
}
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    :title="title"
    :subtitle="subtitle"
    variant="form"
    show-footer
    @close="emit('close')"
  >
    <slot />

    <template #footer-left>
      <slot name="footer-left" />
    </template>

    <template #footer-actions>
      <button type="button" class="arena-dialog__btn" @click="close">关闭</button>
      <button class="arena-dialog__btn arena-dialog__btn--primary" type="button" :disabled="saving" @click="save">
        <Loader2 v-show="saving" :size="16" class="spin" />
        {{ saving ? '保存中…' : saveLabel || '保存' }}
      </button>
    </template>
  </ArenaDialogShell>
</template>

<style scoped>
.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
