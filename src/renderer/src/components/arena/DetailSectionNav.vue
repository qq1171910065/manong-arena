<script setup lang="ts">
import { computed } from 'vue'
import type { ScrollSpyGroup, ScrollSpyTab } from '@renderer/composables/useScrollSpySections'

const props = defineProps<{
  groups?: ScrollSpyGroup[]
  tabs?: ScrollSpyTab[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const resolvedGroups = computed<ScrollSpyGroup[]>(() => {
  if (props.groups?.length) return props.groups
  if (props.tabs?.length) {
    return [{ id: 'default', label: '目录', items: props.tabs }]
  }
  return []
})

const activeGroupId = computed(() => {
  for (const group of resolvedGroups.value) {
    if (group.items.some((item) => item.id === props.activeId)) return group.id
  }
  return resolvedGroups.value[0]?.id || ''
})
</script>

<template>
  <nav class="detail-rail-nav aa-detail-float-panel" aria-label="页面目录">
    <header v-if="resolvedGroups.length > 1 || !tabs" class="detail-rail-nav__title">目录</header>

    <div
      v-for="group in resolvedGroups"
      :key="group.id"
      class="detail-rail-nav__group"
      :class="{ 'detail-rail-nav__group--active': activeGroupId === group.id }"
    >
      <div v-if="resolvedGroups.length > 1" class="detail-rail-nav__group-head">
        <component v-if="group.icon" :is="group.icon" :size="14" class="detail-rail-nav__group-icon" />
        <span>{{ group.label }}</span>
      </div>

      <div class="detail-rail-nav__items">
        <button
          v-for="item in group.items"
          :key="item.id"
          type="button"
          class="detail-rail-nav__item"
          :class="{ active: activeId === item.id }"
          @click="emit('select', item.id)"
        >
          <i class="detail-rail-nav__indicator" aria-hidden="true" />
          <span class="detail-rail-nav__label">{{ item.label }}</span>
          <em v-if="item.badge" class="detail-rail-nav__badge">{{ item.badge }}</em>
        </button>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.detail-rail-nav {
  position: sticky;
  top: 10px;
  display: grid;
  gap: 4px;
  padding: 10px 8px 12px;
  max-height: calc(100vh - 120px);
  overflow: auto;
  scrollbar-width: thin;
}

.detail-rail-nav__title {
  margin: 0 4px 6px;
  color: #9aa3c7;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.detail-rail-nav__group {
  display: grid;
  gap: 2px;
  padding: 4px 0;
}

.detail-rail-nav__group + .detail-rail-nav__group {
  border-top: 1px solid rgba(130, 142, 207, 0.1);
  margin-top: 2px;
  padding-top: 8px;
}

.detail-rail-nav__group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 6px;
  color: #8b95bd;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.detail-rail-nav__group--active .detail-rail-nav__group-head {
  color: #5b57f3;
}

.detail-rail-nav__group-icon {
  flex: none;
  opacity: 0.85;
}

.detail-rail-nav__items {
  display: grid;
  gap: 2px;
}

.detail-rail-nav__item {
  display: grid;
  grid-template-columns: 3px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 34px;
  padding: 6px 8px 6px 4px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #66709d;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.detail-rail-nav__item:hover {
  color: #4338ca;
}

.detail-rail-nav__item.active {
  color: #5b57f3;
  font-weight: 650;
}

.detail-rail-nav__indicator {
  display: block;
  width: 3px;
  height: 18px;
  margin-left: 2px;
  border-radius: 999px;
  background: transparent;
  transition: background 0.15s ease, height 0.15s ease;
}

.detail-rail-nav__item.active .detail-rail-nav__indicator {
  background: linear-gradient(180deg, #8b84ff, #5b57f3);
  height: 22px;
}

.detail-rail-nav__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.detail-rail-nav__badge {
  padding: 0;
  border-radius: 0;
  background: transparent;
  color: #9aa3c7;
  font-style: normal;
  font-size: 10px;
  font-weight: 600;
}

.detail-rail-nav__item.active .detail-rail-nav__badge {
  background: transparent;
  color: #7b61ff;
}
</style>
