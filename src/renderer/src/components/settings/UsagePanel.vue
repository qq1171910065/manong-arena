<script setup lang="ts">
import { BarChart3 } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import type { PortalUsageRecord } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import PortalDataTable from './PortalDataTable.vue'
import SettingsBlock from './SettingsBlock.vue'
import { AppChart } from '../../ui'

defineProps<{
  usage: PortalUsageRecord[]
  usageLoading: boolean
  usageColumns: DataTableColumns<PortalUsageRecord>
  usagePagination: { page: number; pageSize: number; itemCount: number; showSizePicker?: boolean }
  usagePageSummary: { records: number; cost: number; tokens: number }
  usageChartOption: Record<string, unknown>
}>()

const emit = defineEmits<{
  pageChange: [page: number]
  pageSizeChange: [size: number]
}>()
</script>

<template>
  <ProfileSectionLayout title="用量明细" desc="查看模型调用趋势与逐条费用记录。">
    <section class="profile-usage-summary">
      <div class="profile-usage-stat">
        <span>总记录</span>
        <strong>{{ usagePageSummary.records.toLocaleString() }}</strong>
      </div>
      <div class="profile-usage-stat">
        <span>本页费用</span>
        <strong>{{ usagePageSummary.cost.toFixed(4) }} 元</strong>
      </div>
      <div class="profile-usage-stat">
        <span>本页 Token</span>
        <strong>{{ usagePageSummary.tokens.toLocaleString() }}</strong>
      </div>
    </section>

    <SettingsBlock title="用量趋势" desc="按本页记录展示每次调用的费用分布。">
      <AppChart
        v-if="usage.length"
        :option="usageChartOption"
        height="260px"
        :loading="usageLoading"
      />
      <div v-else class="profile-empty">
        <BarChart3 :size="28" />
        <p>暂无用量数据</p>
        <span>发起模型调用后将在此展示趋势</span>
      </div>
    </SettingsBlock>

    <SettingsBlock title="模型用量明细" desc="按时间查看每次模型调用的 Token 与费用。">
      <div class="profile-list-region">
        <PortalDataTable
        remote
        :columns="usageColumns"
        :data="usage"
        :loading="usageLoading"
        :pagination="usagePagination"
        @update:page="emit('pageChange', $event)"
        @update:page-size="emit('pageSizeChange', $event)"
        />
      </div>
    </SettingsBlock>
  </ProfileSectionLayout>
</template>
