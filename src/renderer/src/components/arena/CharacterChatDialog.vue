<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Loader2, Trash2 } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
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
const hasUserMessages = computed(() => messages.value.some((msg) => msg.role === 'user'))
const showSuggestions = computed(() => !hasUserMessages.value && !sending.value && !loading.value)

const suggestions = computed(() => {
  const char = props.character
  const items = [
    `你好，${char.name}！`,
    '跟我聊聊你自己吧',
    '你最近在忙什么？',
  ]
  if (char.subtitle.trim()) {
    items.push(`关于「${char.subtitle.length > 14 ? `${char.subtitle.slice(0, 14)}…` : char.subtitle}」`)
  } else if (char.tags[0]) {
    items.push(`你的「${char.tags[0]}」体现在哪？`)
  } else {
    items.push('有什么想对我说的吗？')
  }
  return items.slice(0, 4)
})

async function scrollToBottom() {
  await nextTick()
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    const session = await characterChatService.prepareChatSession(props.character.id)
    messages.value = session.messages.length
      ? session.messages
      : [
          {
            id: 'welcome',
            role: 'assistant',
            content: `你好，我是${props.character.name}。想聊什么？`,
            createdAt: new Date().toISOString(),
          },
        ]
    if (session.growthApplied) {
      emit('updated', session.character)
    }
    await scrollToBottom()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function send(text?: string) {
  const content = (text ?? input.value).trim()
  if (!content || sending.value) return
  input.value = ''
  sending.value = true
  error.value = ''
  try {
    const result = await characterChatService.sendMessageStream(props.character.id, content, (next) => {
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

function onInputKeydown(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  if (!canSend.value) return
  void send()
}

async function clearChat() {
  if (!(await confirm({
    title: '开启新会话',
    message: `确定结束当前与「${props.character.name}」的会话并重新开始吗？`,
    detail: '本次会话将根据对话内容沉淀一次成长记录。',
    tone: 'warning',
    confirmText: '新会话',
  }))) return
  const result = await characterChatService.startNewSession(props.character.id)
  messages.value = [
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好，我是${props.character.name}。想聊什么？`,
      createdAt: new Date().toISOString(),
    },
  ]
  if (result.growthApplied) {
    emit('updated', result.character)
  }
}

watch(show, (open) => {
  if (open) void loadHistory()
})

onMounted(() => {
  if (show.value) void loadHistory()
})
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    :title="`与 ${character.name} 对话`"
    variant="form"
    :mask-closable="false"
    height="min(72vh, 680px)"
    body-flush
    show-footer
    footer-stack
  >
    <div class="chat-dialog__content">
      <div class="chat-identity">
        <img :src="avatar" alt="" />
        <p>私下对话 · 换日或新会话后沉淀成长</p>
      </div>

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
    </div>

    <template #footer>
      <div class="chat-footer">
        <div v-if="showSuggestions" class="chat-suggestions">
          <button
            v-for="item in suggestions"
            :key="item"
            type="button"
            :disabled="sending"
            @click="send(item)"
          >
            {{ item }}
          </button>
        </div>
        <div class="chat-input-wrap" :class="{ 'is-sending': sending }">
          <textarea
            v-model="input"
            rows="2"
            placeholder="输入消息… Enter 发送，Shift + Enter 换行"
            :disabled="sending"
            @keydown="onInputKeydown"
          />
          <p v-if="sending" class="chat-input-status">
            <Loader2 :size="14" class="spin" />
            等待回复…
          </p>
        </div>
        <div class="chat-footer-bar">
          <button type="button" class="chat-footer-bar__secondary" title="开启新会话" @click="clearChat">
            <Trash2 :size="16" />
            新会话
          </button>
          <button type="button" class="arena-dialog__btn" @click="show = false">关闭</button>
        </div>
      </div>
    </template>
  </ArenaDialogShell>
</template>

<style scoped>
.chat-dialog__content {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.chat-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 18px;
  border-bottom: 1px solid rgba(130, 142, 207, 0.1);
}

.chat-identity img {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
}

.chat-identity p {
  margin: 0;
  color: #7a85b0;
  font-size: 12px;
  line-height: 1.5;
}

.chat-log {
  flex: 1 1 auto;
  min-height: 0;
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
  gap: 10px;
  width: 100%;
}

.chat-footer-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chat-footer-bar__secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #5e68a0;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.chat-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chat-suggestions button {
  padding: 6px 10px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 999px;
  background: #fff;
  color: #5b57f3;
  font: inherit;
  font-size: 12px;
  line-height: 1.35;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.chat-suggestions button:hover:not(:disabled) {
  background: rgba(91, 87, 243, 0.06);
  border-color: rgba(91, 87, 243, 0.28);
}

.chat-suggestions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.chat-input-wrap {
  position: relative;
}

.chat-input-wrap textarea {
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
}

.chat-input-wrap textarea:focus {
  border-color: rgba(91, 87, 243, 0.45);
}

.chat-input-wrap.is-sending textarea {
  opacity: 0.72;
}

.chat-input-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 2px 0;
  color: #7a85b0;
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
