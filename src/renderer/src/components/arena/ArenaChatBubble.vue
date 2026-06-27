<script setup lang="ts">
import MarkdownContent from '@renderer/components/common/MarkdownContent.vue'
import type { CharacterChatMessage } from '@shared/arena/types'

withDefaults(
  defineProps<{
    message: CharacterChatMessage
    thinkingLabel?: string
    /** 助手回复是否按 Markdown 渲染 */
    markdown?: boolean
  }>(),
  {
    markdown: true,
  }
)

function isThinking(msg: CharacterChatMessage): boolean {
  return msg.role === 'assistant' && msg.streamStatus === 'pending'
}

function isStreaming(msg: CharacterChatMessage): boolean {
  return msg.role === 'assistant' && msg.streamStatus === 'streaming'
}
</script>

<template>
  <article
    class="arena-chat-bubble"
    :class="message.role === 'user' ? 'arena-chat-bubble--user' : 'arena-chat-bubble--assistant'"
  >
    <div v-if="isThinking(message)" class="arena-chat-bubble__thinking">
      <i></i><i></i><i></i>
      <span>{{ thinkingLabel || '思考中…' }}</span>
    </div>
    <div v-else-if="message.role === 'assistant' && markdown" class="arena-chat-bubble__body">
      <MarkdownContent v-if="message.content" :source="message.content" class="arena-chat-bubble__markdown" />
      <i v-if="isStreaming(message)" class="arena-chat-bubble__caret"></i>
    </div>
    <p v-else class="arena-chat-bubble__text">
      {{ message.content }}<i v-if="isStreaming(message)" class="arena-chat-bubble__caret"></i>
    </p>
  </article>
</template>

<style scoped>
.arena-chat-bubble {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 1.65;
}

.arena-chat-bubble--assistant {
  align-self: flex-start;
  background: rgba(112, 105, 255, 0.1);
  color: #26305e;
  border-bottom-left-radius: 4px;
}

.arena-chat-bubble--assistant:has(.arena-chat-bubble__thinking) {
  color: #766d99;
  background: rgba(112, 105, 255, 0.07);
}

.arena-chat-bubble--user {
  align-self: flex-end;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  color: #fff;
  border-bottom-right-radius: 4px;
}

.arena-chat-bubble__body {
  min-width: 0;
}

.arena-chat-bubble__text {
  margin: 0;
  white-space: pre-wrap;
}

.arena-chat-bubble__markdown :deep(.markdown-content) {
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.arena-chat-bubble__markdown :deep(.markdown-content__heading) {
  margin: 10px 0 6px;
  color: #1c255c;
  font-weight: 650;
}

.arena-chat-bubble__markdown :deep(h1.markdown-content__heading) {
  margin-top: 0;
  font-size: 1.15em;
}

.arena-chat-bubble__markdown :deep(h2.markdown-content__heading) {
  font-size: 1.05em;
}

.arena-chat-bubble__markdown :deep(h3.markdown-content__heading),
.arena-chat-bubble__markdown :deep(h4.markdown-content__heading),
.arena-chat-bubble__markdown :deep(h5.markdown-content__heading),
.arena-chat-bubble__markdown :deep(h6.markdown-content__heading) {
  font-size: 1em;
}

.arena-chat-bubble__markdown :deep(.markdown-content__paragraph) {
  margin: 0 0 8px;
  color: inherit;
}

.arena-chat-bubble__markdown :deep(.markdown-content__paragraph:last-child) {
  margin-bottom: 0;
}

.arena-chat-bubble__markdown :deep(.markdown-content__list) {
  margin: 0 0 8px 18px;
  color: inherit;
}

.arena-chat-bubble__markdown :deep(.markdown-content__list:last-child) {
  margin-bottom: 0;
}

.arena-chat-bubble__markdown :deep(.markdown-content__code) {
  margin: 0 0 8px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(42, 52, 107, 0.08);
  font-size: 12px;
}

.arena-chat-bubble__markdown :deep(.markdown-content__hr) {
  margin: 10px 0;
  border-top-color: rgba(130, 142, 207, 0.2);
}

.arena-chat-bubble__markdown :deep(code) {
  padding: 1px 5px;
  border-radius: 5px;
  background: rgba(42, 52, 107, 0.1);
  font-size: 0.92em;
}

.arena-chat-bubble__markdown :deep(a) {
  color: #4f46e5;
}

.arena-chat-bubble__caret {
  display: inline-block;
  width: 7px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -2px;
  border-right: 2px solid rgba(125, 92, 255, 0.5);
  animation: arenaChatCaret 760ms steps(1) infinite;
}

.arena-chat-bubble__thinking {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: #766d99;
  font-size: 13px;
}

.arena-chat-bubble__thinking i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #8a68ff;
  animation: arenaChatThinking 900ms ease-in-out infinite;
  flex: none;
}

.arena-chat-bubble__thinking i:nth-child(2) {
  animation-delay: 120ms;
}

.arena-chat-bubble__thinking i:nth-child(3) {
  animation-delay: 240ms;
}

@keyframes arenaChatCaret {
  0%,
  48% {
    opacity: 1;
  }
  49%,
  100% {
    opacity: 0;
  }
}

@keyframes arenaChatThinking {
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }
  40% {
    opacity: 1;
    transform: translateY(-3px);
  }
}
</style>
