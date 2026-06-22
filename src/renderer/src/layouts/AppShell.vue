<script setup lang="ts">
import AppTitleBar from './AppTitleBar.vue'
import AppSidebar from './AppSidebar.vue'
import AppStatusBar from './AppStatusBar.vue'
import type { FeatureRegistry } from '../types/registry'

withDefaults(
  defineProps<{
    appName: string
    registry: FeatureRegistry
    flatSidebar?: boolean
    showSidebar?: boolean
  }>(),
  {
    showSidebar: true,
  }
)
</script>

<template>
  <div class="shell-root" :class="{ 'shell-root--compact': !showSidebar }">
    <AppTitleBar :title="appName" :registry="registry" :compact="!showSidebar" />
    <div class="shell-body" :class="{ 'shell-body--compact': !showSidebar }">
      <AppSidebar v-if="showSidebar" :registry="registry" :flat="flatSidebar" />
      <div class="shell-content">
        <main class="shell-main">
          <slot />
        </main>
        <AppStatusBar :registry="registry" />
      </div>
    </div>
  </div>
</template>
