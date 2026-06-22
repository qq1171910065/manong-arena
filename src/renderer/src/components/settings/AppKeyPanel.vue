<script setup lang="ts">
import { Copy, Key, ShieldCheck } from 'lucide-vue-next'
import type { PortalUserKey } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NTag } from '../../ui'

defineProps<{
  appKeyName: string
  appDisplayName: string
  appKey: PortalUserKey | null
  newKeyPlain: string
  creating: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  create: []
  copyNewKey: []
}>()

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
</script>

<template>
  <ProfileSectionLayout
    title="API Key 管理"
    :desc="`${appDisplayName} 的专用模型调用 Key。每个软件独立注册，仅可创建本软件 Key。`"
  >
    <template #actions>
      <NButton v-if="!appKey" type="primary" :loading="creating" @click="emit('create')">
        创建本软件 Key
      </NButton>
    </template>

    <div v-if="newKeyPlain" class="profile-key-reveal">
      <div class="profile-key-reveal__label">新创建的 Key（仅显示一次，请立即保存）</div>
      <div class="profile-key-reveal__row">
        <code class="code-inline">{{ newKeyPlain }}</code>
        <NButton size="small" quaternary @click="emit('copyNewKey')">
          <template #icon><Copy :size="14" /></template>
          复制
        </NButton>
      </div>
    </div>

    <NCard v-if="appKey" class="mntools-panel profile-detail-card app-key-card">
      <div class="app-key-status">
        <div class="app-key-status__icon" aria-hidden="true">
          <ShieldCheck :size="22" />
        </div>
        <div class="app-key-status__body">
          <strong>本软件 Key 已注册</strong>
          <p class="text-muted">Key 明文不会在界面展示，仅在本机安全缓存供模型调用使用。</p>
        </div>
        <NTag type="success" size="small" :bordered="false">已启用</NTag>
      </div>
      <dl class="profile-detail-grid app-key-detail">
        <div class="profile-detail-item">
          <dt>软件标识</dt>
          <dd><code class="code-inline">{{ appKeyName }}</code></dd>
        </div>
        <div class="profile-detail-item">
          <dt>Key 前缀</dt>
          <dd><code class="code-inline">{{ appKey.keyPrefix || '—' }}</code></dd>
        </div>
        <div class="profile-detail-item">
          <dt>注册时间</dt>
          <dd>{{ formatDateTime(appKey.createTime) }}</dd>
        </div>
      </dl>
    </NCard>

    <NCard v-else-if="!creating && !loading" class="mntools-panel">
      <div class="profile-empty">
        <Key :size="28" />
        <p>尚未注册本软件 Key</p>
        <span>点击右上角创建，系统将自动为本软件注册专用 API Key</span>
      </div>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.app-key-status {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 16px;
}

.app-key-status__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex-shrink: 0;
  color: var(--brand);
  border-radius: 14px;
  background: color-mix(in srgb, var(--brand) 12%, transparent);
}

.app-key-status__body {
  flex: 1;
  min-width: 0;
}

.app-key-status__body strong {
  display: block;
  color: #17205a;
  font-size: 15px;
  font-weight: 620;
}

.app-key-status__body p {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.6;
}

.app-key-detail {
  margin-top: 4px;
}

.profile-key-reveal__row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
