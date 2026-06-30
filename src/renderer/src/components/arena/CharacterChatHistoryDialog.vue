<script setup lang="ts">

import { computed, nextTick, onMounted, ref, watch } from 'vue'

import { Loader2, MessageCircle } from 'lucide-vue-next'

import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'

import ArenaChatBubble from '@renderer/components/arena/ArenaChatBubble.vue'

import { characterAvatarByName } from '@renderer/data/arena-visual-assets'

import { characterChatService, formatUserMessage } from '@renderer/services/arena'

import type { Character, CharacterChatMessage } from '@shared/arena/types'



const show = defineModel<boolean>({ default: false })



const props = defineProps<{

  character: Character

}>()



const emit = defineEmits<{

  continueChat: []

}>()



const loading = ref(false)

const error = ref('')

const messages = ref<CharacterChatMessage[]>([])

const logRef = ref<HTMLElement | null>(null)



const avatar = computed(() =>

  characterAvatarByName(props.character.name, 0, props.character.modelId, props.character.avatarUrl)

)

const hasRealMessages = computed(() => messages.value.some((msg) => msg.id !== 'welcome'))

const historyLabel = computed(() =>

  hasRealMessages.value ? `${messages.value.filter((m) => m.id !== 'welcome').length} 条消息` : '暂无记录'

)



async function scrollToBottom() {

  await nextTick()

  const el = logRef.value

  if (el) el.scrollTop = el.scrollHeight

}



async function loadHistory() {

  loading.value = true

  error.value = ''

  try {

    const stored = await characterChatService.listMessages(props.character.id)

    messages.value = stored.length

      ? stored

      : [

          {

            id: 'welcome',

            role: 'assistant',

            content: `还没有与「${props.character.name}」的历史对话，点击下方继续对话开始交流。`,

            createdAt: new Date().toISOString(),

          },

        ]

    await scrollToBottom()

  } catch (err) {

    error.value = formatUserMessage(err)

  } finally {

    loading.value = false

  }

}



function onContinue() {

  show.value = false

  emit('continueChat')

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

    title="历史对话"

    :subtitle="`${character.name} · ${historyLabel}`"

    variant="preview"

    size="lg"

    height="min(76vh, 720px)"

    show-header-close
    show-footer

    footer-stack

  >

    <div class="chat-history-dialog__content">

      <div class="chat-history-dialog__identity">

        <img :src="avatar" alt="" />

      </div>



      <div ref="logRef" class="chat-history-dialog__log">

        <div v-if="loading" class="chat-history-dialog__loading">

          <Loader2 :size="20" class="spin" /> 加载对话记录…

        </div>

        <ArenaChatBubble

          v-for="msg in messages"

          :key="msg.id"

          :message="msg"

          thinking-label="正在组织回复…"

        />

      </div>



      <p v-if="error" class="chat-history-dialog__error">{{ error }}</p>

    </div>



    <template #footer>

      <div class="chat-history-dialog__actions">

        <button type="button" class="chat-history-dialog__continue" @click="onContinue">

          <MessageCircle :size="16" />

          继续对话

        </button>

      </div>

    </template>

  </ArenaDialogShell>

</template>



<style scoped>

.chat-history-dialog__content {

  display: flex;

  flex-direction: column;

  min-height: 0;

  height: 100%;

}



.chat-history-dialog__identity {

  padding-bottom: 12px;

}



.chat-history-dialog__identity img {

  width: 44px;

  height: 44px;

  border-radius: 14px;

  object-fit: cover;

}



.chat-history-dialog__log {

  flex: 1 1 auto;

  min-height: 0;

  overflow: auto;

  display: flex;

  flex-direction: column;

  gap: 10px;

}



.chat-history-dialog__loading {

  display: flex;

  align-items: center;

  gap: 8px;

  color: #7a85b0;

  font-size: 13px;

}



.chat-history-dialog__error {

  margin: 8px 0 0;

  color: #c2410c;

  font-size: 12px;

}



.chat-history-dialog__actions {

  display: grid;

  gap: 10px;

}



.chat-history-dialog__continue {

  display: inline-flex;

  align-items: center;

  justify-content: center;

  gap: 8px;

  width: 100%;

  min-height: 44px;

  border: 0;

  border-radius: 14px;

  background: linear-gradient(135deg, #8b84ff, #5b57f3);

  color: #fff;

  font: inherit;

  font-size: 14px;

  font-weight: 600;

  cursor: pointer;

}



.chat-history-dialog__continue:hover {

  filter: brightness(1.04);

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


