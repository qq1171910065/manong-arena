<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { FileText } from 'lucide-vue-next'
import { characterAgentService } from '@renderer/services/arena'
import CharacterWorkspaceFileViewDialog from './CharacterWorkspaceFileViewDialog.vue'
import type { CharacterWorkspaceFile } from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'

const PREVIEW_MAX_LINES = 6
const PREVIEW_MAX_CHARS = 480

const props = defineProps<{ character: Character }>()

const files = ref<CharacterWorkspaceFile[]>([])
const previewContent = ref('')
const loading = ref(true)
const viewOpen = ref(false)

const previewFile = computed(() => files.value[0] ?? null)
const extraFileCount = computed(() => Math.max(0, files.value.length - 1))

const displayContent = computed(() => {
  const text = previewContent.value.trim()
  if (!text) return '（空文件）'
  const lines = text.split('\n')
  if (lines.length <= PREVIEW_MAX_LINES && text.length <= PREVIEW_MAX_CHARS) return text
  const byLines = lines.slice(0, PREVIEW_MAX_LINES).join('\n')
  if (byLines.length <= PREVIEW_MAX_CHARS) return byLines
  return `${text.slice(0, PREVIEW_MAX_CHARS).trimEnd()}…`
})

const isTruncated = computed(() => {
  const text = previewContent.value.trim()
  if (!text) return false
  if (text.split('\n').length > PREVIEW_MAX_LINES) return true
  return text.length > PREVIEW_MAX_CHARS
})

onMounted(async () => {
  await refresh()
})

async function refresh() {
  loading.value = true
  previewContent.value = ''
  try {
    files.value = await characterAgentService.listWorkspaceFiles(props.character.id)
    const file = files.value[0]
    if (!file) return
    previewContent.value = await characterAgentService.readWorkspaceFile(props.character.id, file.relativePath)
  } catch {
    files.value = []
    previewContent.value = ''
  } finally {
    loading.value = false
  }
}

function openFullView() {
  if (!isTruncated.value || !previewFile.value) return
  viewOpen.value = true
}

defineExpose({ refresh })
</script>

<template>
  <div class="workspace-preview">
    <p v-if="loading" class="workspace-preview__loading">加载中…</p>
    <template v-else-if="previewFile">
      <header class="workspace-preview__head">
        <span class="workspace-preview__name"><FileText :size="13" /> {{ previewFile.name }}</span>
        <span v-if="extraFileCount" class="workspace-preview__more">还有 {{ extraFileCount }} 个文件</span>
      </header>
      <button
        type="button"
        class="workspace-preview__content"
        :class="{ 'workspace-preview__content--truncated': isTruncated }"
        :disabled="!isTruncated"
        data-no-edit
        @click.stop="openFullView"
      >
        <pre>{{ displayContent }}</pre>
        <span v-if="isTruncated" class="workspace-preview__expand">点击查看全文</span>
      </button>
    </template>

    <CharacterWorkspaceFileViewDialog
      v-model="viewOpen"
      :file="previewFile"
      :content="previewContent"
    />
  </div>
</template>

<style scoped>
.workspace-preview {
  display: grid;
  gap: 8px;
  min-height: 72px;
}

.workspace-preview__loading {
  margin: 0;
  padding: 16px 0;
  color: #9aa3c7;
  font-size: 12px;
  text-align: center;
}

.workspace-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.workspace-preview__name {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #17205a;
  font-size: 12px;
  font-weight: 650;
}

.workspace-preview__more {
  color: #9aa3c7;
  font-size: 11px;
  white-space: nowrap;
}

.workspace-preview__content {
  display: block;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(130, 142, 207, 0.1);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  text-align: left;
  font: inherit;
}

.workspace-preview__content--truncated {
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.workspace-preview__content--truncated:hover {
  border-color: rgba(91, 87, 243, 0.22);
  background: rgba(255, 255, 255, 0.72);
}

.workspace-preview__content:disabled {
  cursor: default;
}

.workspace-preview__content pre {
  margin: 0;
  color: #59649b;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
  overflow: hidden;
}

.workspace-preview__expand {
  display: block;
  margin-top: 8px;
  color: #5b57f3;
  font-size: 11px;
  font-weight: 600;
}
</style>
