<script setup lang="ts">
import { computed } from 'vue'
import type { DataTableColumns } from '../../ui'
import type { PortalUsageRecord, PortalWalletSummary } from '@renderer/services'
import type { UserInfo } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import PortalDataTable from './PortalDataTable.vue'
import { NButton, NTag } from '../../ui'

const props = defineProps<{
  profile: UserInfo | null
  displayName: string
  avatarInitial: string
  gatewayReady: boolean
  activeKeysCount: number
  hasLocalKey: boolean
  wechatBound: boolean
  wallet: PortalWalletSummary | null
  balancePoints: number
  recentUsage: PortalUsageRecord[]
  usageColumns: DataTableColumns<PortalUsageRecord>
}>()

const emit = defineEmits<{
  navigate: [tab: string]
}>()

const emailStatus = computed(() => {
  if (props.profile?.emailVerified === false) return '未验证'
  if (props.profile?.emailBound) return '已绑定'
  if (props.profile?.needsEmailBind) return '待绑定'
  return '未绑定'
})

const emailStatusType = computed(() => {
  if (props.profile?.emailVerified === false) return 'warning' as const
  if (props.profile?.emailBound) return 'success' as const
  return 'default' as const
})
</script>

<template>
  <ProfileSectionLayout title="账户概览" desc="个人资料、账户状态与最近模型调用。">
    <template v-if="recentUsage.length" #actions>
      <NButton text type="primary" size="small" @click="emit('navigate', 'usage')">查看全部 →</NButton>
    </template>

    <section class="portal-plain-block">
      <div class="user-profile-hero">
        <span class="profile-avatar" aria-hidden="true">{{ avatarInitial }}</span>
        <div class="user-profile-hero__body">
          <p class="profile-hero__eyebrow">当前用户</p>
          <h2 class="profile-hero__name">{{ displayName }}</h2>
          <p v-if="profile?.username" class="profile-hero__meta">@{{ profile.username }}</p>
          <p v-if="profile?.emailDisplay" class="profile-hero__meta">{{ profile.emailDisplay }}</p>
          <div class="profile-hero__tags">
            <NTag :type="gatewayReady ? 'success' : 'warning'" size="small" :bordered="false">
              {{ gatewayReady ? '网关已就绪' : '待验证邮箱' }}
            </NTag>
            <NTag v-if="profile?.emailVerified === false" type="warning" size="small" :bordered="false">
              邮箱未验证
            </NTag>
            <NTag v-if="wechatBound" type="success" size="small" :bordered="false">微信已绑定</NTag>
            <NTag v-if="hasLocalKey" type="default" size="small" :bordered="false">本机 Key 已缓存</NTag>
          </div>
        </div>
      </div>
    </section>

    <SettingsBlock title="基本资料" desc="账号在平台侧登记的身份信息。">
      <SettingsInfoRow label="用户 ID" :value="profile?.id ? String(profile.id) : '—'" />
      <SettingsInfoRow label="用户名" :value="profile?.username || '—'" />
      <SettingsInfoRow label="显示名称" :value="displayName || '—'" />
      <SettingsInfoRow label="客户 ID" :value="profile?.customerId ? String(profile.customerId) : '—'" />
      <SettingsInfoRow v-if="profile?.role" label="账户角色" :value="profile.role" />
    </SettingsBlock>

    <SettingsBlock title="联系与安全" desc="邮箱验证、第三方绑定与网关开通状态。">
      <SettingsInfoRow label="邮箱" :value="profile?.emailDisplay || '未绑定'" />
      <SettingsInfoRow label="邮箱状态" hint="验证通过后可调模型">
        <NTag :type="emailStatusType" size="small" :bordered="false">{{ emailStatus }}</NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="微信绑定" hint="绑定后可扫码登录">
        <NTag :type="wechatBound ? 'success' : 'default'" size="small" :bordered="false">
          {{ wechatBound ? '已绑定' : '未绑定' }}
        </NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="模型网关" hint="邮箱验证通过后自动开通">
        <NTag :type="gatewayReady ? 'success' : 'warning'" size="small" :bordered="false">
          {{ gatewayReady ? '已就绪' : '待验证邮箱' }}
        </NTag>
      </SettingsInfoRow>
    </SettingsBlock>

    <SettingsBlock title="密钥与余额" desc="本机缓存、有效密钥数量与当前积分概览。">
      <SettingsInfoRow label="本机 Key 缓存" hint="客户端直连网关">
        <NTag :type="hasLocalKey ? 'success' : 'default'" size="small" :bordered="false">
          {{ hasLocalKey ? '已保存' : '未保存' }}
        </NTag>
      </SettingsInfoRow>
      <SettingsInfoRow label="有效密钥" :value="`${activeKeysCount} 个`" />
      <SettingsInfoRow label="积分余额" :value="balancePoints.toLocaleString()" />
      <SettingsInfoRow
        label="余额折合"
        :value="wallet ? `约 ${Number(wallet.balanceYuan || 0).toFixed(2)} 元` : '—'"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计消费"
        :value="`${Number(wallet.totalConsumedYuan || wallet.usedYuan || 0).toFixed(2)} 元`"
      />
      <SettingsInfoRow
        v-if="wallet"
        label="累计充值"
        :value="`${Number(wallet.totalRechargedYuan || 0).toFixed(2)} 元`"
      />
    </SettingsBlock>

    <section class="portal-plain-block profile-list-region">
      <h4 class="portal-plain-block__title">最近调用</h4>
      <p class="portal-plain-block__desc" title="展示最近 5 次模型调用记录">最近 5 次模型调用。</p>
      <PortalDataTable
        v-if="recentUsage.length"
        :columns="usageColumns"
        :data="recentUsage"
        :pagination="false"
      />
      <div v-else class="profile-empty profile-empty--compact">
        <p>暂无调用记录</p>
        <span>发起模型调用后将在此展示最近 5 条记录</span>
      </div>
      <div class="user-profile-links">
        <NButton size="small" quaternary @click="emit('navigate', 'user-stats')">查看用户统计</NButton>
        <NButton size="small" quaternary @click="emit('navigate', 'security')">账号安全</NButton>
        <NButton size="small" quaternary @click="emit('navigate', 'wallet')">钱包充值</NButton>
        <NButton size="small" quaternary @click="emit('navigate', 'keys')">API Key</NButton>
      </div>
    </section>
  </ProfileSectionLayout>
</template>

<style scoped>
.user-profile-hero {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.user-profile-hero__body {
  min-width: 0;
}

.profile-hero__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.user-profile-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 12px;
}
</style>
