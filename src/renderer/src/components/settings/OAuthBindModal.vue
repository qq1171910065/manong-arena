<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { RefreshCw } from 'lucide-vue-next'
import { NButton, NModal, NSpin, useMessage } from '../../ui'
import { authApi } from '@renderer/services'

const props = defineProps<{
  show: boolean
  channel: string
  channelLabel?: string
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  bound: []
}>()

const message = useMessage()

const loading = ref(false)
const qrDataUrl = ref('')
const error = ref('')
const bindState = ref('')
let pollTimer: ReturnType<typeof setInterval> | null = null
let pollGen = 0

function close() {
  emit('update:show', false)
}

function stopPoll() {
  pollGen++
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

async function startBind() {
  stopPoll()
  loading.value = true
  error.value = ''
  qrDataUrl.value = ''
  bindState.value = ''
  const gen = pollGen

  try {
    const res = await authApi.startOAuthBind(props.channel, 'zh')
    bindState.value = res.state
    try {
      const { default: QRCode } = await import('qrcode')
      qrDataUrl.value = await QRCode.toDataURL(res.authorizeUrl, { width: 220, margin: 1 })
    } catch {
      error.value = '二维码模块未安装'
      return
    }
    if (gen !== pollGen) return
    pollTimer = setInterval(() => void pollBind(gen), 2000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '绑定启动失败'
  } finally {
    loading.value = false
  }
}

async function pollBind(gen: number) {
  if (!bindState.value || gen !== pollGen) return
  try {
    const r = await authApi.pollOAuthBind(bindState.value)
    if (gen !== pollGen) return
    if (r.status === 'ok') {
      stopPoll()
      message.success('绑定成功')
      emit('bound')
      close()
    } else if (r.status === 'error') {
      stopPoll()
      error.value = r.message || '绑定失败'
    } else if (r.status === 'expired') {
      stopPoll()
      error.value = '二维码已过期，请刷新重试'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '轮询失败'
  }
}

watch(
  () => props.show,
  (open) => {
    if (open) void startBind()
    else stopPoll()
  }
)

onBeforeUnmount(() => stopPoll())
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="`${channelLabel || channel} 绑定`"
    style="max-width: 360px"
    @update:show="(v) => emit('update:show', v)"
  >
    <div class="oauth-bind-modal">
      <p class="text-muted oauth-bind-hint">请使用微信扫描二维码完成账号绑定</p>
      <NSpin :show="loading">
        <div class="oauth-bind-qr-frame">
          <img v-if="qrDataUrl" :src="qrDataUrl" alt="绑定二维码" class="oauth-bind-qr" />
          <div v-else class="oauth-bind-qr-empty">加载中…</div>
        </div>
      </NSpin>
      <NButton block quaternary :loading="loading" @click="startBind">
        <template #icon><RefreshCw :size="16" /></template>
        刷新二维码
      </NButton>
      <p v-if="error" class="oauth-bind-error">{{ error }}</p>
    </div>
  </NModal>
</template>

<style scoped>
.oauth-bind-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.oauth-bind-hint {
  margin: 0;
  text-align: center;
  font-size: 13px;
}

.oauth-bind-qr-frame {
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
  overflow: hidden;
  background: #fff;
}

.oauth-bind-qr {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.oauth-bind-qr-empty {
  color: var(--text-muted, #64748b);
  font-size: 13px;
}

.oauth-bind-error {
  margin: 0;
  color: var(--error-color, #dc2626);
  font-size: 13px;
  text-align: center;
}
</style>
