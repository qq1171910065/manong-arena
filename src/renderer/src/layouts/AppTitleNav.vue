<script setup lang="ts">
import { computed } from 'vue'
import { route, navigate } from '../router'
import { isSidebarFooterGroup } from '../types/registry'
import type { FeatureRegistry } from '../types/registry'

const props = defineProps<{
  registry: FeatureRegistry
}>()

const navItems = computed(() =>
  props.registry.filter((item) => !isSidebarFooterGroup(item.group))
)

function isActive(path: string): boolean {
  const current = route.value.path.split('?')[0]
  return current === path || current.startsWith(`${path}/`)
}
</script>

<template>
  <nav v-if="navItems.length" class="shell-titlebar-nav no-drag" aria-label="主导航">
    <button
      v-for="item in navItems"
      :key="item.path"
      type="button"
      class="shell-titlebar-nav-item"
      :class="{ active: isActive(item.path) }"
      @click="navigate(item.path)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>
