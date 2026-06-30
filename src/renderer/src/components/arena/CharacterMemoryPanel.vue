<script setup lang="ts">
import { computed, ref } from 'vue'
import { Brain, Pin, Plus, Trash2 } from 'lucide-vue-next'
import ArenaSelect from '@renderer/components/common/ArenaSelect.vue'
import { confirm } from '@renderer/composables/useAppDialog'
import { characterAgentService, formatUserMessage } from '@renderer/services/arena'
import DetailRegionEmpty from './DetailRegionEmpty.vue'
import {
  MEMORY_CATEGORY_LABELS,
  normalizeAgentMemories,
  type CharacterMemoryCategory,
  type CharacterMemoryEntry,
} from '@shared/arena/character-agent'
import type { Character } from '@shared/arena/types'

const props = defineProps<{ character: Character; embedded?: boolean }>()
const emit = defineEmits<{ updated: [Character] }>()

const busy = ref(false)
const error = ref('')
const filterCategory = ref<CharacterMemoryCategory | 'all'>('all')
const editing = ref<CharacterMemoryEntry | null>(null)

const memories = computed(() => normalizeAgentMemories(props.character.agentMemories))

const filteredMemories = computed(() => {
  if (filterCategory.value === 'all') return memories.value
  return memories.value.filter((item) => item.category === filterCategory.value)
})

const categoryOptions = [
  { label: '全部', value: 'all' },
  ...Object.entries(MEMORY_CATEGORY_LABELS).map(([value, label]) => ({ label, value })),
]

const importanceOptions = [
  { label: '低', value: 1 },
  { label: '中', value: 2 },
  { label: '高', value: 3 },
]

function startCreate() {
  editing.value = characterAgentService.createMemory()
}

function startEdit(entry: CharacterMemoryEntry) {
  editing.value = { ...entry }
}

function cancelEdit() {
  editing.value = null
}

async function saveEdit() {
  if (!editing.value?.content.trim()) {
    error.value = '记忆内容不能为空'
    return
  }
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.upsertMemory(props.character, editing.value)
    emit('updated', saved)
    editing.value = null
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function togglePin(entry: CharacterMemoryEntry) {
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.upsertMemory(props.character, { ...entry, pinned: !entry.pinned })
    emit('updated', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}

async function remove(entry: CharacterMemoryEntry) {
  if (!(await confirm({
    title: '删除记忆',
    message: '确定删除这条长期记忆吗？',
    tone: 'danger',
    confirmText: '删除',
  }))) return
  busy.value = true
  error.value = ''
  try {
    const saved = await characterAgentService.deleteMemory(props.character, entry.id)
    emit('updated', saved)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="agent-panel">
    <header class="agent-panel__head" :class="{ 'agent-panel__head--toolbar': embedded }">
      <h3 v-if="!embedded"><Brain :size="16" /> 长期记忆 <span>{{ memories.length }}</span></h3>
      <div class="agent-panel__actions">
        <ArenaSelect v-model="filterCategory" :options="categoryOptions" />
        <button type="button" class="agent-btn primary" :disabled="busy" @click="startCreate">
          <Plus :size="14" /> 新增
        </button>
      </div>
    </header>

    <div v-if="editing" class="memory-editor">
      <div class="memory-editor__row">
        <ArenaSelect v-model="editing.category" :options="categoryOptions.filter((o) => o.value !== 'all')" />
        <select v-model.number="editing.importance" class="memory-importance">
          <option v-for="opt in importanceOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
        <label class="memory-editor__pin">
          <input v-model="editing.pinned" type="checkbox" /> 置顶
        </label>
      </div>
      <textarea v-model="editing.content" rows="3" placeholder="例如：用户喜欢简洁直接的回答，不喜欢过多 emoji" />
      <div class="memory-editor__actions">
        <button type="button" class="agent-btn" @click="cancelEdit">取消</button>
        <button type="button" class="agent-btn primary" :disabled="busy" @click="saveEdit">保存</button>
      </div>
    </div>

    <div v-if="filteredMemories.length" class="memory-list">
      <article v-for="item in filteredMemories" :key="item.id" class="memory-item" :class="{ pinned: item.pinned }">
        <header>
          <span class="memory-item__cat">{{ MEMORY_CATEGORY_LABELS[item.category] }}</span>
          <span class="memory-item__imp">优先级 {{ item.importance }}</span>
          <div class="memory-item__ops">
            <button type="button" title="置顶" @click="togglePin(item)"><Pin :size="13" :class="{ on: item.pinned }" /></button>
            <button type="button" title="编辑" @click="startEdit(item)">编辑</button>
            <button type="button" title="删除" @click="remove(item)"><Trash2 :size="13" /></button>
          </div>
        </header>
        <p>{{ item.content }}</p>
      </article>
    </div>
    <DetailRegionEmpty v-else title="暂无记忆" description="添加角色应长期记住的事实与偏好" :icon="Brain" hint="" />
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

.agent-panel__head h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 15px;
  color: #17205a;
}

.agent-panel__head--toolbar {
  justify-content: flex-end;
}

.agent-panel__head h3 span {
  color: #9aa3c7;
  font-size: 11px;
  font-weight: 600;
}

.agent-panel__actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.memory-editor {
  display: grid;
  gap: 8px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(112, 105, 255, 0.16);
}

.memory-editor__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.memory-editor__pin {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5a6594;
}

.memory-importance {
  padding: 6px 10px;
  border: 1px solid rgba(112, 105, 255, 0.18);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
  font: inherit;
  color: #17205a;
}

.memory-editor textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid rgba(112, 105, 255, 0.18);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  font: inherit;
  resize: vertical;
}

.memory-editor__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.memory-list {
  display: grid;
  gap: 8px;
}

.memory-item {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(112, 105, 255, 0.1);
}

.memory-item.pinned {
  border-color: rgba(245, 158, 11, 0.35);
  background: rgba(255, 251, 235, 0.72);
}

.memory-item header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.memory-item__cat,
.memory-item__imp {
  font-size: 11px;
  color: #7a85b0;
}

.memory-item__ops {
  margin-left: auto;
  display: flex;
  gap: 6px;
}

.memory-item__ops button {
  border: none;
  background: transparent;
  color: #5b57f3;
  font-size: 11px;
  cursor: pointer;
  padding: 2px 4px;
}

.memory-item__ops .on {
  color: #d97706;
  fill: #d97706;
}

.memory-item p {
  margin: 0;
  color: #17205a;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
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
</style>
