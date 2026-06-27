<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { Activity, Bot, Copy, Key, RefreshCw, Server } from 'lucide-vue-next'
import ModelPickerField from '@renderer/components/arena/ModelPickerField.vue'
import { useModelService } from '@renderer/composables/useModelService'
import { settingsService } from '@renderer/services/arena'
import { DEFAULT_ARENA_MODEL_ID, MIMO_TTS_MODEL_ID } from '@shared/arena/constants'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, useMessage } from '../../ui'

const message = useMessage()
const {
  statusCards,
  apiBase,
  gatewayRoot,
  gatewayChatBase,
  models,
  loading,
  refreshAll,
} = useModelService()

const defaultModelId = ref(DEFAULT_ARENA_MODEL_ID)
const settingsReady = ref(false)
const savingDefaultModel = ref(false)

const statusIcons: Record<string, typeof Activity> = {
  platform: Server,
  gateway: Activity,
  key: Key,
  models: Bot,
}

async function loadDefaultModel() {
  const settings = await settingsService.get()
  defaultModelId.value = settings.defaultModelId || DEFAULT_ARENA_MODEL_ID
  await nextTick()
  settingsReady.value = true
}

let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(defaultModelId, (id) => {
  if (!settingsReady.value || !id) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    savingDefaultModel.value = true
    try {
      await settingsService.save({ defaultModelId: id })
      message.success('默认模型已保存')
    } catch (err) {
      message.error(err instanceof Error ? err.message : '保存失败')
    } finally {
      savingDefaultModel.value = false
    }
  }, 280)
})

async function copyGatewayUrl() {
  const url = gatewayRoot.value
  if (!url) return
  await navigator.clipboard.writeText(url)
  message.success('已复制模型网关地址')
}

async function copyChatUrl() {
  const url = gatewayChatBase.value
  if (!url) return
  await navigator.clipboard.writeText(url)
  message.success('已复制对话端点')
}

async function handleRefresh() {
  await refreshAll()
  message.success('连接状态已刷新')
}

onMounted(() => {
  void loadDefaultModel()
})
</script>

<template>
  <ProfileSectionLayout
    title="模型概览"
    desc="连接、网关与本机 Key 状态一览。"
  >
    <template #actions>
      <NButton quaternary size="small" :loading="loading" @click="handleRefresh">
        <template #icon><RefreshCw :size="14" /></template>
        刷新
      </NButton>
    </template>

    <div class="model-overview-grid">
      <article
        v-for="item in statusCards"
        :key="item.id"
        class="model-overview-stat"
        :class="item.ok ? 'is-ok' : 'is-warn'"
      >
        <div class="model-overview-stat__icon" aria-hidden="true">
          <component :is="statusIcons[item.id] || Activity" :size="18" />
        </div>
        <div class="model-overview-stat__body">
          <span class="model-overview-stat__label">{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <p :title="item.hint">{{ item.hint }}</p>
        </div>
        <span class="model-overview-stat__badge">{{ item.ok ? '正常' : '待处理' }}</span>
      </article>
    </div>

    <section class="portal-plain-block model-overview-default">
      <h4 class="portal-plain-block__title">语音合成模型（固定）</h4>
      <p class="model-overview-default__lead">
        局内角色发言与裁判播报均使用 <code>{{ MIMO_TTS_MODEL_ID }}</code>，不可在此修改。
        各角色的<strong>播报音色</strong>可在角色详情 → 说话方式中配置；裁判音色在设置 → 声音 / 玩法中调整。
      </p>
      <div class="model-overview-tts-lock">
        <span class="model-overview-tts-lock__badge">固定</span>
        <code>{{ MIMO_TTS_MODEL_ID }}</code>
      </div>
    </section>

    <section class="portal-plain-block model-overview-default">
      <h4 class="portal-plain-block__title">默认模型（兜底）</h4>
      <p class="model-overview-default__lead">
        与角色绑定、玩法系统模型等<strong>已选择的模型是两回事</strong>——那些场景会优先用各自配置的模型。
        此处设置的是<strong>最终兜底</strong>：仅在未单独配置、或所选模型在网关不可用时才会用到。
        帮助中心等无独立模型选项的功能，也会走此兜底。初始值：<code>{{ DEFAULT_ARENA_MODEL_ID }}</code>
      </p>
      <ModelPickerField
        v-model="defaultModelId"
        label="兜底模型"
        hint="全局 fallback，不覆盖已选模型"
        compact
        :disabled="!settingsReady || savingDefaultModel"
      />
    </section>

    <section class="portal-plain-block model-overview-endpoints">
      <h4 class="portal-plain-block__title">网关与端点</h4>
      <div class="model-overview-endpoint-list">
        <div class="model-overview-endpoint">
          <span>Platform API</span>
          <code>{{ apiBase }}</code>
        </div>
        <div class="model-overview-endpoint">
          <span>模型网关</span>
          <div class="model-overview-endpoint__row">
            <code>{{ gatewayRoot || '—' }}</code>
            <NButton v-if="gatewayRoot" size="tiny" quaternary @click="copyGatewayUrl">
              <template #icon><Copy :size="12" /></template>
            </NButton>
          </div>
        </div>
        <div class="model-overview-endpoint">
          <span>对话端点</span>
          <div class="model-overview-endpoint__row">
            <code>{{ gatewayChatBase || '—' }}</code>
            <NButton v-if="gatewayChatBase" size="tiny" quaternary @click="copyChatUrl">
              <template #icon><Copy :size="12" /></template>
            </NButton>
          </div>
        </div>
      </div>
    </section>

    <section v-if="models.length" class="portal-plain-block model-overview-models">
      <h4 class="portal-plain-block__title">可用模型</h4>
      <p class="model-overview-models__lead">
        当前网关共 <strong>{{ models.length }}</strong> 个可调用模型（来自 <code>/api/pricing</code>）。
      </p>
      <div class="model-overview-model-tags">
        <span v-for="model in models.slice(0, 24)" :key="model.id" class="model-overview-model-tag">{{ model.id }}</span>
        <span v-if="models.length > 24" class="model-overview-model-more">+{{ models.length - 24 }} 更多</span>
      </div>
    </section>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.model-overview-stat {
  position: relative;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr);
  gap: 12px;
  padding: 16px 16px 14px;
  border-radius: 16px;
  border: 1px solid var(--line);
  background: linear-gradient(145deg, var(--surface), color-mix(in srgb, var(--brand-soft) 35%, var(--surface)));
  box-shadow: 0 8px 22px color-mix(in srgb, var(--text) 4%, transparent);
}

.model-overview-stat.is-ok {
  border-color: color-mix(in srgb, var(--success) 28%, var(--line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--success) 6%, var(--surface)), var(--surface));
}

.model-overview-stat.is-warn {
  border-color: color-mix(in srgb, var(--color-warning) 30%, var(--line));
  background: linear-gradient(145deg, color-mix(in srgb, var(--color-warning) 7%, var(--surface)), var(--surface));
}

.model-overview-stat__icon {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 13px;
  color: var(--brand);
  background: color-mix(in srgb, var(--brand) 12%, var(--surface));
}

.model-overview-stat.is-ok .model-overview-stat__icon {
  color: #15803d;
  background: color-mix(in srgb, var(--success) 14%, var(--surface));
}

.model-overview-stat.is-warn .model-overview-stat__icon {
  color: #b45309;
  background: color-mix(in srgb, var(--color-warning) 14%, var(--surface));
}

.model-overview-stat__body {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.model-overview-stat__label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.model-overview-stat__body strong {
  font-size: 20px;
  font-weight: 720;
  letter-spacing: -0.02em;
  color: var(--text);
}

.model-overview-stat__body p {
  margin: 0;
  color: var(--soft);
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.model-overview-stat__badge {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--soft);
  background: color-mix(in srgb, var(--text) 6%, transparent);
}

.model-overview-stat.is-ok .model-overview-stat__badge {
  color: #15803d;
  background: color-mix(in srgb, var(--success) 14%, transparent);
}

.model-overview-stat.is-warn .model-overview-stat__badge {
  color: #b45309;
  background: color-mix(in srgb, var(--color-warning) 14%, transparent);
}

.model-overview-default__lead code {
  font-size: 12px;
}

.model-overview-tts-lock {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px dashed color-mix(in srgb, var(--brand) 24%, var(--line));
  background: color-mix(in srgb, var(--brand) 6%, var(--surface-soft));
}

.model-overview-tts-lock code {
  font-size: 13px;
  color: var(--text);
}

.model-overview-tts-lock__badge {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  color: var(--brand);
  background: color-mix(in srgb, var(--brand) 12%, transparent);
}

.model-overview-default__lead {
  margin: 0 0 14px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.65;
}

.model-overview-default__lead code {
  font-size: 12px;
}

.model-overview-endpoints {
  margin-top: 4px;
}

.model-overview-endpoint-list {
  display: grid;
  gap: 12px;
}

.model-overview-endpoint {
  display: grid;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: var(--surface-soft);
}

.model-overview-endpoint > span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 600;
}

.model-overview-endpoint code,
.model-overview-endpoint__row code {
  font-size: 12px;
  word-break: break-all;
}

.model-overview-endpoint__row {
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

.model-overview-models__lead {
  margin: 0 0 12px;
  color: var(--soft);
  font-size: 13px;
}

.model-overview-models__lead strong {
  color: var(--brand);
}

.model-overview-model-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.model-overview-model-tag {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--text);
  background: color-mix(in srgb, var(--brand) 10%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--brand) 16%, var(--line));
}

.model-overview-model-more {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--muted);
  background: var(--surface-soft);
}

@media (max-width: 1100px) {
  .model-overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .model-overview-grid {
    grid-template-columns: 1fr;
  }
}
</style>
