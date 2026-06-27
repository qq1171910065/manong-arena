<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Eye, EyeOff, Key, ShieldCheck } from 'lucide-vue-next'
import type { PortalUserKey } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import { NButton, NTag, useMessage } from '../../ui'

const props = defineProps<{
  appKeyName: string
  appDisplayName: string
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
const revealKey = ref(false)

const displayKey = computed(() => props.newKeyPlain || props.keyPlain)
const maskedKey = computed(() => {
  const key = displayKey.value
  if (!key) return ''
  if (key.length <= 16) return `${key.slice(0, 4)}${'•'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`
  return `${key.slice(0, 10)}${'•'.repeat(12)}${key.slice(-6)}`
})

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

async function copyDisplayKey() {
  if (!displayKey.value) return
  await navigator.clipboard.writeText(displayKey.value)
  message.success('已复制 API Key')
  emit('copyKey')
}
</script>

<template>
  <ProfileSectionLayout title="API Key 管理" desc="本软件专用模型 Key，每账号仅可注册一个。">
    <template #actions>
      <NButton v-if="!appKey" type="primary" size="small" :loading="creating" @click="emit('create')">
        创建本软件 Key
      </NButton>
    </template>

    <div v-if="newKeyPlain" class="profile-key-reveal profile-key-reveal--new">
      <div class="profile-key-reveal__label">新创建的 Key（请立即保存）</div>
      <div class="profile-key-reveal__row">
        <code class="code-inline profile-key-code">{{ newKeyPlain }}</code>
        <NButton size="small" quaternary @click="copyDisplayKey">
          <template #icon><Copy :size="14" /></template>
          复制
        </NButton>
      </div>
    </div>

    <section v-if="appKey" class="portal-plain-block app-key-card">
      <div class="app-key-status">
        <div class="app-key-status__icon" aria-hidden="true">
          <ShieldCheck :size="22" />
        </div>
        <div class="app-key-status__body">
          <strong>本软件 Key 已注册</strong>
          <p class="text-muted">Key 已绑定本软件，对局与模型调试共用。下方可查看完整密钥并复制。</p>
        </div>
        <NTag type="success" size="small" :bordered="false">已启用</NTag>
      </div>

      <div v-if="displayKey" class="app-key-secret">
        <div class="app-key-secret__head">
          <span>密钥内容</span>
          <div class="app-key-secret__actions">
            <NButton size="tiny" quaternary @click="revealKey = !revealKey">
              <template #icon><component :is="revealKey ? EyeOff : Eye" :size="14" /></template>
              {{ revealKey ? '隐藏' : '显示' }}
            </NButton>
            <NButton size="tiny" quaternary @click="copyDisplayKey">
              <template #icon><Copy :size="14" /></template>
              复制
            </NButton>
          </div>
        </div>
        <code class="app-key-secret__value">{{ revealKey ? displayKey : maskedKey }}</code>
      </div>

      <div v-else class="app-key-secret app-key-secret--empty">
        <Key :size="18" />
        <span>本机尚未缓存密钥明文，刷新页面或重新登录后会自动同步。</span>
      </div>

      <SettingsBlock title="密钥元数据" desc="软件标识、Key 名称与前缀等登记信息。">
        <SettingsInfoRow label="软件标识">
          <code class="code-inline">{{ appKeyName }}</code>
        </SettingsInfoRow>
        <SettingsInfoRow label="Key 名称">
          <code class="code-inline">{{ appKey.name }}</code>
        </SettingsInfoRow>
        <SettingsInfoRow label="Key 前缀">
          <code class="code-inline">{{ appKey.keyPrefix || '—' }}</code>
        </SettingsInfoRow>
        <SettingsInfoRow label="注册时间" :value="formatDateTime(appKey.createTime)" />
      </SettingsBlock>
    </section>

    <section v-else-if="!creating && !loading" class="portal-plain-block">
      <div class="profile-empty">
        <Key :size="28" />
        <p>尚未注册本软件 Key</p>
        <span>点击右上角创建，系统将自动为本软件注册专用 API Key</span>
      </div>
    </section>
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

.app-key-secret {
  margin-bottom: 16px;
  padding: 14px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
  background: color-mix(in srgb, var(--brand-soft) 40%, var(--surface));
}

.app-key-secret--empty {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 12px 14px;
  border-radius: 12px;
  color: var(--muted);
  font-size: 13px;
  background: var(--surface-soft);
  border: 1px dashed var(--line);
}

.app-key-secret__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.app-key-secret__head > span {
  color: var(--soft);
  font-size: 12px;
  font-weight: 650;
}

.app-key-secret__actions {
  display: flex;
  gap: 4px;
}

.app-key-secret__value {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--line);
  font-size: 12px;
  line-height: 1.65;
  word-break: break-all;
  white-space: pre-wrap;
  color: var(--text);
}

.profile-key-reveal {
  margin-bottom: 14px;
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

.app-key-detail {
  margin-top: 4px;
}
</style>
