<script setup lang="ts">
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import DevAssetsTreeBranch from './DevAssetsTreeBranch.vue'
import type { DevAssetsTreeNode } from '@shared/arena/dev-assets-types'

const props = defineProps<{
  tree: DevAssetsTreeNode | null
  activePath: string
}>()

const emit = defineEmits<{
  select: [relativePath: string]
}>()

const ROOT_KEY = '__root__'
const expanded = ref(new Set<string>([ROOT_KEY]))

function expandAncestors(path: string) {
  const next = new Set(expanded.value)
  next.add(ROOT_KEY)
  if (!path) return
  const parts = path.split('/').filter(Boolean)
  let acc = ''
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part
    next.add(acc)
  }
  expanded.value = next
}

watch(
  () => props.activePath,
  (path) => expandAncestors(path),
  { immediate: true }
)

function toggleExpand(path: string) {
  const next = new Set(expanded.value)
  if (next.has(path)) next.delete(path)
  else next.add(path)
  expanded.value = next
}

function selectPath(path: string) {
  expandAncestors(path)
  emit('select', path)
}

function onRootToggle(event: MouseEvent) {
  event.stopPropagation()
  toggleExpand(ROOT_KEY)
}

const rootExpanded = () => expanded.value.has(ROOT_KEY)
</script>

<template>
  <nav class="dev-assets-tree" aria-label="素材目录">
    <div class="dev-assets-tree__row" :class="{ 'is-active': !activePath }">
      <button
        type="button"
        class="dev-assets-tree__toggle"
        :aria-expanded="rootExpanded()"
        @click="onRootToggle"
      >
        <ChevronDown v-if="rootExpanded()" :size="14" />
        <ChevronRight v-else :size="14" />
      </button>
      <button type="button" class="dev-assets-tree__label" @click="selectPath('')">.dev-assets</button>
    </div>

    <DevAssetsTreeBranch
      v-if="rootExpanded()"
      :nodes="tree?.children"
      :depth="0"
      :active-path="activePath"
      :expanded="expanded"
      @select="selectPath"
      @toggle="toggleExpand"
    />
  </nav>
</template>

<style scoped>
.dev-assets-tree {
  padding: 2px 0 6px;
}

.dev-assets-tree__row {
  display: flex;
  align-items: center;
  gap: 2px;
  min-height: 32px;
  border-radius: 8px;
  margin: 1px 6px;
}

.dev-assets-tree__row:hover,
.dev-assets-tree__row.is-active {
  background: rgba(92, 87, 239, 0.08);
}

.dev-assets-tree__row.is-active .dev-assets-tree__label {
  color: #4f4bf1;
  font-weight: 560;
}

.dev-assets-tree__toggle {
  display: grid;
  place-items: center;
  flex: 0 0 22px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #8890b8;
  cursor: pointer;
}

.dev-assets-tree__toggle:hover {
  background: rgba(92, 87, 239, 0.1);
  color: #5c57ef;
}

.dev-assets-tree__label {
  flex: 1;
  min-width: 0;
  padding: 6px 8px 6px 0;
  border: 0;
  background: transparent;
  text-align: left;
  font-size: 12px;
  color: #586397;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dev-assets-tree__row:hover .dev-assets-tree__label {
  color: #4a5288;
}
</style>
