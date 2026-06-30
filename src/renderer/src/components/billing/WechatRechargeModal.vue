<script setup lang="ts">
import { computed, watch } from 'vue'
import { CheckCircle2, Coins, Loader2, QrCode, Sparkles, Wallet } from 'lucide-vue-next'
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

const selectedPoints = computed(() => {
  if (!selectedTier.value) return 0
  return tierAppPoints(selectedTier.value, config.value?.pointsPerYuan)
})

function isFeaturedTier(index: number) {
  return index === 1 && tiers.value.length > 2
}

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
          <div v-if="step === 'pick' && selectedTier" class="recharge-modal-summary">
            <div class="recharge-modal-summary__row">
              <div>
                <p class="recharge-modal-summary__caption">已选档位</p>
                <div class="recharge-modal-summary__amount">¥{{ selectedTier.yuan }}</div>
                <p v-if="selectedTier.label" class="recharge-modal-summary__label">
                  {{ selectedTier.label }}
                </p>
              </div>
              <div class="recharge-modal-summary__points">
                <Coins :size="18" />
                <div>
                  <strong>{{ selectedPoints.toLocaleString() }}</strong>
                  <span>积分到账</span>
                </div>
              </div>
            </div>
          </div>

          <section v-if="step === 'pick'" class="recharge-modal-section">
            <p class="recharge-modal-section__label">选择充值档位</p>
            <div class="recharge-modal-tier-grid">
              <button
                v-for="(tier, index) in tiers"
                :key="tier.yuan"
                type="button"
                class="recharge-modal-tier"
                :class="{
                  'is-active': amountYuan === tier.yuan,
                  'is-featured': isFeaturedTier(index),
                }"
                :disabled="submitting"
                @click="amountYuan = tier.yuan"
              >
                <span v-if="isFeaturedTier(index)" class="recharge-modal-tier__badge">
                  <Sparkles :size="11" />
                  推荐
                </span>
                <span
                  v-if="amountYuan === tier.yuan"
                  class="recharge-modal-tier__check"
                  aria-hidden="true"
                >
                  <CheckCircle2 :size="15" />
                </span>
                <span class="recharge-modal-tier__amount">
                  <strong>{{ tier.yuan }}</strong>
                  <em>元</em>
                </span>
                <span class="recharge-modal-tier__label">{{ tier.label || `${tier.yuan} 元档` }}</span>
                <span class="recharge-modal-tier__points">
                  <Coins :size="13" />
                  {{ tierAppPoints(tier, config?.pointsPerYuan).toLocaleString() }} 积分
                </span>
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
  border-radius: 16px;
  border: 1px solid color-mix(in srgb, var(--brand) 22%, var(--line));
  background:
    radial-gradient(ellipse 120% 90% at 100% 0%, color-mix(in srgb, var(--brand) 14%, transparent), transparent),
    linear-gradient(155deg, color-mix(in srgb, var(--surface) 94%, #fff), color-mix(in srgb, var(--brand-soft) 32%, var(--surface)));
}

.recharge-modal-summary__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.recharge-modal-summary__caption {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--soft);
}

.recharge-modal-summary__amount {
  font-size: clamp(1.75rem, 4vw, 2.125rem);
  font-weight: 720;
  letter-spacing: -0.03em;
  color: var(--brand);
  line-height: 1.1;
}

.recharge-modal-summary__label {
  margin: 6px 0 0;
  font-size: var(--text-sm);
  color: var(--muted);
}

.recharge-modal-summary__points {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  padding: 10px 14px;
  border-radius: 12px;
  border: 1px solid color-mix(in srgb, var(--brand) 16%, var(--line));
  background: color-mix(in srgb, var(--brand) 8%, var(--surface));
  color: var(--brand);
}

.recharge-modal-summary__points strong {
  display: block;
  font-size: 1.125rem;
  font-weight: 720;
  line-height: 1.1;
  letter-spacing: -0.02em;
}

.recharge-modal-summary__points span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.82;
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
  grid-template-columns: repeat(auto-fill, minmax(142px, 1fr));
  gap: 12px;
}

.recharge-modal-tier {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 128px;
  padding: 16px 16px 14px;
  border: 1px solid color-mix(in srgb, var(--brand) 14%, var(--line));
  border-radius: 16px;
  background:
    radial-gradient(ellipse 120% 80% at 100% 0%, color-mix(in srgb, var(--brand) 10%, transparent), transparent),
    linear-gradient(160deg, color-mix(in srgb, var(--surface) 96%, #fff), color-mix(in srgb, var(--brand-soft) 28%, var(--surface)));
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    box-shadow 0.18s ease;
}

.recharge-modal-tier:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--brand) 38%, var(--line));
  box-shadow: 0 14px 28px color-mix(in srgb, var(--brand) 12%, transparent);
}

.recharge-modal-tier:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.recharge-modal-tier:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.recharge-modal-tier.is-featured {
  border-color: color-mix(in srgb, var(--brand) 42%, var(--line));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--brand) 10%, transparent);
}

.recharge-modal-tier.is-active {
  border-color: color-mix(in srgb, var(--brand) 58%, var(--line));
  background:
    radial-gradient(ellipse 120% 80% at 100% 0%, color-mix(in srgb, var(--brand) 18%, transparent), transparent),
    linear-gradient(160deg, color-mix(in srgb, var(--brand-soft) 72%, var(--surface)), color-mix(in srgb, var(--brand-soft) 42%, var(--surface)));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--brand) 24%, transparent),
    0 12px 28px color-mix(in srgb, var(--brand) 14%, transparent);
}

.recharge-modal-tier__badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--brand) 14%, transparent);
  color: var(--brand);
  font-size: 11px;
  font-weight: 650;
}

.recharge-modal-tier__check {
  position: absolute;
  top: 12px;
  right: 12px;
  color: var(--brand);
}

.recharge-modal-tier__amount {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--text);
}

.recharge-modal-tier__amount strong {
  font-size: 28px;
  font-weight: 720;
  line-height: 1;
  letter-spacing: -0.03em;
}

.recharge-modal-tier__amount em {
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  color: var(--muted);
}

.recharge-modal-tier__label {
  color: var(--soft);
  font-size: 12px;
  font-weight: 520;
}

.recharge-modal-tier__points {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid color-mix(in srgb, var(--brand) 10%, var(--line));
  width: 100%;
  color: var(--brand);
  font-size: 12px;
  font-weight: 600;
}

.recharge-modal-tier.is-active .recharge-modal-tier__points {
  border-top-color: color-mix(in srgb, var(--brand) 22%, var(--line));
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
  .recharge-modal-summary__row {
    flex-direction: column;
    align-items: flex-start;
  }

  .recharge-modal-summary__points {
    width: 100%;
  }

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
