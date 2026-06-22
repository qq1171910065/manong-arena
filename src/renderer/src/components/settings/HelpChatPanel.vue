<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageSquare, Send } from 'lucide-vue-next'
import { askHelpAssistant } from '@renderer/services/help-assistant'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NInput, NSpace } from '../../ui'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  sectionTitle?: string
  suggestions?: string[]
}

const input = ref('')
const sending = ref(false)
const messages = ref<ChatMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    text: '你好，我是帮助助手。你可以问我关于角色、对局、模型服务、钱包充值等问题，我会基于项目文档回答。',
    suggestions: ['模型无法回复怎么办？', '如何充值？', '对局怎么创建？'],
  },
])

const canSend = computed(() => input.value.trim().length > 0 && !sending.value)

function pushMessage(message: ChatMessage) {
  messages.value = [...messages.value, message]
}

async function sendQuestion(question?: string) {
  const text = (question ?? input.value).trim()
  if (!text || sending.value) return

  input.value = ''
  pushMessage({ id: `u-${Date.now()}`, role: 'user', text })
  sending.value = true

  await new Promise((resolve) => setTimeout(resolve, 180))

  const reply = askHelpAssistant(text)
  pushMessage({
    id: `a-${Date.now()}`,
    role: 'assistant',
    text: reply.answer,
    sectionTitle: reply.sectionTitle,
    suggestions: reply.suggestions,
  })
  sending.value = false
}
</script>

<template>
  <ProfileSectionLayout
    title="帮助中心"
    desc="对话式问答，基于项目文档智能匹配相关说明。"
  >
    <NCard class="mntools-panel help-chat-card">
      <div class="help-chat-log">
        <div
          v-for="item in messages"
          :key="item.id"
          class="help-chat-message"
          :class="`help-chat-message--${item.role}`"
        >
          <div class="help-chat-message__bubble">
            <p v-if="item.sectionTitle" class="help-chat-message__section">
              参考：{{ item.sectionTitle }}
            </p>
            <p class="help-chat-message__text">{{ item.text }}</p>
            <NSpace v-if="item.suggestions?.length" :size="6" class="help-chat-message__suggestions">
              <NButton
                v-for="suggestion in item.suggestions"
                :key="suggestion"
                size="tiny"
                quaternary
                @click="sendQuestion(suggestion)"
              >
                {{ suggestion }}
              </NButton>
            </NSpace>
          </div>
        </div>
      </div>

      <div class="help-chat-input">
        <NInput
          v-model:value="input"
          type="textarea"
          :rows="2"
          placeholder="描述你的问题，例如：模型无法回复怎么办？"
          :disabled="sending"
          @keydown.enter.exact.prevent="sendQuestion()"
        />
        <NButton type="primary" :disabled="!canSend" :loading="sending" @click="sendQuestion()">
          <template #icon><Send :size="14" /></template>
          发送
        </NButton>
      </div>
    </NCard>

    <NCard class="mntools-panel help-chat-tip" title="提示">
      <p class="text-muted">
        <MessageSquare :size="14" style="vertical-align: -2px" />
        如需查看完整说明，请前往「项目文档」Tab。复杂问题可在「报 Bug」中提交反馈。
      </p>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.help-chat-card :deep(.n-card__content) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.help-chat-log {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 420px;
  overflow: auto;
  padding-right: 4px;
}

.help-chat-message {
  display: flex;
}

.help-chat-message--user {
  justify-content: flex-end;
}

.help-chat-message__bubble {
  max-width: min(640px, 92%);
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(130, 142, 207, 0.14);
}

.help-chat-message--user .help-chat-message__bubble {
  background: rgba(98, 92, 240, 0.12);
  border-color: rgba(98, 92, 240, 0.18);
}

.help-chat-message__section {
  margin: 0 0 6px;
  color: #625cf0;
  font-size: 12px;
}

.help-chat-message__text {
  margin: 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.help-chat-message__suggestions {
  margin-top: 8px;
}

.help-chat-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  align-items: end;
}

.help-chat-tip p {
  margin: 0;
  font-size: 13px;
}
</style>
