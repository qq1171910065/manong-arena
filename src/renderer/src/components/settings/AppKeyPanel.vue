<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Copy, Key } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import type { PortalUserKey } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import PortalDataTable from './PortalDataTable.vue'
import { NButton, NTag, NSpace, useMessage } from '../../ui'

const props = defineProps<{
  appKeyName: string
  keys: PortalUserKey[]
  appKey: PortalUserKey | null
  keyPlain: string
  newKeyPlain: string
  creating: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  create: []
  copyKey: []
}>()

const message = useMessage()
const revealKeyId = ref<number | null>(null)

const displayPlain = computed(() => props.newKeyPlain || props.keyPlain)

function formatDateTime(raw?: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function maskKey(key: string) {
  if (!key) return ''
  if (key.length <= 16) return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
  return `${key.slice(0, 10)}${'•'.repeat(12)}${key.slice(-6)}`
}

function isAppKey(row: PortalUserKey) {
  return row.name === props.appKeyName || (props.appKey?.id === row.id)
}

function keyStatusType(status: string) {
  return status === 'active' ? 'success' : status === 'revoked' ? 'error' : 'default'
}

function keyStatusLabel(status: string) {
  switch (status) {
    case 'active':
      return '有效'
    case 'revoked':
      return '已吊销'
    default:
      return status || '—'
  }
}

async function copyPlainKey() {
  if (!displayPlain.value) return
  await navigator.clipboard.writeText(displayPlain.value)
  message.success('已复制 API Key')
  emit('copyKey')
}

const columns = computed<DataTableColumns<PortalUserKey>>(() => [
  {
    title: '名称',
    key: 'name',
    ellipsis: { tooltip: true },
    render: (row) =>
      h('span', { class: 'app-key-name-cell' }, [
        row.name,
        row.isDefault ? h(NTag, { size: 'small', bordered: false, style: 'margin-left:6px' }, () => '默认') : null,
        isAppKey(row) ? h(NTag, { size: 'small', type: 'info', bordered: false, style: 'margin-left:6px' }, () => '本软件') : null,
      ]),
  },
  {
    title: 'Key 前缀',
    key: 'keyPrefix',
    render: (row) => h('code', { class: 'code-inline' }, row.keyPrefix || '—'),
  },
  {
    title: '状态',
    key: 'status',
    width: 88,
    render: (row) =>
      h(NTag, { type: keyStatusType(row.status), size: 'small', bordered: false }, () =>
        keyStatusLabel(row.status)
      ),
  },
  {
    title: '创建时间',
    key: 'createTime',
    width: 156,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: '密钥',
    key: 'secret',
    width: 220,
    render: (row) => {
      if (!isAppKey(row) || !displayPlain.value) {
        return h('span', { class: 'text-muted' }, '—')
      }
      const revealed = revealKeyId.value === row.id
      return h('div', { class: 'app-key-secret-cell' }, [
        h('code', { class: 'app-key-secret-cell__value' }, revealed ? displayPlain.value : maskKey(displayPlain.value)),
        h(
          NSpace,
          { size: 4, justify: 'end' },
          () => [
            h(
              NButton,
              {
                size: 'tiny',
                quaternary: true,
                onClick: () => {
                  revealKeyId.value = revealed ? null : row.id
                },
              },
              () => (revealed ? '隐藏' : '显示')
            ),
            h(NButton, { size: 'tiny', quaternary: true, onClick: () => void copyPlainKey() }, () => '复制'),
          ]
        ),
      ])
    },
  },
])
</script>

<template>
  <ProfileSectionLayout class="app-key-panel" title="API Key 管理" desc="查看与管理账号下所有 API Key。">
    <template #actions>
      <NButton v-if="!appKey" type="primary" size="small" :loading="creating" @click="emit('create')">
        <template #icon><Key :size="15" /></template>
        创建本软件 Key
      </NButton>
    </template>

    <div v-if="newKeyPlain" class="profile-key-reveal profile-key-reveal--new">
      <div class="profile-key-reveal__label">新创建的 Key（请立即保存）</div>
      <div class="profile-key-reveal__row">
        <code class="code-inline profile-key-code">{{ newKeyPlain }}</code>
        <NButton size="small" quaternary @click="copyPlainKey">
          <template #icon><Copy :size="14" /></template>
          复制
        </NButton>
      </div>
    </div>

    <div class="app-key-panel__table profile-list-region">
      <PortalDataTable
        v-if="keys.length || loading"
        flex-height
        :columns="columns"
        :data="keys"
        :loading="loading"
        :pagination="keys.length > 20 ? { pageSize: 20 } : false"
      />
      <div v-else class="profile-empty profile-empty--compact">
        <Key :size="28" />
        <p>暂无 API Key</p>
        <span>点击右上角为本软件创建专用 Key</span>
      </div>
    </div>
  </ProfileSectionLayout>
</template>

<style scoped>
.app-key-panel {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
}

.app-key-panel :deep(.profile-section) {
  height: 100%;
}

.app-key-panel :deep(.profile-section__body) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-key-panel__table {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-key-panel__table :deep(.portal-data-table-wrap) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-key-secret-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  max-width: 100%;
}

.app-key-secret-cell__value {
  display: block;
  max-width: 200px;
  font-size: 11px;
  word-break: break-all;
  text-align: right;
}

.app-key-secret-cell__actions {
  display: flex;
  gap: 2px;
}

.profile-key-reveal {
  flex: 0 0 auto;
  margin-bottom: 4px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--color-warning) 35%, var(--line));
  background: color-mix(in srgb, var(--color-warning) 8%, var(--surface));
}

.profile-key-reveal--new .profile-key-reveal__label {
  color: #b45309;
  font-size: 12px;
  font-weight: 650;
  margin-bottom: 8px;
}

.profile-key-reveal__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.profile-key-code {
  flex: 1;
  min-width: 0;
  word-break: break-all;
}
</style>
