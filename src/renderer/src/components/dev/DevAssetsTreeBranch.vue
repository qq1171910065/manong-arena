<script setup lang="ts">
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { computed } from 'vue'
import type { DevAssetsTreeNode } from '@shared/arena/dev-assets-types'

defineOptions({ name: 'DevAssetsTreeBranch' })

const props = defineProps<{
  nodes: DevAssetsTreeNode[] | undefined
  depth: number
  activePath: string
  expanded: Set<string>
}>()

const emit = defineEmits<{
  select: [relativePath: string]
  toggle: [relativePath: string]
}>()

const directoryNodes = computed(() =>
  (props.nodes || []).filter((node) => node.kind === 'directory')
)

function isExpanded(path: string): boolean {
  return props.expanded.has(path)
}

function hasChildren(node: DevAssetsTreeNode): boolean {
  return Boolean(node.children?.some((child) => child.kind === 'directory'))
}

function onToggle(path: string, event: MouseEvent) {
  event.stopPropagation()
  emit('toggle', path)
}

function onSelect(path: string) {
  emit('select', path)
}
</script>

<template>
  <ul v-if="directoryNodes.length" class="dev-assets-tree-branch" :class="{ 'is-nested': depth > 0 }">
    <li v-for="node in directoryNodes" :key="node.relativePath || node.label">
      <div
        class="dev-assets-tree__row"
        :class="{ 'is-active': activePath === node.relativePath }"
        :style="{ paddingLeft: `${8 + depth * 14}px` }"
      >
        <button
          type="button"
          class="dev-assets-tree__toggle"
          :class="{ 'is-placeholder': !hasChildren(node) }"
          :aria-expanded="hasChildren(node) ? isExpanded(node.relativePath) : undefined"
          :tabindex="hasChildren(node) ? 0 : -1"
          @click="hasChildren(node) ? onToggle(node.relativePath, $event) : undefined"
        >
          <ChevronDown v-if="hasChildren(node) && isExpanded(node.relativePath)" :size="14" />
          <ChevronRight v-else-if="hasChildren(node)" :size="14" />
        </button>
        <button type="button" class="dev-assets-tree__label" @click="onSelect(node.relativePath)">
          {{ node.label }}
        </button>
      </div>

      <DevAssetsTreeBranch
        v-if="hasChildren(node) && isExpanded(node.relativePath)"
        :nodes="node.children"
        :depth="depth + 1"
        :active-path="activePath"
        :expanded="expanded"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </li>
  </ul>
</template>

<style scoped>
.dev-assets-tree-branch {
  list-style: none;
  margin: 0;
  padding: 0;
}

.dev-assets-tree-branch.is-nested {
  margin-left: 0;
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

.dev-assets-tree__toggle:hover:not(.is-placeholder) {
  background: rgba(92, 87, 239, 0.1);
  color: #5c57ef;
}

.dev-assets-tree__toggle.is-placeholder {
  visibility: hidden;
  pointer-events: none;
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
