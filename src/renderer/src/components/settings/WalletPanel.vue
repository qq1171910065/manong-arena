<script setup lang="ts">
import { computed } from 'vue'
import { Wallet } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import type {
  PortalRechargeClientConfig,
  PortalRechargeRecord,
  PortalWalletSummary,
} from '@renderer/services'
import { tierAppPoints } from '@renderer/composables/fee-points'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NDataTable } from '../../ui'

const props = defineProps<{
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

const rechargeDesc = computed(
  () =>
    props.rechargeConfig?.description?.trim() ||
    (props.rechargeReady
      ? '选择档位后使用微信扫码支付，支付成功后自动到账。'
      : '充值功能暂未开放，请联系管理员。')
)
</script>

<template>
  <ProfileSectionLayout title="钱包充值" :desc="rechargeDesc">
    <template #actions>
      <NButton v-if="rechargeReady" type="primary" @click="emit('recharge')">微信扫码充值</NButton>
    </template>

    <NCard class="mntools-panel profile-detail-card" title="当前余额">
      <div class="wallet-balance-block">
        <div>
          <span class="profile-wallet-hero__label">积分余额</span>
          <strong class="profile-wallet-hero__value">{{ balancePoints.toLocaleString() }}</strong>
          <span class="profile-wallet-hero__hint">
            约 {{ Number(wallet?.balanceYuan || 0).toFixed(2) }} 元
          </span>
        </div>
        <div v-if="wallet" class="wallet-balance-meta">
          <span>累计充值 {{ Number(wallet.totalRechargedYuan || 0).toFixed(2) }} 元</span>
          <span>累计消费 {{ Number(wallet.totalConsumedYuan || wallet.usedYuan || 0).toFixed(2) }} 元</span>
        </div>
      </div>
    </NCard>

    <NCard class="mntools-panel" title="充值档位">
      <div v-if="rechargeConfig?.tiers?.length" class="portal-tier-grid">
        <button
          v-for="tier in rechargeConfig.tiers"
          :key="tier.yuan"
          type="button"
          class="portal-tier"
          :disabled="!rechargeReady"
          @click="emit('recharge', tier.yuan)"
        >
          <strong>{{ tier.label || `${tier.yuan} 元` }}</strong>
          <span>{{ tierAppPoints(tier, rechargeConfig?.pointsPerYuan).toLocaleString() }} 积分</span>
        </button>
      </div>
      <div v-else class="profile-empty">
        <Wallet :size="28" />
        <p>暂无可用充值档位</p>
      </div>
    </NCard>

    <NCard class="mntools-panel profile-table-card profile-list-region" title="充值记录">
      <NDataTable
        v-if="rechargeRecords.length || rechargeLoading"
        remote
        :columns="rechargeColumns"
        :data="rechargeRecords"
        :loading="rechargeLoading"
        :pagination="rechargePagination"
        :bordered="false"
        size="small"
        @update:page="emit('pageChange', $event)"
        @update:page-size="emit('pageSizeChange', $event)"
      />
      <div v-else class="profile-empty profile-empty--compact">
        <Wallet :size="24" />
        <p>暂无充值记录</p>
        <span>完成充值后将在此展示订单明细</span>
      </div>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.wallet-balance-block {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.wallet-balance-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  color: #8792be;
  font-size: 13px;
}
</style>
