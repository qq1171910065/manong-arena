<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CloudDownload, FolderOpen, Loader2 } from 'lucide-vue-next'
import {
  ensureInitialAssets,
  getAssetPackStatus,
  installAssetPackFromFile,
} from '@renderer/services/arena/asset-pack-service'
import type { AssetPackStatus } from '@shared/arena/asset-pack-api'

const emit = defineEmits<{
  error: [message: string]
  changed: []
}>()

const status = ref<AssetPackStatus | null>(null)
const busy = ref(false)
const progressLabel = ref('')

const statusLabel = computed(() => {
  if (!status.value) return '检测中…'
  if (status.value.ready) {
    return `已安装 v${status.value.installedVersion || '—'}`
  }
  return '未安装'
})

const manifestHint = computed(() => {
  if (!status.value?.manifestVersion) {
    return '内置素材清单未配置'
  }
  const file = status.value.manifestFileName ? ` · ${status.value.manifestFileName}` : ''
  return `内置 v${status.value.manifestVersion}${file}`
})

async function refresh() {
  status.value = await getAssetPackStatus()
}

async function runWithProgress(action: () => Promise<void>) {
  busy.value = true
  progressLabel.value = '准备中…'
  emit('error', '')
  const unsubscribe =
    typeof window.api.onAssetPackProgress === 'function'
      ? window.api.onAssetPackProgress((payload) => {
          if (payload.label) progressLabel.value = payload.label
        })
      : undefined
  try {
    await action()
    await refresh()
    emit('changed')
  } catch (error) {
    const message = error instanceof Error ? error.message : '素材包操作失败'
    if (message !== 'CANCELED') emit('error', message)
  } finally {
    unsubscribe?.()
    busy.value = false
    progressLabel.value = ''
  }
}

async function downloadFromCdn() {
  await runWithProgress(() => ensureInitialAssets())
}

async function loadFromFile() {
  await runWithProgress(() => installAssetPackFromFile())
}

onMounted(() => {
  void refresh().catch((error) => emit('error', error instanceof Error ? error.message : '读取素材状态失败'))
})

defineExpose({ refresh })
</script>

<template>
  <section class="asset-pack">
    <h4>初始素材包</h4>
    <p class="asset-pack__desc" title="角色立绘与玩法封面等大体积素材不随安装包分发。首次使用请在初始化向导下载，或在此从 OSS / 本地 zip 载入。">
      立绘与封面等大素材需单独下载或载入 zip
    </p>

    <div class="asset-pack__status">
      <span class="asset-pack__status-label">状态</span>
      <strong :class="{ 'is-ready': status?.ready }">{{ statusLabel }}</strong>
    </div>
    <p class="asset-pack__hint">{{ manifestHint }}</p>

    <div v-if="busy" class="asset-pack__progress">
      <Loader2 :size="15" class="spin" />
      <span>{{ progressLabel || '处理中…' }}</span>
    </div>

    <div class="asset-pack__actions">
      <button type="button" class="asset-pack__btn" :disabled="busy" @click="downloadFromCdn">
        <CloudDownload :size="16" />
        下载素材包
      </button>
      <button type="button" class="asset-pack__btn" :disabled="busy" @click="loadFromFile">
        <FolderOpen :size="16" />
        从本地 zip 载入
      </button>
    </div>
  </section>
</template>

<style scoped>
.asset-pack h4 {
  margin: 0 0 8px;
  color: #17205a;
  font-size: 15px;
  font-weight: 650;
}

.asset-pack__desc {
  margin: 0 0 12px;
  color: #7280b2;
  font-size: 12px;
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-pack__desc strong {
  color: #4a5688;
  font-weight: 600;
}

.asset-pack__status {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 6px;
}

.asset-pack__status-label {
  color: #7280b2;
  font-size: 12px;
}

.asset-pack__status strong {
  color: #c2410c;
  font-size: 14px;
}

.asset-pack__status strong.is-ready {
  color: #15803d;
}

.asset-pack__hint {
  margin: 0 0 12px;
  color: #8890b8;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-pack__progress {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #4f5d94;
  font-size: 12px;
}

.asset-pack__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.asset-pack__btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

.asset-pack__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
