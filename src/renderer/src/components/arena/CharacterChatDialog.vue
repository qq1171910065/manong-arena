<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Loader2, Send, Trash2, X } from 'lucide-vue-next'
import ArenaChatBubble from '@renderer/components/arena/ArenaChatBubble.vue'
import { characterAvatarByName } from '@renderer/data/arena-visual-assets'
import { confirm } from '@renderer/composables/useAppDialog'
import { characterChatService, formatUserMessage } from '@renderer/services/arena'
import type { Character, CharacterChatMessage } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
}>()

const emit = defineEmits<{
  updated: [Character]
}>()

const input = ref('')
const sending = ref(false)
const loading = ref(false)
const error = ref('')
const messages = ref<CharacterChatMessage[]>([])
const logRef = ref<HTMLElement | null>(null)

const canSend = computed(() => input.value.trim().length > 0 && !sending.value)
const avatar = computed(() => characterAvatarByName(props.character.name, 0, props.character.modelId, props.character.avatarUrl))

async function scrollToBottom() {
  await nextTick()
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    messages.value = await characterChatService.listMessages(props.character.id)
    if (!messages.value.length) {
      messages.value = [
        {
          id: 'welcome',
          role: 'assistant',
          content: `你好，我是${props.character.name}。想聊什么？`,
          createdAt: new Date().toISOString(),
        },
      ]
    }
    await scrollToBottom()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function send() {
  const text = input.value.trim()
  if (!text || sending.value) return
  input.value = ''
  sending.value = true
  error.value = ''
  try {
    const result = await characterChatService.sendMessageStream(props.character.id, text, (next) => {
      messages.value = next
      void scrollToBottom()
    })
    messages.value = result.messages
    emit('updated', result.character)
    await scrollToBottom()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    sending.value = false
  }
}

async function clearChat() {
  if (!(await confirm({
    title: '清空对话',
    message: `确定清空与「${props.character.name}」的对话记录吗？`,
    tone: 'warning',
    confirmText: '清空',
  }))) return
  await characterChatService.clearMessages(props.character.id)
  messages.value = [
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好，我是${props.character.name}。想聊什么？`,
      createdAt: new Date().toISOString(),
    },
  ]
}

watch(show, (open) => {
  if (open) void loadHistory()
})

onMounted(() => {
  if (show.value) void loadHistory()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="chat-overlay" @click.self="show = false">
      <div class="chat-dialog" role="dialog" aria-label="与角色对话">
        <header class="chat-header">
          <div class="chat-identity">
            <img :src="avatar" alt="" />
            <div>
              <strong>{{ character.name }}</strong>
              <span>私下对话 · 角色会在交流中成长</span>
            </div>
          </div>
          <div class="chat-header-actions">
            <button type="button" title="清空对话" @click="clearChat"><Trash2 :size="16" /></button>
            <button type="button" title="关闭" @click="show = false"><X :size="18" /></button>
          </div>
        </header>

        <div ref="logRef" class="chat-log">
          <div v-if="loading" class="chat-loading"><Loader2 :size="20" class="spin" /> 加载对话…</div>
          <ArenaChatBubble
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            thinking-label="正在组织回复…"
          />
        </div>

        <p v-if="error" class="chat-error">{{ error }}</p>

        <footer class="chat-footer">
          <textarea
            v-model="input"
            rows="2"
            placeholder="和 TA 说点什么…"
            :disabled="sending"
            @keydown.enter.exact.prevent="send"
          />
          <button type="button" class="send-btn" :disabled="!canSend" @click="send">
            <Loader2 v-if="sending" :size="18" class="spin" />
            <Send v-else :size="18" />
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chat-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 18, 42, 0.42);
  backdrop-filter: blur(6px);
}

.chat-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  width: min(560px, 100%);
  height: min(72vh, 680px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 32px 80px rgba(50, 56, 120, 0.22);
  overflow: hidden;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.chat-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-identity img {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
}

.chat-identity strong {
  display: block;
  color: #17205a;
  font-size: 16px;
}

.chat-identity span {
  color: #7a85b0;
  font-size: 12px;
}

.chat-header-actions {
  display: flex;
  gap: 6px;
}

.chat-header-actions button {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: 10px;
  background: rgba(130, 142, 207, 0.1);
  color: #5e68a0;
  cursor: pointer;
}

.chat-log {
  overflow: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chat-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7a85b0;
  font-size: 13px;
}

.chat-error {
  margin: 0;
  padding: 0 18px 8px;
  color: #c2410c;
  font-size: 12px;
}

.chat-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 10px;
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.chat-footer textarea {
  resize: none;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 14px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
}

.chat-footer textarea:focus {
  border-color: rgba(91, 87, 243, 0.45);
}

.send-btn {
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  color: #fff;
  cursor: pointer;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
