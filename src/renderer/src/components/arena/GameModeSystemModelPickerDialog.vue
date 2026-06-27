<script setup lang="ts">
import { ref, watch } from 'vue'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import ModelPickerField from '@renderer/components/arena/ModelPickerField.vue'
import { formatUserMessage, gameScenarioService, getFallbackModelId } from '@renderer/services/arena'
import type { SystemRoleConfig } from '@shared/arena/game-scenario'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  scenarioId: string
  systemRoles: SystemRoleConfig[]
  modelId: string
}>()

const emit = defineEmits<{
  saved: []
}>()

const draftModelId = ref('')
const saving = ref(false)
const error = ref('')

watch(show, (open) => {
  if (open) {
    draftModelId.value = props.modelId || getFallbackModelId()
    error.value = ''
  }
})

async function save() {
  if (!props.systemRoles.length) return
  saving.value = true
  error.value = ''
  try {
    await gameScenarioService.saveSystemRoleModels(
      props.scenarioId,
      props.systemRoles.map((role) => ({
        id: role.id,
        modelId: draftModelId.value,
        enabled: role.enabled,
      }))
    )
    show.value = false
    emit('saved')
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
    title="系统角色模型"
    subtitle="裁判与解说共用"
    save-label="确定"
    :saving="saving"
    @save="save"
  >
    <p v-if="error" class="edit-error">{{ error }}</p>
    <p class="edit-hint">未单独配置时，裁判与解说会使用系统默认对话模型；此处可覆盖为其他网关模型。</p>
    <ModelPickerField
      v-model="draftModelId"
      label="系统角色模型"
      hint="从网关模型列表选择；审阅发言、解说播报等均使用此模型。"
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

.edit-hint {
  margin: 0 0 14px;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.55;
}
</style>
