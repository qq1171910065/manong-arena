<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Bot, Zap } from 'lucide-vue-next'
import { useModelService } from '@renderer/composables/useModelService'
import { ensureGatewayKey, gatewayChatStream } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NFormItem, NSelect, NSpace, useMessage } from '../../ui'

const message = useMessage()
const { models, modelsLoading } = useModelService()

const chatModel = ref<string | null>(null)
const chatPrompt = ref('用一句话介绍 Agent Arena。')
const chatOutput = ref('')
const chatLoading = ref(false)
let chatCancel: (() => void) | null = null

const chatModelOptions = computed(() => models.value.map((m) => ({ label: m.id, value: m.id })))

watch(
  models,
  (list) => {
    if (!chatModel.value && list.length) {
      chatModel.value = list[0]?.id || null
    }
  },
  { immediate: true }
)

async function sendChat() {
  if (!chatModel.value || chatLoading.value) return
  chatLoading.value = true
  chatOutput.value = ''
  chatCancel?.()
  try {
    await ensureGatewayKey()
    chatCancel = await gatewayChatStream(
      chatModel.value,
      [{ role: 'user', content: chatPrompt.value }],
      {
        onChunk: (t) => {
          chatOutput.value += t
        },
        onEnd: () => {
          chatLoading.value = false
        },
        onError: (err) => {
          message.error(err)
          chatLoading.value = false
        },
      }
    )
  } catch (e) {
    message.error(e instanceof Error ? e.message : '发送失败')
    chatLoading.value = false
  }
}

function stopChat() {
  chatCancel?.()
  chatCancel = null
  chatLoading.value = false
}
</script>

<template>
  <ProfileSectionLayout
    title="流式调试"
    desc="验证 /v1/chat/completions 流式对话链路，使用本机 sk- Key 鉴权。"
  >
    <NCard class="mntools-panel" title="流式对话测试">
      <template #header-extra>
        <Bot :size="16" class="text-muted" />
      </template>
      <NFormItem label="模型">
        <NSelect
          v-model:value="chatModel"
          :options="chatModelOptions"
          :loading="modelsLoading"
          filterable
          placeholder="选择模型"
        />
      </NFormItem>
      <NFormItem label="提示词">
        <textarea v-model="chatPrompt" class="field field-textarea" rows="3" :disabled="chatLoading" />
      </NFormItem>
      <NSpace>
        <NButton type="primary" :loading="chatLoading" :disabled="!chatModel" @click="sendChat">
          <template #icon><Zap :size="14" /></template>
          发送
        </NButton>
        <NButton :disabled="!chatLoading" @click="stopChat">停止</NButton>
      </NSpace>
      <pre class="code-block model-service-chat-output">{{
        chatOutput || (chatLoading ? '（生成中…）' : '（等待输出）')
      }}</pre>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-service-chat-output {
  margin-top: 12px;
  min-height: 160px;
  max-height: 320px;
  overflow: auto;
}
</style>
