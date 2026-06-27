<script setup lang="ts">
import { Wallet } from 'lucide-vue-next'
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
      <NButton v-if="rechargeReady" type="primary" size="small" @click="emit('recharge')">微信扫码充值</NButton>
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

    <section class="portal-plain-block">
      <h4 class="portal-plain-block__title">充值档位</h4>
      <p v-if="rechargeConfig?.description?.trim()" class="portal-plain-block__desc">
        {{ rechargeConfig.description.trim() }}
      </p>
      <p v-else-if="!rechargeReady" class="portal-plain-block__desc">充值功能暂未开放，请联系管理员。</p>
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
    </section>

    <section class="portal-plain-block profile-list-region">
      <h4 class="portal-plain-block__title">充值记录</h4>
      <p class="portal-plain-block__desc">微信扫码支付订单与到账状态。</p>
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
    </section>
  </ProfileSectionLayout>
</template>
