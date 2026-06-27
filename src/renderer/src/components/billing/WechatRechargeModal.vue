<script setup lang="ts">
import { computed, watch } from 'vue'
import { CheckCircle2, Loader2, QrCode, Wallet } from 'lucide-vue-next'
import { NAlert, NButton, NModal, NSpin } from '../../ui'
import { useWechatRecharge } from '@renderer/composables/useWechatRecharge'
import { yuanToPoints, tierAppPoints } from '@renderer/composables/fee-points'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  initialAmountYuan?: number
}>()

const emit = defineEmits<{ paid: []; closed: [] }>()

const {
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
  loadConfig,
  createOrder,
  resetOrder,
  stopPolling,
} = useWechatRecharge(() => emit('paid'))

const step = computed<'pick' | 'pay' | 'done'>(() => {
  if (paid.value) return 'done'
  if (order.value?.status === 'pending') return 'pay'
  return 'pick'
})

const orderAmountYuan = computed(
  () => Number(order.value?.amount_yuan ?? order.value?.amountYuan ?? selectedTier.value?.yuan ?? 0)
)
const orderPoints = computed(() => {
  const fromOrder = Number(order.value?.app_points)
  if (Number.isFinite(fromOrder) && fromOrder > 0) return Math.round(fromOrder)
  if (selectedTier.value) return tierAppPoints(selectedTier.value, config.value?.pointsPerYuan)
  return yuanToPoints(orderAmountYuan.value)
})

const orderNo = computed(() => String(order.value?.order_no || order.value?.outTradeNo || '—'))

const payStatusText = computed(() => (polling.value ? '等待支付确认…' : '请使用微信扫码'))

watch(show, async (open, wasOpen) => {
  if (open) {
    resetOrder()
    await loadConfig()
    const preset = Math.floor(Number(props.initialAmountYuan) || 0)
    if (preset > 0 && tiers.value.some((t) => t.yuan === preset)) {
      amountYuan.value = preset
    }
  } else {
    stopPolling()
    resetOrder()
    if (wasOpen === true) emit('closed')
  }
})

function close() {
  if (submitting.value) return
  show.value = false
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="recharge-modal"
    :mask-closable="!submitting"
    :closable="!submitting"
    :style="{ width: '540px', maxWidth: '94vw' }"
    @after-leave="emit('closed')"
  >
    <template #header>
      <div class="recharge-modal-head">
        <span class="recharge-modal-head__icon" aria-hidden="true">
          <Wallet :size="20" />
        </span>
        <div>
          <div class="recharge-modal-head__title">微信扫码充值</div>
          <div class="recharge-modal-head__desc text-muted">
            {{ config?.description?.trim() || '选择档位后生成二维码，支付成功后积分自动到账。' }}
          </div>
        </div>
      </div>
    </template>

    <NSpin :show="loading">
      <p v-if="!loading && !ready" class="recharge-modal-unready text-muted">
        充值功能暂未开放，请联系管理员配置微信支付。
      </p>

      <template v-else-if="ready">
        <NAlert v-if="error" type="error" :bordered="false" class="recharge-modal-alert">{{ error }}</NAlert>

        <div v-if="step === 'done'" class="recharge-modal-success">
          <CheckCircle2 :size="52" class="recharge-modal-success__icon" />
          <strong>支付成功</strong>
          <p>
            已充值 {{ orderAmountYuan.toFixed(2) }} 元 ·
            {{ orderPoints.toLocaleString() }} 积分
          </p>
        </div>

        <template v-else>
          <div v-if="step === 'pick' && amountYuan" class="recharge-modal-summary">
            <div class="recharge-modal-summary__amount">¥{{ amountYuan }}</div>
          </div>

          <section v-if="step === 'pick'" class="recharge-modal-section">
            <p class="recharge-modal-section__label">选择充值档位</p>
            <div class="recharge-modal-tier-grid">
              <button
                v-for="tier in tiers"
                :key="tier.yuan"
                type="button"
                class="recharge-modal-tier"
                :class="{ 'is-active': amountYuan === tier.yuan }"
                :disabled="submitting"
                @click="amountYuan = tier.yuan"
              >
                <strong>{{ tier.label || `${tier.yuan} 元` }}</strong>
              </button>
            </div>
          </section>

          <section v-else class="recharge-modal-section recharge-modal-pay">
            <div class="recharge-modal-pay__layout">
              <div class="recharge-modal-pay__qr-col">
                <div class="recharge-modal-pay__qr-wrap">
                  <img
                    v-if="qrDataUrl"
                    :src="qrDataUrl"
                    alt="微信支付二维码"
                    class="recharge-modal-pay__qr"
                  />
                  <div v-else class="recharge-modal-pay__qr recharge-modal-pay__qr--skeleton" aria-hidden="true">
                    <QrCode :size="28" />
                  </div>
                  <div v-if="polling" class="recharge-modal-pay__pulse" aria-hidden="true" />
                </div>
                <p class="recharge-modal-pay__hint text-muted">二维码有效约 5 分钟，超时请重新下单</p>
              </div>
              <ul class="recharge-modal-pay__meta">
                <li>
                  <span>支付金额</span>
                  <strong>¥{{ orderAmountYuan.toFixed(2) }}</strong>
                </li>
                <li>
                  <span>订单号</span>
                  <code>{{ orderNo }}</code>
                </li>
                <li>
                  <span>状态</span>
                  <strong>{{ payStatusText }}</strong>
                </li>
              </ul>
            </div>
          </section>
        </template>
      </template>
    </NSpin>

    <template #action>
      <div class="recharge-modal-actions">
        <NButton v-if="step === 'done'" type="primary" block @click="close">完成</NButton>
        <template v-else-if="ready">
          <NButton
            v-if="step === 'pick'"
            type="primary"
            block
            :loading="submitting"
            :disabled="loading || !selectedTier"
            @click="createOrder"
          >
            <template v-if="submitting" #icon>
              <Loader2 :size="16" class="spin" />
            </template>
            生成支付二维码
          </NButton>
        </template>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.recharge-modal-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.recharge-modal-head__icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  color: var(--on-brand);
  background: linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 72%, #6366f1));
}

.recharge-modal-head__title {
  font-size: var(--text-xl);
  font-weight: 650;
  letter-spacing: -0.02em;
}

.recharge-modal-head__desc {
  margin-top: 4px;
  font-size: var(--text-sm);
  line-height: 1.5;
}

.recharge-modal-unready {
  padding: 8px 0 4px;
}

.recharge-modal-alert {
  margin-bottom: 14px;
}

.recharge-modal-summary {
  padding: 16px 18px;
  margin-bottom: 16px;
  border-radius: var(--radius-md);
  border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent 55%),
    var(--surface-soft);
}

.recharge-modal-summary__amount {
  font-size: clamp(1.75rem, 4vw, 2.125rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  color: var(--brand);
  line-height: 1.1;
}

.recharge-modal-summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
  font-size: var(--text-sm);
  color: var(--muted);
}

.recharge-modal-section__label {
  margin: 0 0 10px;
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--soft);
}

.recharge-modal-tier-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.recharge-modal-tier {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid var(--line);
  border-radius: var(--radius-md);
  background: var(--surface);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    transform var(--transition-fast);
}

.recharge-modal-tier:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--brand) 35%, var(--line));
  transform: translateY(-1px);
}

.recharge-modal-tier.is-active {
  border-color: color-mix(in srgb, var(--brand) 55%, var(--line));
  background: color-mix(in srgb, var(--brand-soft) 70%, var(--surface));
  color: var(--brand);
}

.recharge-modal-tier strong {
  font-size: var(--text-base);
}

.recharge-modal-tier span {
  font-size: var(--text-xs);
  color: var(--muted);
}

.recharge-modal-tier.is-active span {
  color: color-mix(in srgb, var(--brand) 70%, var(--muted));
}

.recharge-modal-pay__layout {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 20px;
  align-items: center;
  padding: 16px 18px;
  border-radius: var(--radius-md);
  border: 1px solid var(--line);
  background: var(--surface-soft);
}

.recharge-modal-pay__qr-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.recharge-modal-pay__hint {
  margin: 0;
  max-width: 168px;
  text-align: center;
  font-size: var(--text-xs);
  line-height: 1.45;
}

.recharge-modal-pay__qr-wrap {
  position: relative;
  width: 168px;
  height: 168px;
}

.recharge-modal-pay__qr {
  width: 100%;
  height: 100%;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: var(--qr-bg);
  object-fit: contain;
}

.recharge-modal-pay__qr--skeleton {
  display: grid;
  place-items: center;
  color: var(--soft);
  animation: recharge-qr-pulse 1.1s ease-in-out infinite;
  background: linear-gradient(110deg, var(--bg-elevated), var(--line), var(--bg-elevated));
  background-size: 200% 100%;
}

.recharge-modal-pay__pulse {
  position: absolute;
  inset: -4px;
  border-radius: calc(var(--radius) + 4px);
  border: 2px solid color-mix(in srgb, var(--brand) 45%, transparent);
  animation: recharge-pulse 1.6s ease-out infinite;
  pointer-events: none;
}

.recharge-modal-pay__meta {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recharge-modal-pay__meta li {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.recharge-modal-pay__meta span {
  font-size: var(--text-xs);
  color: var(--muted);
}

.recharge-modal-pay__meta strong,
.recharge-modal-pay__meta code {
  font-size: var(--text-sm);
  color: var(--text);
  word-break: break-all;
}

.recharge-modal-pay__meta strong:first-of-type {
  color: var(--brand);
  font-size: var(--text-lg);
}

.recharge-modal-pay__meta code {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: var(--text-xs);
}

.recharge-modal-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 12px 12px;
  text-align: center;
}

.recharge-modal-success__icon {
  color: var(--success);
}

.recharge-modal-success strong {
  font-size: var(--text-xl);
}

.recharge-modal-success p {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}

.recharge-modal-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recharge-modal-actions__hint {
  margin: 0;
  text-align: center;
  font-size: var(--text-xs);
}

@keyframes recharge-qr-pulse {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}

@keyframes recharge-pulse {
  0% {
    opacity: 0.85;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(1.04);
  }
}

@media (max-width: 520px) {
  .recharge-modal-tier-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .recharge-modal-pay__layout {
    grid-template-columns: 1fr;
    justify-items: center;
  }

  .recharge-modal-pay__meta {
    width: 100%;
  }

  .recharge-modal-pay__meta li {
    align-items: flex-start;
  }
}
</style>
