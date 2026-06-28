<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Download, RotateCcw, Trash2 } from 'lucide-vue-next'
import { confirm } from '@renderer/composables/useAppDialog'
import FactoryResetDialog from './FactoryResetDialog.vue'
import AssetPackPanel from './AssetPackPanel.vue'
import { dataManagementService, formatUserMessage } from '@renderer/services/arena'
import type { ArenaStoreStats } from '@shared/arena/types'

const props = defineProps<{
  retentionDays: number
}>()

const emit = defineEmits<{
  error: [message: string]
}>()

const stats = ref<ArenaStoreStats | null>(null)
const dataMessage = ref('')
const dataBusy = ref(false)
const showFactoryReset = ref(false)
const factoryResetBusy = ref(false)
const assetPackPanel = ref<InstanceType<typeof AssetPackPanel> | null>(null)

async function loadStats() {
  stats.value = await dataManagementService.getStats()
}

async function runDataAction(action: () => Promise<void>, successMessage: string) {
  dataBusy.value = true
  dataMessage.value = ''
  emit('error', '')
  try {
    await action()
    await loadStats()
    dataMessage.value = successMessage
  } catch (err) {
    emit('error', formatUserMessage(err))
  } finally {
    dataBusy.value = false
  }
}

async function exportData() {
  await runDataAction(() => dataManagementService.exportBackup(), '本地数据已导出。')
}

async function clearMatches() {
  if (!(await confirm({
    title: '清除对局记录',
    message: '确定清除全部对局记录与快照吗？',
    detail: '此操作不可恢复。',
    tone: 'danger',
    confirmText: '清除',
  }))) return
  await runDataAction(() => dataManagementService.clearMatches(), '对局记录与快照已清除。')
}

async function clearLogs() {
  if (!(await confirm({
    title: '清除操作日志',
    message: '确定清除全部操作日志吗？',
    tone: 'warning',
    confirmText: '清除',
  }))) return
  await runDataAction(() => dataManagementService.clearLogs(), '操作日志已清除。')
}

async function pruneExpiredData() {
  if (!(await confirm({
    title: '清理过期对局',
    message: `确定清理 ${props.retentionDays} 天前的已结束对局吗？`,
    detail: '进行中的对局不会被删除。',
    tone: 'warning',
    confirmText: '清理',
  }))) return
  dataBusy.value = true
  dataMessage.value = ''
  emit('error', '')
  try {
    const removed = await dataManagementService.pruneExpired(props.retentionDays)
    await loadStats()
    dataMessage.value = removed > 0 ? `已清理 ${removed} 条过期对局。` : '没有需要清理的过期对局。'
  } catch (err) {
    emit('error', formatUserMessage(err))
  } finally {
    dataBusy.value = false
  }
}

async function confirmFactoryReset() {
  factoryResetBusy.value = true
  emit('error', '')
  try {
    await dataManagementService.factoryResetAndLogout()
  } catch (err) {
    factoryResetBusy.value = false
    emit('error', formatUserMessage(err))
  }
}

onMounted(() => {
  void loadStats().catch((err) => emit('error', formatUserMessage(err)))
})

defineExpose({ reload: loadStats })
</script>

<template>
  <div class="data-management">
    <AssetPackPanel
      ref="assetPackPanel"
      @error="(message) => emit('error', message)"
      @changed="() => void loadStats()"
    />

    <section class="data-block">
      <h4>本地数据概览</h4>
      <div v-if="stats" class="data-stats">
        <article><span>角色</span><strong>{{ stats.characterCount }}</strong></article>
        <article><span>玩法</span><strong>{{ stats.installedGameModeCount }}</strong></article>
        <article><span>对局</span><strong>{{ stats.matchCount }}</strong></article>
        <article><span>快照</span><strong>{{ stats.snapshotCount }}</strong></article>
        <article><span>日志</span><strong>{{ stats.logCount }}</strong></article>
      </div>
    </section>

    <section class="data-block">
      <h4>基本管理</h4>
      <div class="data-actions">
        <button type="button" class="data-action" :disabled="dataBusy" @click="exportData">
          <Download :size="16" />
          导出本地备份
        </button>
        <button type="button" class="data-action" :disabled="dataBusy" @click="clearMatches">
          <Trash2 :size="16" />
          清除全部对局记录
        </button>
        <button type="button" class="data-action" :disabled="dataBusy" @click="clearLogs">
          <Trash2 :size="16" />
          清除操作日志
        </button>
        <button type="button" class="data-action" :disabled="dataBusy" @click="pruneExpiredData">
          <RotateCcw :size="16" />
          按保留周期清理过期对局（{{ retentionDays }} 天）
        </button>
      </div>
      <p class="data-hint" title="导出备份会保存角色、对局、设置等本地 JSON 数据。清理操作仅影响本机，不会删除云端账号。">导出本地 JSON；清理仅影响本机。</p>
    </section>

    <section class="data-block data-block--danger">
      <h4>危险操作</h4>
      <div class="danger-panel">
        <div>
          <strong>删除数据</strong>
          <span title="删除本应用内的全部本地数据（角色、玩法、对局、设置等），并退出登录。下次进入将重新初始化。此操作不可撤销。">清除全部本地数据并退出，不可撤销</span>
        </div>
        <button type="button" class="danger-action" :disabled="dataBusy || factoryResetBusy" @click="showFactoryReset = true">
          删除数据并退出登录
        </button>
      </div>
    </section>

    <p v-if="dataMessage" class="data-message">{{ dataMessage }}</p>

    <FactoryResetDialog
      :open="showFactoryReset"
      :busy="factoryResetBusy"
      @close="showFactoryReset = false"
      @confirm="confirmFactoryReset"
    />
  </div>
</template>

<style scoped>
.data-management {
  display: grid;
  gap: 18px;
}

.data-block h4 {
  margin: 0 0 10px;
  color: #17205a;
  font-size: 15px;
  font-weight: 650;
}

.data-stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.data-stats article {
  padding: 14px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.42);
}

.data-stats span {
  display: block;
  color: #7280b2;
  font-size: 12px;
}

.data-stats strong {
  display: block;
  margin-top: 4px;
  color: #17205a;
  font-size: 22px;
  font-weight: 680;
}

.data-actions {
  display: grid;
  gap: 8px;
}

.data-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: fit-content;
  height: 36px;
  padding: 0 14px;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 10px;
  color: #26305e;
  background: rgba(255, 255, 255, 0.58);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.data-action:disabled,
.danger-action:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.data-hint {
  margin: 10px 0 0;
  color: #7a83ae;
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.data-block--danger .danger-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
  border: 1px solid rgba(239, 68, 68, 0.18);
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.06);
}

.danger-panel strong {
  display: block;
  color: #991b1b;
  font-size: 14px;
}

.danger-panel span {
  display: block;
  margin-top: 4px;
  color: #7a4a4a;
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.danger-action {
  flex: none;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: linear-gradient(180deg, #ef4444, #dc2626);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.data-message {
  margin: 0;
  padding: 10px 12px;
  border-radius: 10px;
  color: #1f9f65;
  background: rgba(34, 197, 94, 0.08);
  font-size: 13px;
}
</style>
