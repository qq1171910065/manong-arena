<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Circle, Palette } from 'lucide-vue-next'
import { route } from '../router'
import { findRegistryItem, type FeatureRegistry } from '../types/registry'
import { useGeneralSettings } from '../composables/useGeneralSettings'
import { getRuntimeConfig } from '../composables/runtime-config'
import { getStoredThemeId, THEME_PRESETS } from '../composables/useTheme'

const props = defineProps<{ registry: FeatureRegistry }>()

const now = ref(new Date())
const online = ref(navigator.onLine)
let timer: ReturnType<typeof setInterval> | null = null

function onOnline() {
  online.value = true
}
function onOffline() {
  online.value = false
}

onMounted(() => {
  timer = setInterval(() => {
    now.value = new Date()
  }, 30_000)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
})

const { settings } = useGeneralSettings()
const themeId = getStoredThemeId(getRuntimeConfig().themeId)
const themeLabel = THEME_PRESETS[themeId]?.label ?? themeId

const currentLabel = computed(() => {
  const item = findRegistryItem(props.registry, route.value.path)
  return item?.label ?? route.value.path
})

const timeText = computed(() =>
  now.value.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
)
</script>

<template>
  <footer class="shell-statusbar">
    <div class="shell-statusbar-section shell-statusbar-left">
      <span class="shell-statusbar-item">
        <Circle :size="8" :class="online ? 'status-dot--ok' : 'status-dot--warn'" />
        {{ online ? '已连接' : '离线' }}
      </span>
      <span class="shell-statusbar-divider" aria-hidden="true" />
      <span class="shell-statusbar-item shell-statusbar-route">{{ currentLabel }}</span>
    </div>

    <div class="shell-statusbar-section shell-statusbar-center">
      <span v-if="settings.showDemoBadge" class="demo-badge">Demo 模式</span>
    </div>

    <div class="shell-statusbar-section shell-statusbar-right">
      <span class="shell-statusbar-item" :title="`主题：${themeLabel}`">
        <Palette :size="12" />
        {{ themeLabel }}
      </span>
      <span class="shell-statusbar-divider" aria-hidden="true" />
      <span class="shell-statusbar-item shell-statusbar-time">{{ timeText }}</span>
    </div>
  </footer>
</template>
