<script setup lang="ts">

import type { ArenaSettings } from '@shared/arena/types'

import SettingsBlock from './SettingsBlock.vue'

import SettingsRow from './SettingsRow.vue'

import SettingsSegment from './SettingsSegment.vue'



defineProps<{

  settings: ArenaSettings

}>()



const emit = defineEmits<{

  update: [key: keyof ArenaSettings, value: ArenaSettings[keyof ArenaSettings]]

}>()



const uiScaleOptions = [

  { label: '100%', value: '100' },

  { label: '125%', value: '125' },

  { label: '150%', value: '150' },

]



const boolOptions = [

  { label: '开启', value: true },

  { label: '关闭', value: false },

]



function update<K extends keyof ArenaSettings>(key: K, value: ArenaSettings[K]) {

  emit('update', key, value)

}

</script>



<template>

  <SettingsBlock title="界面外观" desc="缩放、动效与布局视觉。">

    <SettingsRow label="界面缩放" hint="全局字号与控件尺寸">

      <SettingsSegment

        :model-value="String(settings.uiScale)"

        :options="uiScaleOptions"

        @update:model-value="(v) => update('uiScale', Number(v) as ArenaSettings['uiScale'])"

      />

    </SettingsRow>

    <SettingsRow label="动画效果" hint="页面过渡与按钮微交互">

      <SettingsSegment

        variant="bool"

        :model-value="settings.animationEnabled"

        :options="boolOptions"

        @update:model-value="(v) => update('animationEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="紧凑布局" hint="缩小间距，同屏更多信息">

      <SettingsSegment

        variant="bool"

        :model-value="settings.compactLayout"

        :options="boolOptions"

        @update:model-value="(v) => update('compactLayout', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="玻璃质感" hint="侧栏与面板磨砂背景">

      <SettingsSegment

        variant="bool"

        :model-value="settings.glassEffect"

        :options="boolOptions"

        @update:model-value="(v) => update('glassEffect', Boolean(v))"

      />

    </SettingsRow>

  </SettingsBlock>

</template>

