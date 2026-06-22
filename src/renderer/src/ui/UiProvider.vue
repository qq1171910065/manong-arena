<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  darkTheme,
  NConfigProvider,
  NDialogProvider,
  NMessageProvider,
  NNotificationProvider,
  type GlobalTheme,
} from 'naive-ui'
import { buildNaiveThemeOverrides, isDarkMode } from './naive-theme'

const dark = ref(isDarkMode())
const themeRevision = ref(0)
let observer: MutationObserver | null = null

function syncTheme() {
  dark.value = isDarkMode()
  themeRevision.value += 1
}

onMounted(() => {
  syncTheme()
  observer = new MutationObserver(syncTheme)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme-id'],
  })
  window.addEventListener('mntools:theme-change', syncTheme)
})

onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('mntools:theme-change', syncTheme)
})

const naiveTheme = computed<GlobalTheme | null>(() => (dark.value ? darkTheme : null))
const themeOverrides = computed(() => {
  themeRevision.value
  return buildNaiveThemeOverrides()
})
</script>

<template>
  <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides" class="mntools-ui-root">
    <NNotificationProvider :max="4" placement="top-right">
      <NMessageProvider>
        <NDialogProvider>
          <slot />
        </NDialogProvider>
      </NMessageProvider>
    </NNotificationProvider>
  </NConfigProvider>
</template>

<style>
.mntools-ui-root {
  display: block;
  min-height: 100%;
}

.mntools-ui-root .n-card.mntools-panel {
  border: 1px solid var(--line);
  background: var(--surface);
  box-shadow: 0 1px 3px color-mix(in srgb, var(--text) 4%, transparent);
  border-radius: var(--radius-md);
}

.mntools-ui-root .n-card.mntools-panel .n-card-header {
  padding-bottom: var(--space-2);
}

.mntools-ui-root .n-data-table {
  background: transparent;
}

.mntools-ui-root .n-tabs .n-tabs-nav {
  margin-bottom: 4px;
}
</style>
