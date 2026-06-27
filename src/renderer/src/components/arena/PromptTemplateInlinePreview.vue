<script setup lang="ts">
import type { PromptTemplate } from '@shared/arena/game-scenario'

defineProps<{
  template: PromptTemplate
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <button type="button" class="prompt-inline-preview" @click="emit('edit')">
    <div class="prompt-inline-preview__block">
      <span class="prompt-inline-preview__label">System</span>
      <pre>{{ template.systemTemplate }}</pre>
    </div>
    <div v-if="template.userTemplate" class="prompt-inline-preview__block">
      <span class="prompt-inline-preview__label">User</span>
      <pre>{{ template.userTemplate }}</pre>
    </div>
  </button>
</template>

<style scoped>
.prompt-inline-preview {
  display: block;
  width: 100%;
  padding: 12px;
  border: 1px solid transparent;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.42);
  text-align: left;
  cursor: pointer;
  font: inherit;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.prompt-inline-preview:hover {
  border-color: rgba(130, 142, 207, 0.2);
  background: rgba(255, 255, 255, 0.58);
}

.prompt-inline-preview__block + .prompt-inline-preview__block {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(130, 142, 207, 0.1);
}

.prompt-inline-preview__label {
  display: block;
  margin-bottom: 6px;
  color: #8b95bd;
  font-size: 11px;
  font-weight: 650;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.prompt-inline-preview pre {
  margin: 0;
  color: #3a4578;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
