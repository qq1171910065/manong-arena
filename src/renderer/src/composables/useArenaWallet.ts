import { onMounted, onUnmounted, ref } from 'vue'
import { billingService } from '@renderer/services/arena'

const balanceCents = ref<number | null>(null)
const loading = ref(false)

/** 标题栏余额轮询间隔 */
const REFRESH_MS = 30_000

let refreshTimer: ReturnType<typeof setInterval> | null = null
let mountCount = 0
let listeningVisibility = false

async function refresh(force = false) {
  loading.value = true
  try {
    balanceCents.value = await billingService.getBalanceCents(force)
  } finally {
    loading.value = false
  }
}

function onVisibilityChange() {
  if (document.visibilityState === 'visible') void refresh(true)
}

function startPolling() {
  if (mountCount === 0) return
  if (!refreshTimer) {
    void refresh(true)
    refreshTimer = setInterval(() => void refresh(true), REFRESH_MS)
  }
  if (!listeningVisibility) {
    document.addEventListener('visibilitychange', onVisibilityChange)
    listeningVisibility = true
  }
}

function stopPolling() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (listeningVisibility) {
    document.removeEventListener('visibilitychange', onVisibilityChange)
    listeningVisibility = false
  }
}

export function useArenaWallet() {
  onMounted(() => {
    mountCount += 1
    startPolling()
  })

  onUnmounted(() => {
    mountCount = Math.max(0, mountCount - 1)
    if (mountCount === 0) stopPolling()
  })

  return {
    balanceCents,
    loading,
    refresh,
    formatBalance: billingService.formatBalance,
  }
}
