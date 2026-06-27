<script setup lang="ts">
import { ref } from 'vue'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import { formatUserMessage, portableDataService } from '@renderer/services/arena'

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  created: [modeId: string]
}>()

const name = ref('')
const subtitle = ref('')
const description = ref('')
const saving = ref(false)
const error = ref('')

function resetForm() {
  name.value = ''
  subtitle.value = ''
  description.value = ''
  error.value = ''
}

function closeDialog() {
  open.value = false
  resetForm()
}

async function submit() {
  if (!name.value.trim()) {
    error.value = '玩法名称不能为空'
    return
  }
  saving.value = true
  error.value = ''
  try {
    const mode = await portableDataService.createCustomGameMode({
      name: name.value.trim(),
      subtitle: subtitle.value.trim(),
      description: description.value.trim(),
    })
    emit('created', mode.id)
    closeDialog()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DetailEditDialog
    v-model="open"
    title="新建玩法场景"
    subtitle="基于圆桌讨论模板创建，可导入导出并在详情页继续编辑"
    save-label="创建玩法"
    :saving="saving"
    @save="submit"
    @close="resetForm"
  >
    <label class="edit-field">
      <span>玩法名称</span>
      <input v-model="name" class="field" maxlength="20" placeholder="例如：哲学思辨圆桌" />
    </label>
    <label class="edit-field">
      <span>副标题</span>
      <input v-model="subtitle" class="field" maxlength="40" placeholder="一句话说明" />
    </label>
    <label class="edit-field">
      <span>玩法描述</span>
      <textarea v-model="description" class="field field-tall" rows="4" placeholder="描述讨论方式、适用场景与特色" />
    </label>
    <p v-if="error" class="error-text">{{ error }}</p>
  </DetailEditDialog>
</template>

<style scoped>
.edit-field {
  display: grid;
  gap: 8px;
}

.edit-field + .edit-field {
  margin-top: 14px;
}

.edit-field span {
  font-size: 13px;
  color: #66709d;
}

.field {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid rgba(130, 142, 207, 0.22);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.82);
  color: #1f2550;
  font: inherit;
}

.field-tall {
  resize: vertical;
  min-height: 96px;
}

.error-text {
  margin: 14px 0 0;
  color: #dc2626;
  font-size: 13px;
}
</style>
