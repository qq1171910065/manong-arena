<script setup lang="ts">
import { computed, ref } from 'vue'
import { PanelLeftOpen, Search, X } from 'lucide-vue-next'
import { groupRegistry, isSidebarFooterGroup, type FeatureRegistry } from '../types/registry'
import { navigate, route } from '../router'
import { useSidebar, useSidebarSearchFocus } from '../composables/useSidebar'

const props = defineProps<{
  registry: FeatureRegistry
  flat?: boolean
}>()

const { collapsed, toggle } = useSidebar()
const filter = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

useSidebarSearchFocus(() => {
  if (collapsed.value) collapsed.value = false
  searchInputRef.value?.focus()
  searchInputRef.value?.select()
})

const groups = computed(() => groupRegistry(props.registry))

const filteredGroups = computed(() => {
  const q = filter.value.trim().toLowerCase()
  if (!q) return groups.value
  return groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter((item) => {
        const groupLabel = g.label?.toLowerCase() ?? ''
        return (
          item.label.toLowerCase().includes(q) ||
          item.path.toLowerCase().includes(q) ||
          groupLabel.includes(q)
        )
      }),
    }))
    .filter((g) => g.items.length > 0)
})

const totalItems = computed(() => props.registry.length)
const showSearch = computed(() => totalItems.value > 5)
const hasFilter = computed(() => filter.value.trim().length > 0)
const noSearchResults = computed(() => hasFilter.value && filteredGroups.value.length === 0)

const primaryGroups = computed(() =>
  filteredGroups.value.filter((group) => !isSidebarFooterGroup(group.id))
)
const footerGroups = computed(() =>
  filteredGroups.value.filter((group) => isSidebarFooterGroup(group.id))
)

function clearFilter() {
  filter.value = ''
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && hasFilter.value) {
    e.preventDefault()
    clearFilter()
  }
}

function isActive(path: string): boolean {
  return route.value.path.split('?')[0] === path
}
</script>

<template>
  <aside
    class="shell-sidebar"
    :class="{
      'is-collapsed': collapsed,
      'is-flat': flat,
      'is-grouped': !flat,
    }"
  >
    <div v-if="collapsed" class="shell-sidebar-head">
      <button
        type="button"
        class="shell-sidebar-toggle"
        title="展开侧栏"
        aria-label="展开侧栏"
        @click="toggle"
      >
        <PanelLeftOpen :size="16" />
      </button>
    </div>

    <div v-if="showSearch && !collapsed" class="shell-sidebar-search">
      <Search :size="14" class="shell-sidebar-search-icon" />
      <input
        ref="searchInputRef"
        v-model="filter"
        type="search"
        class="shell-sidebar-search-input"
        placeholder="搜索导航…"
        aria-label="搜索导航"
        autocomplete="off"
        @keydown="onSearchKeydown"
      />
      <button
        v-if="hasFilter"
        type="button"
        class="shell-sidebar-search-clear"
        title="清除搜索"
        aria-label="清除搜索"
        @click="clearFilter"
      >
        <X :size="12" />
      </button>
    </div>

    <nav class="shell-sidebar-nav">
      <div class="shell-sidebar-nav-main">
        <p v-if="noSearchResults" class="shell-sidebar-empty">
          未找到「<span class="shell-sidebar-empty__q">{{ filter.trim() }}</span>」
        </p>
        <div v-for="group in primaryGroups" :key="group.id" class="shell-nav-group">
          <div v-if="!flat && group.label && !collapsed" class="shell-nav-group-title">
            {{ group.label }}
          </div>
          <button
            v-for="item in group.items"
            :key="item.key"
            class="shell-nav-item"
            :class="{ active: isActive(item.path) }"
            :title="collapsed ? item.label : undefined"
            @click="navigate(item.path)"
          >
            <span v-if="item.icon" class="shell-nav-icon-wrap" aria-hidden="true">
              <component :is="item.icon" :size="17" class="shell-nav-icon" />
            </span>
            <span v-if="!collapsed" class="shell-nav-label">{{ item.label }}</span>
            <span v-if="!collapsed && item.badge" class="shell-nav-badge">{{ item.badge }}</span>
          </button>
        </div>
      </div>
      <div v-if="footerGroups.length" class="shell-sidebar-nav-footer">
        <div v-for="group in footerGroups" :key="group.id" class="shell-nav-group">
          <div v-if="!flat && group.label && !collapsed" class="shell-nav-group-title">
            {{ group.label }}
          </div>
          <button
            v-for="item in group.items"
            :key="item.key"
            class="shell-nav-item"
            :class="{ active: isActive(item.path) }"
            :title="collapsed ? item.label : undefined"
            @click="navigate(item.path)"
          >
            <span v-if="item.icon" class="shell-nav-icon-wrap" aria-hidden="true">
              <component :is="item.icon" :size="17" class="shell-nav-icon" />
            </span>
            <span v-if="!collapsed" class="shell-nav-label">{{ item.label }}</span>
            <span v-if="!collapsed && item.badge" class="shell-nav-badge">{{ item.badge }}</span>
          </button>
        </div>
      </div>
    </nav>
  </aside>
</template>
