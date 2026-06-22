<script setup lang="ts">
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'

defineProps<{ embedded?: boolean }>()

const localeOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]
</script>

<template>
  <div class="settings-panel-body">
    <SettingsRow label="语言">
      <SettingsSegment
        model-value="zh-CN"
        :options="localeOptions"
      />
    </SettingsRow>
  </div>
</template>
