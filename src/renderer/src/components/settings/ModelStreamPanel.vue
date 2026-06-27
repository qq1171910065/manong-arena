<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Zap } from 'lucide-vue-next'
import { useModelService } from '@renderer/composables/useModelService'
import { ensureGatewayKey, gatewayChatStream } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NFormItem, NSelect, NSpace, useMessage } from '../../ui'

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
  <ProfileSectionLayout title="流式调试" desc="验证流式对话链路与本机 Key 鉴权。">
    <template #actions>
      <NSpace>
        <NButton type="primary" size="small" :loading="chatLoading" :disabled="!chatModel" @click="sendChat">
          <template #icon><Zap :size="14" /></template>
          发送
        </NButton>
        <NButton size="small" :disabled="!chatLoading" @click="stopChat">停止</NButton>
      </NSpace>
    </template>

    <section class="portal-plain-block">
      <h4 class="portal-plain-block__title">流式对话测试</h4>
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
      <pre class="code-block model-service-chat-output">{{
        chatOutput || (chatLoading ? '（生成中…）' : '（等待输出）')
      }}</pre>
    </section>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-service-chat-output {
  margin-top: 4px;
  min-height: 160px;
  max-height: 320px;
  overflow: auto;
}
</style>
