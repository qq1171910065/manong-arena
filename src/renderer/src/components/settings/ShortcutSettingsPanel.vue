<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { applyAppShortcuts } from '../../bootstrap/setupAppShortcuts'
import {
  acceleratorFromKeyboardEvent,
  formatAcceleratorLabel,
  isValidAccelerator,
} from '@renderer/composables/shortcut-utils'
import { useGeneralSettings } from '@renderer/composables/useGeneralSettings'
import { useShortcutSettings, type ShortcutActionId } from '@renderer/composables/useShortcutSettings'
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'
import { NAlert, useMessage } from '../../ui'

const message = useMessage()
const { settings: generalSettings } = useGeneralSettings()
const { settings, catalog, save, reload } = useShortcutSettings()
const recordingId = ref<ShortcutActionId | null>(null)

const boolOptions = [
  { label: '已开启', value: true },
  { label: '关闭', value: false },
]

function persistEnabled(id: ShortcutActionId, enabled: boolean) {
  save({ [id]: { enabled } })
  applyAppShortcuts()
}

function startRecording(id: ShortcutActionId) {
  recordingId.value = id
}

function stopRecording() {
  recordingId.value = null
}

function onRecordingKeydown(event: KeyboardEvent) {
  if (!recordingId.value) return
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    stopRecording()
    return
  }

  const accel = acceleratorFromKeyboardEvent(event)
  if (!accel || !isValidAccelerator(accel)) return

  const id = recordingId.value
  save({ [id]: { accelerator: accel } })
  applyAppShortcuts()
  message.success('已保存')
  stopRecording()
}

onMounted(() => {
  reload()
  window.addEventListener('keydown', onRecordingKeydown, true)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onRecordingKeydown, true)
})
</script>

<template>
  <div class="settings-panel-body">
    <NAlert v-if="!generalSettings.enableShortcuts" type="warning" :bordered="false" style="margin-bottom: 16px">
      请先在「通用设置」中开启快捷键。
    </NAlert>

    <SettingsRow
      v-for="item in catalog"
      :key="item.id"
      :label="item.label"
      :hint="item.description"
    >
      <div class="shortcut-editor">
        <SettingsSegment
          variant="bool"
          :model-value="settings[item.id].enabled"
          :options="boolOptions"
          @update:model-value="(v) => persistEnabled(item.id, v as boolean)"
        />
        <button
          type="button"
          class="shortcut-kbd"
          :class="{ 'is-recording': recordingId === item.id }"
          :title="recordingId === item.id ? '按 Esc 取消' : '点击后按下新的快捷键'"
          @click="startRecording(item.id)"
        >
          {{ recordingId === item.id ? '按下快捷键…' : formatAcceleratorLabel(settings[item.id].accelerator) }}
        </button>
      </div>
    </SettingsRow>
  </div>
</template>
