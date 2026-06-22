<script setup lang="ts">
import { ref } from 'vue'
import { NAlert, NButton, NSpace, useMessage } from '../../ui'

defineProps<{ embedded?: boolean }>()

const message = useMessage()
const filePath = ref('')
const fileName = ref('')
const content = ref('')

async function pick() {
  const r = await window.api.openFileDialog?.()
  if (!r?.success || !r.path) return
  filePath.value = r.path
  const read = await window.api.readTextFile?.(r.path)
  if (read?.success) {
    content.value = read.content
    fileName.value = read.name
  }
}

async function save() {
  let path = filePath.value
  if (!path) {
    const r = await window.api.saveFileDialog?.(fileName.value || 'notes.txt')
    if (!r?.success || !r.path) return
    path = r.path
    filePath.value = path
  }
  const r = await window.api.writeTextFile?.(path, content.value)
  if (r?.success) message.success('已保存')
  else message.error(r?.error || '保存失败')
}
</script>

<template>
  <div :class="[embedded ? 'demo-embedded' : 'page']">
    <div v-if="!embedded" class="page-head">
      <h1>文件管理示例</h1>
      <NSpace>
        <NButton @click="pick">打开文件</NButton>
        <NButton type="primary" @click="save">保存</NButton>
      </NSpace>
    </div>
    <NSpace v-else style="margin-bottom: 12px">
      <NButton size="small" @click="pick">打开文件</NButton>
      <NButton size="small" type="primary" @click="save">保存</NButton>
    </NSpace>
    <NAlert v-if="filePath" type="info" :bordered="false" style="margin-bottom: 12px">{{ filePath }}</NAlert>
    <textarea v-model="content" class="field field-code" placeholder="在此编辑文本内容…" />
  </div>
</template>
