<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Loader2, SquarePen } from 'lucide-vue-next'
import ArenaChatBubble from '@renderer/components/arena/ArenaChatBubble.vue'
import { formatUserMessage } from '@renderer/services/arena'
import { createHelpWelcomeMessage, helpChatService } from '@renderer/services/help-chat-service'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton } from '../../ui'
import type { CharacterChatMessage } from '@shared/arena/types'

const input = ref('')
const sending = ref(false)
const loading = ref(false)
const error = ref('')
const logRef = ref<HTMLElement | null>(null)
const messages = ref<CharacterChatMessage[]>([])

const canSend = computed(() => input.value.trim().length > 0 && !sending.value && !loading.value)

async function scrollToBottom() {
  await nextTick()
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    const stored = await helpChatService.listMessages()
    messages.value = stored.length ? stored : [createHelpWelcomeMessage()]
    await scrollToBottom()
  } catch (err) {
    error.value = formatUserMessage(err)
    messages.value = [createHelpWelcomeMessage()]
  } finally {
    loading.value = false
  }
}

async function startNewConversation() {
  if (sending.value) return
  input.value = ''
  error.value = ''
  await helpChatService.clearMessages()
  messages.value = [createHelpWelcomeMessage()]
  await scrollToBottom()
}

async function sendQuestion() {
  const text = input.value.trim()
  if (!text || sending.value || loading.value) return

  input.value = ''
  sending.value = true
  error.value = ''

  try {
    const result = await helpChatService.askStream(text, (next) => {
      messages.value = next
      void scrollToBottom()
    })
    messages.value = result.messages
    await scrollToBottom()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    sending.value = false
  }
}

function onInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  if (!canSend.value) return
  void sendQuestion()
}

onMounted(() => {
  void loadHistory()
})
</script>

<template>
  <ProfileSectionLayout title="帮助中心" class="help-chat-section">
    <template #actions>
      <NButton quaternary size="small" :disabled="sending || loading" @click="startNewConversation">
        <template #icon><SquarePen :size="14" /></template>
        新问题
      </NButton>
    </template>

    <div class="help-chat-window">
      <div ref="logRef" class="help-chat-log">
        <div v-if="loading" class="help-chat-loading">
          <Loader2 :size="18" class="spin" />
          加载会话…
        </div>
        <ArenaChatBubble
          v-for="item in messages"
          :key="item.id"
          :message="item"
          thinking-label="正在查阅项目文档…"
        />
      </div>

      <p v-if="error" class="help-chat-error">{{ error }}</p>

      <div class="help-chat-input" :class="{ 'is-sending': sending }">
        <textarea
          v-model="input"
          rows="2"
          placeholder="输入你的问题… Enter 发送，Shift + Enter 换行"
          :disabled="sending || loading"
          @keydown="onInputKeydown"
        />
        <p v-if="sending" class="help-chat-input-status">
          <Loader2 :size="14" class="spin" />
          正在回复…
        </p>
      </div>
    </div>
  </ProfileSectionLayout>
</template>

<style scoped>
.help-chat-section {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.help-chat-section :deep(.profile-section) {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
}

.help-chat-section :deep(.profile-section__body) {
  flex: 1 1 0;
  min-height: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.help-chat-window {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--profile-head-border);
  background: color-mix(in srgb, var(--surface) 42%, transparent);
}

.help-chat-log {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px var(--profile-body-padding-inline);
}

.help-chat-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
  font-size: var(--text-sm);
}

.help-chat-error {
  margin: 0;
  padding: 0 var(--profile-body-padding-inline) 8px;
  color: #c2410c;
  font-size: var(--text-xs);
}

.help-chat-input {
  flex-shrink: 0;
  padding: 14px var(--profile-body-padding-inline) var(--profile-body-padding-block);
  border-top: 1px solid var(--profile-head-border);
  background: color-mix(in srgb, var(--surface) 62%, transparent);
}

.help-chat-input textarea {
  display: block;
  width: 100%;
  min-height: 72px;
  max-height: 220px;
  resize: vertical;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 14px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.72);
}

.help-chat-input textarea:focus {
  border-color: rgba(91, 87, 243, 0.45);
}

.help-chat-input.is-sending textarea {
  opacity: 0.72;
}

.help-chat-input-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
