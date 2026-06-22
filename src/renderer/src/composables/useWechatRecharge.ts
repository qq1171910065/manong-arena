import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { portalApi, type PortalRechargeClientConfig, type PortalRechargeWechatOrder } from '../services/portal-api'

export function useWechatRecharge(onPaid?: () => void | Promise<void>) {
  const loading = ref(false)
  const submitting = ref(false)
  const polling = ref(false)
  const config = ref<PortalRechargeClientConfig | null>(null)
  const order = ref<PortalRechargeWechatOrder | null>(null)
  const paid = ref(false)
  const amountYuan = ref(10)
  const error = ref('')
  const qrDataUrl = ref('')
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let qrSession = 0

  const tiers = computed(() => config.value?.tiers || [])
  const selectedTier = computed(
    () => tiers.value.find((t) => t.yuan === amountYuan.value) || tiers.value[0] || null
  )
  const ready = computed(
    () => Boolean(config.value?.enabled && config.value.wxpayConfigured && tiers.value.length > 0)
  )
  const showTiers = computed(() => !order.value || order.value.status !== 'pending')

  function getQrColors() {
    const style = getComputedStyle(document.documentElement)
    const dark = style.getPropertyValue('--qr-fg').trim() || '#0f172a'
    const light = style.getPropertyValue('--qr-bg').trim() || '#ffffff'
    return { dark, light }
  }

  async function paintQr(raw: string) {
    qrSession++
    const session = qrSession
    qrDataUrl.value = ''
    const trimmed = raw.trim()
    if (!trimmed) return
    try {
      const { default: QRCode } = await import('qrcode')
      const dataUrl = await QRCode.toDataURL(trimmed, {
        width: 296,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: getQrColors(),
      })
      if (session === qrSession) qrDataUrl.value = dataUrl
    } catch {
      if (session === qrSession) qrDataUrl.value = ''
    }
  }

  watch(
    () => order.value?.code_url?.trim() ?? order.value?.codeUrl?.trim() ?? '',
    (raw) => {
      if (!raw) {
        qrSession++
        qrDataUrl.value = ''
        return
      }
      void paintQr(raw)
    }
  )

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    polling.value = false
  }

  function resetOrder() {
    stopPolling()
    order.value = null
    paid.value = false
    error.value = ''
    qrSession++
    qrDataUrl.value = ''
  }

  function startPolling(orderId: number) {
    stopPolling()
    polling.value = true
    pollTimer = setInterval(async () => {
      try {
        const status = await portalApi.rechargeStatus(orderId)
        if (status.status === 'paid') {
          stopPolling()
          paid.value = true
          await onPaid?.()
        } else if (
          status.status === 'closed' ||
          status.status === 'failed' ||
          status.status === 'expired'
        ) {
          stopPolling()
          const expired = status.status === 'expired'
          resetOrder()
          if (expired) {
            error.value = '二维码已过期，请重新选择档位下单'
          }
        }
      } catch {
        /* ignore single poll failure */
      }
    }, 2500)
  }

  async function loadConfig() {
    loading.value = true
    try {
      const cfg = await portalApi.rechargeConfig()
      config.value = cfg
      if (cfg.tiers?.[0]) amountYuan.value = cfg.tiers[0].yuan
    } catch {
      config.value = null
    } finally {
      loading.value = false
    }
  }

  function mapRechargeError(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e || '')
    if (/pem/i.test(msg) || /invalid type/i.test(msg) || /BEGIN/i.test(msg) || /证书|密钥|apiclient/.test(msg)) {
      return (
        '微信支付证书/密钥格式无效。请联系管理员在 Platform 管理后台「设置 → 微信支付」检查：' +
        'privateKey 应为 apiclient_key.pem，publicKey 应为 apiclient_cert.pem，API v3 密钥填在 key 字段。'
      )
    }
    return msg.trim() || '创建充值订单失败'
  }

  async function createOrder() {
    const tier = selectedTier.value
    if (!tier || submitting.value) return
    submitting.value = true
    error.value = ''
    try {
      order.value = null
      const created = await portalApi.rechargeWechat(tier.yuan)
      order.value = created
      startPolling(created.rechargeRequestId)
    } catch (e) {
      error.value = mapRechargeError(e)
    } finally {
      submitting.value = false
    }
  }

  onBeforeUnmount(() => {
    stopPolling()
    qrSession++
  })

  return {
    loading,
    submitting,
    polling,
    config,
    order,
    paid,
    amountYuan,
    error,
    qrDataUrl,
    tiers,
    selectedTier,
    ready,
    showTiers,
    loadConfig,
    createOrder,
    resetOrder,
    stopPolling,
  }
}
