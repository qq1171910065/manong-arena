import { onMounted, ref } from 'vue'
import { billingService } from '@renderer/services/arena'

const balanceCents = ref<number | null>(null)
const loading = ref(false)

async function refresh(force = false) {
  loading.value = true
  try {
    balanceCents.value = await billingService.getBalanceCents(force)
  } finally {
    loading.value = false
  }
}

export function useArenaWallet() {
  onMounted(() => {
    void refresh()
  })

  return {
    balanceCents,
    loading,
    refresh,
    formatBalance: billingService.formatBalance,
  }
}
