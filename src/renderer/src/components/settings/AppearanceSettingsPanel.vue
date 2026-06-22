<script setup lang="ts">
import { ref } from 'vue'
import { getAppFeatures, getRuntimeConfig } from '@renderer/composables/runtime-config'
import {
  applyTheme,
  getColorScheme,
  getStoredThemeId,
  setColorScheme,
  setStoredThemeId,
  THEME_PRESETS,
} from '@renderer/composables/useTheme'
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'
import I18nSettingsPanel from './I18nSettingsPanel.vue'
import type { ThemeId } from '@shared/types'
const features = getAppFeatures()
const config = getRuntimeConfig()

const themeId = ref<ThemeId>(getStoredThemeId(config.themeId))
const scheme = ref(getColorScheme())

const schemeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

function onThemeChange(id: ThemeId) {
  themeId.value = id
  setStoredThemeId(id)
  applyTheme(id, config.themeId)
}

function onSchemeChange(v: 'light' | 'dark' | 'system') {
  scheme.value = v
  setColorScheme(v)
}
</script>

<template>
  <div class="settings-panel-body">
    <SettingsRow label="深色模式">
      <SettingsSegment
        :model-value="scheme"
        :options="schemeOptions"
        @update:model-value="(v) => onSchemeChange(v as 'light' | 'dark' | 'system')"
      />
    </SettingsRow>

    <div class="settings-row settings-row--stack">
      <div class="settings-row__label">
        <span class="settings-row__title">主题预设</span>
        <span class="settings-row__hint">选择符合产品调性的配色方案</span>
      </div>
      <div class="theme-preset-grid theme-preset-grid--compact">
        <button
          v-for="(preset, id) in THEME_PRESETS"
          :key="id"
          type="button"
          class="theme-preset-chip"
          :class="{ 'is-selected': themeId === id }"
          @click="onThemeChange(id as ThemeId)"
        >
          <span class="theme-swatch theme-swatch--sm" aria-hidden="true">
            <span :style="{ background: preset.primary }" />
            <span :style="{ background: preset.background }" />
          </span>
          <span>{{ preset.label }}</span>
        </button>
      </div>
    </div>

    <I18nSettingsPanel v-if="features.i18n" embedded />
  </div>
</template>
