<script setup lang="ts">
import { Minus, PanelLeftClose, Settings, Square, User, X } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getAppFeatures } from '../composables/runtime-config'
import { getGeneralSettings } from '../composables/useGeneralSettings'
import { useSidebar } from '../composables/useSidebar'
import { navigate } from '../router'
import { useDialog } from '../ui'
import AppTitleNav from './AppTitleNav.vue'
import type { FeatureRegistry } from '../types/registry'

const props = defineProps<{
  title?: string
  registry?: FeatureRegistry
  compact?: boolean
}>()

const dialog = useDialog()
const { collapsed, toggle } = useSidebar()
const maximized = ref(false)
const hasWindowControls = computed(
  () => typeof window !== 'undefined' && Boolean(window.windowControls)
)

let offMaximized: (() => void) | undefined

onMounted(async () => {
  const wc = window.windowControls
  if (!wc) return
  maximized.value = await wc.isMaximized()
  offMaximized = wc.onMaximizedChanged((v) => {
    maximized.value = v
  })
})

onUnmounted(() => offMaximized?.())

const appInitial = props.title?.trim()?.[0]?.toUpperCase() ?? 'M'
const showAccountEntry = computed(() => Boolean(props.compact && getAppFeatures().platform))

function openProfile() {
  navigate('/profile')
}

function minimizeWindow() {
  void window.windowControls?.minimize()
}

function toggleMaximizeWindow() {
  void window.windowControls?.maximize()
}

function closeWindow() {
  const behavior = getGeneralSettings().closeBehavior
  const hasTray = getAppFeatures().tray

  if (behavior === 'tray') {
    void window.windowControls?.hide()
    return
  }

  if (behavior === 'quit') {
    void window.windowControls?.quit()
    return
  }

  if (hasTray) {
    dialog.warning({
      title: '关闭窗口',
      content: '退出应用还是最小化到系统托盘？',
      positiveText: '最小化到托盘',
      negativeText: '退出应用',
      closable: true,
      maskClosable: true,
      onPositiveClick: () => {
        void window.windowControls?.hide()
      },
      onNegativeClick: () => {
        void window.windowControls?.quit()
      },
    })
    return
  }

  dialog.warning({
    title: '退出应用',
    content: '确定要退出吗？',
    positiveText: '退出',
    negativeText: '取消',
    onPositiveClick: () => {
      void window.windowControls?.quit()
    },
  })
}
</script>

<template>
  <header class="shell-titlebar" :class="{ 'shell-titlebar--compact': compact }">
    <div class="shell-titlebar-brand">
      <div class="shell-titlebar-brand-drag" data-tauri-drag-region>
        <span class="shell-titlebar-logo" aria-hidden="true">{{ appInitial }}</span>
        <span class="shell-titlebar-title">{{ title }}</span>
      </div>
      <button
        v-if="!compact && !collapsed"
        type="button"
        class="shell-sidebar-toggle shell-titlebar-sidebar-toggle no-drag"
        title="收起侧栏"
        aria-label="收起侧栏"
        @click="toggle"
      >
        <PanelLeftClose :size="16" />
      </button>
    </div>
    <div class="shell-titlebar-main">
      <AppTitleNav v-if="compact && registry" class="no-drag" :registry="registry" />
      <div class="shell-titlebar-drag-fill" data-tauri-drag-region aria-hidden="true" />
      <div v-if="hasWindowControls || compact" class="no-drag titlebar-actions">
        <button
          v-if="showAccountEntry"
          type="button"
          class="win-btn"
          title="用户中心"
          aria-label="用户中心"
          @click="openProfile"
        >
          <User :size="15" />
        </button>
        <button
          v-if="compact"
          type="button"
          class="win-btn"
          title="设置"
          aria-label="设置"
          @click="navigate('/settings')"
        >
          <Settings :size="15" />
        </button>
        <template v-if="hasWindowControls">
          <button type="button" class="win-btn" title="最小化" aria-label="最小化" @click="minimizeWindow">
            <Minus :size="14" />
          </button>
          <button
            type="button"
            class="win-btn"
            :title="maximized ? '还原' : '最大化'"
            :aria-label="maximized ? '还原' : '最大化'"
            @click="toggleMaximizeWindow"
          >
            <Square :size="12" />
          </button>
          <button type="button" class="win-btn win-btn--close" title="关闭" aria-label="关闭" @click="closeWindow">
            <X :size="14" />
          </button>
        </template>
      </div>
    </div>
  </header>
</template>
