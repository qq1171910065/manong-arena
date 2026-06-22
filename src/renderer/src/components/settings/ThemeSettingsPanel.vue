<script setup lang="ts">
import { ref } from 'vue'
import { applyTheme, getColorScheme, getStoredThemeId, setColorScheme, setStoredThemeId, THEME_PRESETS } from '@renderer/composables/useTheme'
import { NCard, NRadio, NRadioGroup, NSelect } from '../../ui'
import type { ThemeId } from '@shared/types'

const props = withDefaults(
  defineProps<{ defaultThemeId?: ThemeId; embedded?: boolean }>(),
  {
    defaultThemeId: 'enterprise-light',
    embedded: false,
  }
)

const themeId = ref<ThemeId>(getStoredThemeId(props.defaultThemeId))
const scheme = ref(getColorScheme())

const schemeOptions = [
  { label: '跟随系统', value: 'system' },
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
]

function onThemeChange(id: ThemeId) {
  themeId.value = id
  setStoredThemeId(id)
  applyTheme(id, props.defaultThemeId)
}

function onSchemeChange(v: 'light' | 'dark' | 'system') {
  scheme.value = v
  setColorScheme(v)
}
</script>

<template>
  <div :class="embedded ? '' : 'page'">
    <div v-if="!embedded" class="page-head"><h1>主题设置</h1></div>
    <NCard class="mntools-panel" title="主题预设" style="margin-bottom: 16px">
      <NRadioGroup :value="themeId" name="theme" @update:value="onThemeChange">
        <div class="theme-preset-grid">
          <label
            v-for="(preset, id) in THEME_PRESETS"
            :key="id"
            class="theme-preset-option"
            :class="{ 'is-selected': themeId === id }"
          >
            <NRadio :value="id" />
            <span class="theme-swatch" aria-hidden="true">
              <span :style="{ background: preset.primary }" />
              <span :style="{ background: preset.background }" />
            </span>
            <span class="theme-preset-label">
              <strong>{{ preset.label }}</strong>
              <span>{{ preset.description }}</span>
            </span>
          </label>
        </div>
      </NRadioGroup>
    </NCard>
    <NCard class="mntools-panel" title="明暗模式">
      <NSelect
        :value="scheme"
        :options="schemeOptions"
        style="max-width: 240px"
        @update:value="(v: 'light' | 'dark' | 'system') => onSchemeChange(v)"
      />
    </NCard>
  </div>
</template>
