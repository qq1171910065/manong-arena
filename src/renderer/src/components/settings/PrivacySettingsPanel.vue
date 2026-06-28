<script setup lang="ts">
import { h, onMounted, ref } from 'vue'
import type { DataTableColumns } from '../../ui'
import { clearStoredGatewayKey } from '@renderer/services'
import { API_BASE_URL_STORAGE_KEY } from '@renderer/services/config'
import { GENERAL_SETTINGS_DEFAULTS, useGeneralSettings } from '@renderer/composables/useGeneralSettings'
import SettingsRow from './SettingsRow.vue'
import { confirm } from '@renderer/composables/useAppDialog'
import { NButton, NDataTable, NEmpty, NSpin, useMessage } from '../../ui'

defineProps<{ embedded?: boolean }>()

interface Stat {
  module: string
  label: string
  bytes: number
  files: number
}

const message = useMessage()
const { save, reload } = useGeneralSettings()
const stats = ref<Stat[]>([])
const statsLoading = ref(false)
const hasStorageApi = typeof window.api.storageInspect === 'function'

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

const columns: DataTableColumns<Stat> = [
  { title: '模块', key: 'label' },
  { title: '占用', key: 'bytes', render: (row) => formatBytes(row.bytes) },
  { title: '文件', key: 'files', width: 72 },
  {
    title: '操作',
    key: 'actions',
    width: 88,
    render: (row) =>
      h(NButton, { size: 'small', onClick: () => purgeModule(row.module) }, () => '清理'),
  },
]

async function loadStats() {
  if (!hasStorageApi) return
  statsLoading.value = true
  try {
    stats.value = (await window.api.storageInspect?.()) || []
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载缓存信息失败')
    stats.value = []
  } finally {
    statsLoading.value = false
  }
}

async function purgeModule(module: string) {
  const label = stats.value.find((s) => s.module === module)?.label ?? module
  if (!(await confirm({
    title: '清理本地缓存',
    message: `确定清理「${label}」的本地数据吗？`,
    detail: '此操作不可撤销。',
    tone: 'warning',
    confirmText: '清理',
  }))) return
  const r = await window.api.storagePurge?.(module)
  if (r?.ok) {
    message.success(`已清理 ${formatBytes(r.freedBytes || 0)}`)
    await loadStats()
  } else {
    message.error(r?.error || '清理失败')
  }
}

async function clearLocalPrefs() {
  if (!(await confirm({
    title: '清除本地偏好',
    message: '将重置主题、通用偏好等本机设置（不影响登录态），确定继续？',
    tone: 'warning',
    confirmText: '清除',
  }))) return
  const keepKeys = new Set([
    'wb_portal_session',
    'token',
    'refreshToken',
    'userInfo',
    API_BASE_URL_STORAGE_KEY,
  ])
  const toRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && !keepKeys.has(key)) toRemove.push(key)
  }
  toRemove.forEach((k) => localStorage.removeItem(k))
  save({ ...GENERAL_SETTINGS_DEFAULTS })
  reload()
  message.success('本地偏好已清除，部分设置需重启应用后生效')
}

async function clearGatewayKey() {
  if (!(await confirm({
    title: '清除本机 API Key',
    message: '将删除本机保存的网关 Key，下次调用模型时会尝试自动重新创建。确定继续？',
    tone: 'warning',
    confirmText: '清除',
  }))) return
  clearStoredGatewayKey()
  message.success('本机 API Key 已清除')
}

onMounted(() => void loadStats())
</script>

<template>
  <div class="settings-panel-body">
    <SettingsRow label="本地缓存" hint="登录态不会出现在列表中">
      <NSpin :show="statsLoading" style="width: 100%">
        <NDataTable
          v-if="hasStorageApi && stats.length"
          :columns="columns"
          :data="stats"
          :bordered="false"
          size="small"
          style="width: 100%"
        />
        <NEmpty v-else-if="hasStorageApi && !statsLoading" description="暂无业务缓存" />
        <span v-else-if="!hasStorageApi" class="text-muted">未启用 storage 模块</span>
      </NSpin>
    </SettingsRow>

    <div class="settings-panel-actions">
      <NButton size="small" @click="clearLocalPrefs">清除本地偏好</NButton>
      <NButton size="small" @click="clearGatewayKey">清除本机 API Key</NButton>
      <NButton
        v-if="hasStorageApi"
        size="small"
        :loading="statsLoading"
        @click="loadStats"
      >
        刷新列表
      </NButton>
    </div>
  </div>
</template>
