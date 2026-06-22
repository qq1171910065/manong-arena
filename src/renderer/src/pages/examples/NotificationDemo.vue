<script setup lang="ts">
import { ref } from 'vue'
import { NButton, NCard, NFormItem, NInput, useMessage, useNotification } from '../../ui'

defineProps<{ embedded?: boolean }>()

const message = useMessage()
const notification = useNotification()
const title = ref('mntools 通知')
const body = ref('这是一条系统桌面通知示例')

async function send() {
  if (!window.api.sendNotification) {
    message.error('通知模块未启用，请在主进程 modules 中注册 notification')
    return
  }
  const r = await window.api.sendNotification(title.value, body.value)
  if (r?.success) {
    message.success('系统通知已发送（请查看任务栏/通知中心）')
    notification.create({
      title: title.value,
      content: body.value,
      duration: 4500,
    })
  } else {
    message.error(r?.error || '发送失败')
  }
}
</script>

<template>
  <div :class="[embedded ? 'demo-embedded' : 'page']">
    <div v-if="!embedded" class="page-head"><h1>系统通知示例</h1></div>
    <NCard class="mntools-panel">
      <p class="text-muted" style="margin: 0 0 12px">
        同时触发系统桌面通知与应用内通知，便于在开发环境确认调用成功。
      </p>
      <NFormItem label="标题">
        <NInput v-model:value="title" />
      </NFormItem>
      <NFormItem label="内容">
        <NInput v-model:value="body" />
      </NFormItem>
      <NButton type="primary" @click="send">发送通知</NButton>
    </NCard>
  </div>
</template>
