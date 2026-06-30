<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ExternalLink, FileText, FolderOpen, Trash2 } from 'lucide-vue-next'
import { confirm } from '@renderer/composables/useAppDialog'
import { characterAgentService, formatUserMessage } from '@renderer/services/arena'
import DetailRegionEmpty from './DetailRegionEmpty.vue'
import type { CharacterWorkspaceFile } from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'

const props = defineProps<{ character: Character; embedded?: boolean }>()
const emit = defineEmits<{ updated: [] }>()

const loading = ref(true)
const busy = ref(false)
const error = ref('')
const files = ref<CharacterWorkspaceFile[]>([])
const selected = ref<CharacterWorkspaceFile | null>(null)
const editorName = ref('')
const editorContent = ref('')
const editorDescription = ref('')

onMounted(() => void refresh())

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    files.value = await characterAgentService.listWorkspaceFiles(props.character.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
    emit('updated')
  }
}

async function openFile(file: CharacterWorkspaceFile) {
  busy.value = true
  error.value = ''
  try {
    const content = await characterAgentService.readWorkspaceFile(props.character.id, file.relativePath)
    selected.value = file
    editorName.value = file.name
    editorContent.value = content
    editorDescription.value = file.description || ''
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function saveFile() {
  if (!editorName.value.trim()) {
    error.value = '文件名不能为空'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.writeWorkspaceFile(props.character.id, {
      id: selected.value?.id,
      relativePath: selected.value?.relativePath,
      name: editorName.value.trim(),
      content: editorContent.value,
      description: editorDescription.value.trim() || undefined,
    })
    selected.value = saved
    await refresh()
    emit('updated')
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function removeFile(file: CharacterWorkspaceFile) {
  if (!(await confirm({
    title: '删除文件',
    message: `确定删除「${file.name}」吗？`,
    tone: 'danger',
    confirmText: '删除',
  }))) return
  busy.value = true
  error.value = ''
  try {
    files.value = await characterAgentService.deleteWorkspaceFile(props.character.id, file.relativePath)
    if (selected.value?.id === file.id) {
      selected.value = null
      editorName.value = ''
      editorContent.value = ''
      editorDescription.value = ''
    }
    emit('updated')
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function openFolder() {
  try {
    await characterAgentService.openWorkspaceDir(props.character.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}
</script>

<template>
  <section class="agent-panel">
    <header class="agent-panel__head" :class="{ 'agent-panel__head--toolbar': embedded }">
      <h3 v-if="!embedded"><FolderOpen :size="16" /> 文件空间</h3>
      <div class="agent-panel__actions">
        <button type="button" class="agent-btn" @click="openFolder"><ExternalLink :size="14" /> 打开目录</button>
      </div>
    </header>

    <div
      class="workspace-layout"
      :class="{ 'workspace-layout--editor': selected || editorName }"
    >
      <aside class="workspace-list">
        <p v-if="loading" class="agent-empty">加载中…</p>
        <button
          v-for="file in files"
          :key="file.id"
          type="button"
          class="workspace-file"
          :class="{ active: selected?.id === file.id }"
          @click="openFile(file)"
        >
          <FileText :size="14" />
          <div>
            <strong>{{ file.name }}</strong>
            <span>{{ formatSize(file.sizeBytes) }}</span>
          </div>
          <button type="button" class="workspace-file__delete" @click.stop="removeFile(file)">
            <Trash2 :size="12" />
          </button>
        </button>
        <DetailRegionEmpty
          v-if="!loading && !files.length"
          title="暂无文件"
          description="可通过与角色对话写入文件"
          :icon="FolderOpen"
          hint=""
        />
      </aside>

      <div v-if="editorName || selected" class="workspace-editor">
        <input v-model="editorName" type="text" placeholder="文件名，如 notes.md" />
        <input v-model="editorDescription" type="text" placeholder="文件说明（可选）" />
        <textarea v-model="editorContent" rows="12" placeholder="在此编写角色专属资料…" />
        <div class="workspace-editor__actions">
          <button type="button" class="agent-btn primary" :disabled="busy" @click="saveFile">保存文件</button>
        </div>
      </div>
    </div>

    <p v-if="error" class="agent-error">{{ error }}</p>
  </section>
</template>

<style scoped>
.agent-panel {
  display: grid;
  gap: 12px;
}

.agent-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.agent-panel__head--toolbar {
  justify-content: flex-end;
}

.agent-panel__head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #17205a;
}

.agent-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.workspace-layout {
  display: grid;
  gap: 12px;
  min-height: 280px;
}

.workspace-layout--editor {
  grid-template-columns: minmax(180px, 240px) 1fr;
}

.workspace-list {
  display: grid;
  gap: 6px;
  align-content: start;
}

.workspace-file {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 8px 10px;
  border: 1px solid rgba(112, 105, 255, 0.12);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.55);
  text-align: left;
  cursor: pointer;
}

.workspace-file.active {
  border-color: rgba(91, 87, 243, 0.45);
  background: rgba(112, 105, 255, 0.08);
}

.workspace-file strong {
  display: block;
  font-size: 12px;
  color: #17205a;
}

.workspace-file span {
  font-size: 10px;
  color: #7a85b0;
}

.workspace-file__delete {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.workspace-editor {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(112, 105, 255, 0.16);
  display: grid;
  gap: 8px;
}

.workspace-editor input,
.workspace-editor textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(112, 105, 255, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  font: inherit;
}

.workspace-editor textarea {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  resize: vertical;
}

.workspace-editor__actions {
  display: flex;
  justify-content: flex-end;
}

.agent-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 10px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.agent-btn.primary {
  background: linear-gradient(135deg, #7069ff, #5b57f3);
  color: #fff;
}

.agent-empty {
  margin: 0;
  color: #7a85b0;
  font-size: 12px;
}

.agent-error {
  margin: 0;
  color: #dc2626;
  font-size: 12px;
}

@media (max-width: 860px) {
  .workspace-layout--editor {
    grid-template-columns: 1fr;
  }
}
</style>
