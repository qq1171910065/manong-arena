<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { ChevronRight, Copy, RefreshCw } from 'lucide-vue-next'
import DetailEditDialog from '@renderer/components/arena/DetailEditDialog.vue'
import ModelPickerField from '@renderer/components/arena/ModelPickerField.vue'
import { useModelService } from '@renderer/composables/useModelService'
import { settingsService } from '@renderer/services/arena'
import { DEFAULT_ARENA_MODEL_ID, MIMO_TTS_MODEL_ID } from '@shared/arena/constants'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import { NButton, NTag, useMessage } from '../../ui'

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
const draftDefaultModelId = ref(DEFAULT_ARENA_MODEL_ID)
const settingsReady = ref(false)
const savingDefaultModel = ref(false)
const defaultDialogOpen = ref(false)
const ttsDialogOpen = ref(false)

function statusTagType(ok: boolean) {
  return ok ? ('success' as const) : ('warning' as const)
}

async function loadDefaultModel() {
  const settings = await settingsService.get()
  defaultModelId.value = settings.defaultModelId || DEFAULT_ARENA_MODEL_ID
  draftDefaultModelId.value = defaultModelId.value
  await nextTick()
  settingsReady.value = true
}

function openDefaultDialog() {
  draftDefaultModelId.value = defaultModelId.value
  defaultDialogOpen.value = true
}

async function saveDefaultModel() {
  if (!draftDefaultModelId.value) return
  savingDefaultModel.value = true
  try {
    await settingsService.save({ defaultModelId: draftDefaultModelId.value })
    defaultModelId.value = draftDefaultModelId.value
    defaultDialogOpen.value = false
    message.success('兜底模型已保存')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    savingDefaultModel.value = false
  }
}

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
  <ProfileSectionLayout title="模型概览" desc="连接状态、模型配置与网关信息。">
    <template #actions>
      <NButton quaternary size="small" :loading="loading" @click="handleRefresh">
        <template #icon><RefreshCw :size="14" /></template>
        刷新
      </NButton>
    </template>

    <SettingsBlock title="连接状态" desc="平台、网关与本机 Key 状态。">
      <SettingsInfoRow
        v-for="item in statusCards"
        :key="item.id"
        :label="item.label"
        :hint="item.hint"
      >
        <NTag :type="statusTagType(item.ok)" size="small" :bordered="false">{{ item.value }}</NTag>
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock title="模型配置" desc="语音合成与兜底对话模型。">
      <SettingsInfoRow label="语音合成模型" hint="局内 TTS 播报，当前版本固定">
        <button type="button" class="model-row-trigger" @click="ttsDialogOpen = true">
          <code>{{ MIMO_TTS_MODEL_ID }}</code>
          <ChevronRight :size="14" />
        </button>
      </SettingsInfoRow>
      <SettingsInfoRow label="兜底对话模型" hint="未单独配置时的全局 fallback">
        <button
          type="button"
          class="model-row-trigger"
          :disabled="!settingsReady"
          @click="openDefaultDialog"
        >
          <code>{{ defaultModelId }}</code>
          <ChevronRight :size="14" />
        </button>
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock title="网关与端点" desc="Platform API 与模型网关地址。">
      <SettingsInfoRow label="Platform API">
        <code class="code-inline">{{ apiBase }}</code>
      </SettingsInfoRow>
      <SettingsInfoRow label="模型网关">
        <div class="model-row-inline">
          <code class="code-inline">{{ gatewayRoot || '—' }}</code>
          <NButton v-if="gatewayRoot" size="tiny" quaternary @click="copyGatewayUrl">
            <template #icon><Copy :size="12" /></template>
          </NButton>
        </div>
      </SettingsInfoRow>
      <SettingsInfoRow label="对话端点">
        <div class="model-row-inline">
          <code class="code-inline">{{ gatewayChatBase || '—' }}</code>
          <NButton v-if="gatewayChatBase" size="tiny" quaternary @click="copyChatUrl">
            <template #icon><Copy :size="12" /></template>
          </NButton>
        </div>
      </SettingsInfoRow>
      <SettingsInfoRow label="可用模型" :value="`${models.length} 个`" hint="来自网关定价表" />
    </SettingsBlock>

    <DetailEditDialog
      v-model="defaultDialogOpen"
      title="兜底对话模型"
      subtitle="全局 fallback"
      save-label="保存"
      :saving="savingDefaultModel"
      @save="saveDefaultModel"
    >
      <ModelPickerField
        v-model="draftDefaultModelId"
        label="兜底模型"
        hint="角色未绑定或所选模型不可用时使用。"
        :disabled="savingDefaultModel"
      />
    </DetailEditDialog>

    <DetailEditDialog
      v-model="ttsDialogOpen"
      title="语音合成模型"
      subtitle="TTS 模型"
      save-label="知道了"
      @save="ttsDialogOpen = false"
    >
      <p class="model-dialog-note">
        当前版本局内角色发言与裁判播报固定使用下方模型；音色可在角色详情或声音设置中调整。
      </p>
      <ModelPickerField
        :model-value="MIMO_TTS_MODEL_ID"
        label="语音模型"
        hint="当前固定，暂不支持切换"
        disabled
      />
    </DetailEditDialog>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-row-trigger {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  cursor: pointer;
  text-align: right;
}

.model-row-trigger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.model-row-trigger code {
  font-size: 12px;
  word-break: break-all;
}

.model-row-trigger:hover:not(:disabled) {
  color: var(--brand);
}

.model-row-inline {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  max-width: 100%;
}

.model-row-inline code {
  word-break: break-all;
  text-align: right;
}

.model-dialog-note {
  margin: 0 0 14px;
  color: var(--soft);
  font-size: 13px;
  line-height: 1.6;
}
</style>
