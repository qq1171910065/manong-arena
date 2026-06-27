<script setup lang="ts">
import { ref, watch } from 'vue'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import ModelPickerField from '@renderer/components/arena/ModelPickerField.vue'
import { characterService, formatUserMessage } from '@renderer/services/arena'
import { cloneJson } from '@shared/clone-json'
import type { Character } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  saved: [character: Character]
}>()

const draftModelId = ref('')
const saving = ref(false)
const error = ref('')

watch(show, (open) => {
  if (open) {
    draftModelId.value = props.character.modelId
    error.value = ''
  }
}, { immediate: true })

async function save() {
  saving.value = true
  error.value = ''
  try {
    const next = cloneJson(props.character)
    next.modelId = draftModelId.value
    const saved = await characterService.save(next)
    show.value = false
    emit('saved', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DetailEditDialog
    v-model="show"
    title="绑定模型"
    subtitle="角色模型"
    save-label="确定"
    :saving="saving"
    @save="save"
  >
    <p v-if="error" class="edit-error">{{ error }}</p>
    <ModelPickerField
      v-model="draftModelId"
      label="角色模型"
      hint="从网关模型列表选择；发言、投票与私聊均使用此模型。"
    />
  </DetailEditDialog>
</template>

<style scoped>
.edit-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  color: #dc2626;
  font-size: 13px;
}
</style>
