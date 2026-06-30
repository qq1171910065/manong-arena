<script setup lang="ts">
import { Coins, QrCode, Sparkles, Wallet } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import type {
  PortalRechargeClientConfig,
  PortalRechargeRecord,
  PortalWalletSummary,
} from '@renderer/services'
import { tierAppPoints } from '@renderer/composables/fee-points'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import PortalDataTable from './PortalDataTable.vue'
import { NButton } from '../../ui'

defineProps<{
  wallet: PortalWalletSummary | null
  balancePoints: number
  rechargeConfig: PortalRechargeClientConfig | null
  rechargeReady: boolean
  rechargeRecords: PortalRechargeRecord[]
  rechargeLoading: boolean
  rechargeColumns: DataTableColumns<PortalRechargeRecord>
  rechargePagination: { page: number; pageSize: number; itemCount: number; showSizePicker?: boolean }
}>()

const emit = defineEmits<{
  recharge: [yuan?: number]
  pageChange: [page: number]
  pageSizeChange: [pageSize: number]
}>()
</script>

<template>
  <ProfileSectionLayout title="钱包充值" desc="查看余额、充值档位与订单记录。">
    <template #actions>
      <NButton v-if="rechargeReady" type="primary" size="small" @click="emit('recharge')">
        <template #icon><QrCode :size="15" /></template>
        微信扫码充值
      </NButton>
    </template>

    <SettingsBlock title="当前余额" desc="积分余额与累计充值、消费概览。">
      <SettingsInfoRow label="积分余额" :value="balancePoints.toLocaleString()" />
      <SettingsInfoRow
        label="折合金额"
        :value="`约 ${Number(wallet?.balanceYuan || 0).toFixed(2)} 元`"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计充值"
        :value="`${Number(wallet.totalRechargedYuan || 0).toFixed(2)} 元`"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计消费"
        :value="`${Number(wallet.totalConsumedYuan || wallet.usedYuan || 0).toFixed(2)} 元`"
      />
    </SettingsBlock>

    <SettingsBlock title="充值档位" :desc="rechargeConfig?.description?.trim() || '选择金额后使用微信扫码支付。'">
      <p v-if="!rechargeReady && !rechargeConfig?.tiers?.length" class="wallet-tier-empty">
        充值功能暂未开放，请联系管理员。
      </p>
      <div v-else-if="rechargeConfig?.tiers?.length" class="wallet-tier-grid">
        <button
          v-for="(tier, index) in rechargeConfig.tiers"
          :key="tier.yuan"
          type="button"
          class="wallet-tier-card"
          :class="{ 'is-featured': index === 1 && rechargeConfig.tiers.length > 2 }"
          :disabled="!rechargeReady"
          @click="emit('recharge', tier.yuan)"
        >
          <span v-if="index === 1 && rechargeConfig.tiers.length > 2" class="wallet-tier-card__badge">
            <Sparkles :size="11" />
            推荐
          </span>
          <span class="wallet-tier-card__amount">
            <strong>{{ tier.yuan }}</strong>
            <em>元</em>
          </span>
          <span class="wallet-tier-card__label">{{ tier.label || `${tier.yuan} 元档` }}</span>
          <span class="wallet-tier-card__points">
            <Coins :size="13" />
            {{ tierAppPoints(tier, rechargeConfig?.pointsPerYuan).toLocaleString() }} 积分
          </span>
        </button>
      </div>
      <div v-else class="profile-empty">
        <Wallet :size="28" />
        <p>暂无可用充值档位</p>
      </div>
    </SettingsBlock>

    <SettingsBlock title="充值记录" desc="微信扫码支付订单与到账状态。">
      <PortalDataTable
        v-if="rechargeRecords.length || rechargeLoading"
        remote
        :columns="rechargeColumns"
        :data="rechargeRecords"
        :loading="rechargeLoading"
        :pagination="rechargePagination"
        @update:page="emit('pageChange', $event)"
        @update:page-size="emit('pageSizeChange', $event)"
      />
      <div v-else class="profile-empty profile-empty--compact">
        <Wallet :size="24" />
        <p>暂无充值记录</p>
        <span>完成充值后将在此展示订单明细</span>
      </div>
    </SettingsBlock>
  </ProfileSectionLayout>
</template>

<style scoped>
.wallet-tier-empty {
  margin: 0;
  color: var(--muted);
  font-size: var(--text-sm);
}

.wallet-tier-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(148px, 1fr));
  gap: 12px;
}

.wallet-tier-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  min-height: 132px;
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

.wallet-tier-card:hover:not(:disabled) {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--brand) 38%, var(--line));
  box-shadow: 0 14px 28px color-mix(in srgb, var(--brand) 12%, transparent);
}

.wallet-tier-card:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

.wallet-tier-card:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.wallet-tier-card.is-featured {
  border-color: color-mix(in srgb, var(--brand) 42%, var(--line));
  box-shadow: 0 10px 24px color-mix(in srgb, var(--brand) 10%, transparent);
}

.wallet-tier-card__badge {
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

.wallet-tier-card__amount {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--text);
}

.wallet-tier-card__amount strong {
  font-size: 30px;
  font-weight: 720;
  line-height: 1;
  letter-spacing: -0.03em;
}

.wallet-tier-card__amount em {
  font-size: 14px;
  font-style: normal;
  font-weight: 600;
  color: var(--muted);
}

.wallet-tier-card__label {
  color: var(--soft);
  font-size: 12px;
  font-weight: 520;
}

.wallet-tier-card__points {
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
</style>
