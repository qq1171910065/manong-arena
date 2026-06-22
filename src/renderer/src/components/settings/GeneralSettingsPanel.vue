<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { applyAppShortcuts } from '../../bootstrap/setupAppShortcuts'
import { getAppFeatures } from '@renderer/composables/runtime-config'
import {
  applyGeneralSettingsEffects,
  type CloseBehavior,
  type FontScale,
  useGeneralSettings,
} from '@renderer/composables/useGeneralSettings'
import { setSidebarCollapsed } from '@renderer/composables/useSidebar'
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'
import { NButton, useMessage } from '../../ui'

const message = useMessage()
const { settings, save, reload } = useGeneralSettings()
const features = getAppFeatures()

const hasTrayApi = features.tray && typeof window.api.getTrayHideOnClose === 'function'
const hasNotifyApi = typeof window.api.sendNotification === 'function'
const hasStartupApi = typeof window.api.setLoginItemSettings === 'function'

const boolOptions = [
  { label: '已开启', value: true },
  { label: '关闭', value: false },
]

const sidebarOptions = [
  { label: '展开', value: false },
  { label: '收起', value: true },
]

const densityOptions = [
  { label: '舒适', value: 'comfortable' as const },
  { label: '紧凑', value: 'compact' as const },
]

const fontScaleOptions = [
  { label: '小', value: 'sm' as FontScale },
  { label: '中', value: 'md' as FontScale },
  { label: '大', value: 'lg' as FontScale },
]

const closeOptions = computed(() => {
  const opts = [
    { label: '每次询问', value: 'ask' as CloseBehavior },
    { label: '直接退出', value: 'quit' as CloseBehavior },
  ]
  if (hasTrayApi) {
    opts.splice(1, 0, { label: '最小化到托盘', value: 'tray' as CloseBehavior })
  }
  return opts
})

function onCloseBehavior(v: CloseBehavior) {
  save({ closeBehavior: v })
}

function onSidebarDefault(collapsed: boolean) {
  save({ sidebarDefaultCollapsed: collapsed })
  setSidebarCollapsed(collapsed)
}

async function onLaunchAtStartup(v: boolean) {
  if (!hasStartupApi) return
  const r = await window.api.setLoginItemSettings?.(v)
  if (r?.ok) {
    save({ launchAtStartup: Boolean(r.openAtLogin) })
  } else {
    message.error(r?.error || '设置失败')
  }
}

async function initTray() {
  await window.api.setupTray?.()
  message.success('系统托盘已启用')
}

async function testNotification() {
  const r = await window.api.sendNotification?.('通知测试', '桌面通知已启用。')
  if (r?.ok) message.success('测试通知已发送')
  else message.error('发送失败，请检查系统通知权限')
}

function onShortcutsEnabled(v: boolean) {
  save({ enableShortcuts: v })
  applyAppShortcuts()
}

onMounted(async () => {
  reload()
  applyGeneralSettingsEffects()
  if (hasStartupApi) {
    const r = await window.api.getLoginItemSettings?.()
    if (r?.ok) save({ launchAtStartup: Boolean(r.openAtLogin) })
  }
})
</script>

<template>
  <div class="settings-panel-body">
    <SettingsRow v-if="hasStartupApi" label="开机启动">
      <SettingsSegment
        variant="bool"
        :model-value="settings.launchAtStartup"
        :options="boolOptions"
        @update:model-value="(v) => onLaunchAtStartup(v as boolean)"
      />
    </SettingsRow>

    <SettingsRow label="界面字体">
      <SettingsSegment
        :model-value="settings.fontScale"
        :options="fontScaleOptions"
        @update:model-value="(v) => save({ fontScale: v as FontScale })"
      />
    </SettingsRow>

    <SettingsRow label="侧栏默认状态">
      <SettingsSegment
        :model-value="settings.sidebarDefaultCollapsed"
        :options="sidebarOptions"
        @update:model-value="(v) => onSidebarDefault(v as boolean)"
      />
    </SettingsRow>

    <SettingsRow label="关闭按钮行为">
      <SettingsSegment
        :model-value="settings.closeBehavior"
        :options="closeOptions"
        @update:model-value="(v) => onCloseBehavior(v as CloseBehavior)"
      />
    </SettingsRow>

    <SettingsRow label="界面密度">
      <SettingsSegment
        :model-value="settings.uiDensity"
        :options="densityOptions"
        @update:model-value="(v) => save({ uiDensity: v as 'comfortable' | 'compact' })"
      />
    </SettingsRow>

    <SettingsRow label="启用快捷键">
      <SettingsSegment
        variant="bool"
        :model-value="settings.enableShortcuts"
        :options="boolOptions"
        @update:model-value="(v) => onShortcutsEnabled(v as boolean)"
      />
    </SettingsRow>

    <SettingsRow v-if="hasNotifyApi" label="桌面通知">
      <SettingsSegment
        variant="bool"
        :model-value="settings.enableDesktopNotifications"
        :options="boolOptions"
        @update:model-value="(v) => save({ enableDesktopNotifications: v as boolean })"
      />
    </SettingsRow>

    <SettingsRow label="退出登录前确认">
      <SettingsSegment
        variant="bool"
        :model-value="settings.confirmBeforeExit"
        :options="boolOptions"
        @update:model-value="(v) => save({ confirmBeforeExit: v as boolean })"
      />
    </SettingsRow>

    <SettingsRow v-if="features.showcase" label="示例页 Demo 标记">
      <SettingsSegment
        variant="bool"
        :model-value="settings.showDemoBadge"
        :options="boolOptions"
        @update:model-value="(v) => save({ showDemoBadge: v as boolean })"
      />
    </SettingsRow>

    <div v-if="hasTrayApi" class="settings-panel-actions">
      <NButton size="small" @click="initTray">启用系统托盘</NButton>
      <NButton v-if="hasNotifyApi && settings.enableDesktopNotifications" size="small" @click="testNotification">
        发送测试通知
      </NButton>
    </div>
  </div>
</template>
