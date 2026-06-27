<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { Loader2, Send, Trash2, X } from 'lucide-vue-next'
import ArenaChatBubble from '@renderer/components/arena/ArenaChatBubble.vue'
import { modeImageById } from '@renderer/data/arena-visual-assets'
import { formatUserMessage, gameModeQAService } from '@renderer/services/arena'
import type { CharacterChatMessage, GameMode } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  mode: GameMode
}>()

const input = ref('')
const sending = ref(false)
const loading = ref(false)
const error = ref('')
const messages = ref<CharacterChatMessage[]>([])
const logRef = ref<HTMLElement | null>(null)

const canSend = computed(() => input.value.trim().length > 0 && !sending.value)
const suggestions = [
  '这个玩法怎么赢？',
  '各身份技能有什么区别？',
  '警长/主持人有什么作用？',
  '一局典型流程是怎样的？',
]

async function scrollToBottom() {
  await nextTick()
  const el = logRef.value
  if (el) el.scrollTop = el.scrollHeight
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    messages.value = await gameModeQAService.listMessages(props.mode.id)
    if (!messages.value.length) {
      messages.value = [
        {
          id: 'welcome',
          role: 'assistant',
          content: `你好，我是「${props.mode.name}」玩法答疑助手。可以问我规则、身份技能、流程阶段等任何问题。`,
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

async function send(question?: string) {
  const text = (question ?? input.value).trim()
  if (!text || sending.value) return
  input.value = ''
  sending.value = true
  error.value = ''
  try {
    const result = await gameModeQAService.askStream(props.mode.id, text, (next) => {
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

async function clearChat() {
  if (!window.confirm('确定清空本玩法的答疑记录吗？')) return
  await gameModeQAService.clearMessages(props.mode.id)
  messages.value = [
    {
      id: 'welcome',
      role: 'assistant',
      content: `你好，我是「${props.mode.name}」玩法答疑助手。可以问我规则、身份技能、流程阶段等任何问题。`,
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
    <div v-if="show" class="qa-overlay" @click.self="show = false">
      <div class="qa-dialog" role="dialog" aria-label="玩法答疑">
        <header class="qa-header">
          <div class="qa-identity">
            <img :src="modeImageById(mode.id)" alt="" />
            <div>
              <strong>{{ mode.name }} · 答疑</strong>
              <span>基于官方玩法文档回答你的问题</span>
            </div>
          </div>
          <div class="qa-header-actions">
            <button type="button" title="清空" @click="clearChat"><Trash2 :size="16" /></button>
            <button type="button" title="关闭" @click="show = false"><X :size="18" /></button>
          </div>
        </header>

        <div ref="logRef" class="qa-log">
          <div v-if="loading" class="qa-loading"><Loader2 :size="20" class="spin" /> 加载中…</div>
          <ArenaChatBubble
            v-for="msg in messages"
            :key="msg.id"
            :message="msg"
            thinking-label="正在查阅玩法文档…"
          />
        </div>

        <div v-if="messages.length <= 1" class="qa-suggestions">
          <button v-for="s in suggestions" :key="s" type="button" @click="send(s)">{{ s }}</button>
        </div>

        <p v-if="error" class="qa-error">{{ error }}</p>

        <footer class="qa-footer">
          <textarea
            v-model="input"
            rows="2"
            placeholder="例如：预言家什么时候该跳身份？"
            :disabled="sending"
            @keydown.enter.exact.prevent="send()"
          />
          <button type="button" class="send-btn" :disabled="!canSend" @click="send()">
            <Loader2 v-if="sending" :size="18" class="spin" />
            <Send v-else :size="18" />
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.qa-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(15, 18, 42, 0.42);
  backdrop-filter: blur(6px);
}

.qa-dialog {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto auto;
  width: min(560px, 100%);
  height: min(72vh, 680px);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 32px 80px rgba(50, 56, 120, 0.22);
  overflow: hidden;
}

.qa-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.qa-identity {
  display: flex;
  align-items: center;
  gap: 12px;
}

.qa-identity img {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  object-fit: cover;
}

.qa-identity strong {
  display: block;
  color: #17205a;
  font-size: 16px;
}

.qa-identity span {
  color: #7a85b0;
  font-size: 12px;
}

.qa-header-actions {
  display: flex;
  gap: 6px;
}

.qa-header-actions button {
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

.qa-log {
  overflow: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.qa-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #7a85b0;
  font-size: 13px;
}

.qa-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 18px 10px;
}

.qa-suggestions button {
  padding: 6px 10px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 999px;
  background: #fff;
  color: #5b57f3;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.qa-error {
  margin: 0;
  padding: 0 18px 8px;
  color: #c2410c;
  font-size: 12px;
}

.qa-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px;
  gap: 10px;
  padding: 14px 18px 18px;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.qa-footer textarea {
  resize: none;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 14px;
  font: inherit;
  font-size: 14px;
  line-height: 1.5;
  outline: none;
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
