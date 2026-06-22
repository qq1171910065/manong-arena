<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { THEME_PRESETS } from '@renderer/composables/useTheme'
import type { ArenaSettings } from '@shared/arena/types'
import type { ThemeId } from '@shared/types'
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'
import { NButton, NModal } from '../../ui'

const props = defineProps<{
  settings: ArenaSettings
}>()

const emit = defineEmits<{
  update: [key: keyof ArenaSettings, value: ArenaSettings[keyof ArenaSettings]]
}>()

const themeModalOpen = ref(false)

const themeModeOptions = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
]

const uiScaleOptions = [
  { label: '100%', value: '100' },
  { label: '125%', value: '125' },
  { label: '150%', value: '150' },
]

const boolOptions = [
  { label: '开启', value: true },
  { label: '关闭', value: false },
]

const currentTheme = computed(() => THEME_PRESETS[props.settings.themeId] ?? THEME_PRESETS['enterprise-light'])

function update<K extends keyof ArenaSettings>(key: K, value: ArenaSettings[K]) {
  emit('update', key, value)
}

function selectTheme(id: ThemeId) {
  update('themeId', id)
  themeModalOpen.value = false
}
</script>

<template>
  <div class="settings-panel-body display-settings">
    <SettingsRow
      inline-hint
      label="主题模式"
      hint="切换浅色、深色或跟随系统，立即作用于全局界面与设置中心"
    >
      <SettingsSegment
        :model-value="settings.themeMode"
        :options="themeModeOptions"
        @update:model-value="(v) => update('themeMode', v as ArenaSettings['themeMode'])"
      />
    </SettingsRow>

    <SettingsRow
      inline-hint
      label="配色方案"
      hint="选择品牌主色与背景风格，可与明暗模式自由组合"
    >
      <NButton class="display-settings__theme-trigger" @click="themeModalOpen = true">
        <span class="theme-swatch theme-swatch--sm" aria-hidden="true">
          <span :style="{ background: currentTheme.primary }" />
          <span :style="{ background: currentTheme.background }" />
        </span>
        <span class="display-settings__theme-label">{{ currentTheme.label }}</span>
        <ChevronRight :size="14" />
      </NButton>
    </SettingsRow>

    <SettingsRow
      inline-hint
      label="界面缩放"
      hint="按 100% / 125% / 150% 放大全局字号与控件尺寸，便于长时间阅读"
    >
      <SettingsSegment
        :model-value="String(settings.uiScale)"
        :options="uiScaleOptions"
        @update:model-value="(v) => update('uiScale', Number(v) as ArenaSettings['uiScale'])"
      />
    </SettingsRow>

    <SettingsRow
      inline-hint
      label="动画效果"
      hint="关闭后将禁用页面过渡、卡片动效与按钮微交互"
    >
      <SettingsSegment
        variant="bool"
        :model-value="settings.animationEnabled"
        :options="boolOptions"
        @update:model-value="(v) => update('animationEnabled', Boolean(v))"
      />
    </SettingsRow>

    <SettingsRow
      inline-hint
      label="紧凑布局"
      hint="缩小侧栏、设置行与内容区间距，同屏展示更多信息"
    >
      <SettingsSegment
        variant="bool"
        :model-value="settings.compactLayout"
        :options="boolOptions"
        @update:model-value="(v) => update('compactLayout', Boolean(v))"
      />
    </SettingsRow>

    <SettingsRow
      inline-hint
      label="玻璃质感"
      hint="为导航侧栏与内容面板启用磨砂玻璃背景，关闭后改为纯色实底"
    >
      <SettingsSegment
        variant="bool"
        :model-value="settings.glassEffect"
        :options="boolOptions"
        @update:model-value="(v) => update('glassEffect', Boolean(v))"
      />
    </SettingsRow>

    <NModal
      v-model:show="themeModalOpen"
      preset="card"
      title="选择配色方案"
      style="max-width: 640px"
      :bordered="false"
    >
      <div class="theme-preset-grid">
        <button
          v-for="(preset, id) in THEME_PRESETS"
          :key="id"
          type="button"
          class="theme-preset-option"
          :class="{ 'is-selected': settings.themeId === id }"
          @click="selectTheme(id as ThemeId)"
        >
          <span class="theme-swatch" aria-hidden="true">
            <span :style="{ background: preset.primary }" />
            <span :style="{ background: preset.background }" />
          </span>
          <span class="theme-preset-label">
            <strong>{{ preset.label }}</strong>
            <span>{{ preset.description }}</span>
          </span>
        </button>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.display-settings__theme-trigger {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 180px;
  justify-content: space-between;
}

.display-settings__theme-label {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
