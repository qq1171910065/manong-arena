<script setup lang="ts">
import type { DataTableColumns } from '../../ui'
import type { PortalUsageRecord } from '@renderer/services'
import type { UserInfo } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NDataTable, NSpace, NTag } from '../../ui'

defineProps<{
  profile: UserInfo | null
  displayName: string
  avatarInitial: string
  gatewayReady: boolean
  activeKeysCount: number
  recentUsage: PortalUsageRecord[]
  usageColumns: DataTableColumns<PortalUsageRecord>
}>()

const emit = defineEmits<{
  navigate: [tab: string]
}>()
</script>

<template>
  <ProfileSectionLayout title="用户信息" desc="查看个人资料、账户状态与最近模型调用。">

    <NCard class="mntools-panel profile-detail-card">
      <div class="user-profile-hero">
        <span class="profile-avatar" aria-hidden="true">{{ avatarInitial }}</span>
        <div class="user-profile-hero__body">
          <p class="profile-hero__eyebrow">当前用户</p>
          <h2 class="profile-hero__name">{{ displayName }}</h2>
          <p v-if="profile?.username" class="profile-hero__meta">@{{ profile.username }}</p>
          <p v-if="profile?.emailDisplay" class="profile-hero__meta">{{ profile.emailDisplay }}</p>
          <NSpace :size="8" class="profile-hero__tags">
            <NTag :type="gatewayReady ? 'success' : 'warning'" size="small" :bordered="false">
              {{ gatewayReady ? '网关已就绪' : '待验证邮箱' }}
            </NTag>
            <NTag v-if="profile?.emailVerified === false" type="warning" size="small" :bordered="false">
              邮箱未验证
            </NTag>
            <NTag v-if="profile?.id" type="default" size="small" :bordered="false">
              ID {{ profile.id }}
            </NTag>
          </NSpace>
        </div>
      </div>
    </NCard>

    <NCard class="mntools-panel profile-detail-card" title="账户摘要">
      <dl class="profile-detail-grid">
        <div class="profile-detail-item">
          <dt>客户 ID</dt>
          <dd>{{ profile?.customerId ? String(profile.customerId) : '—' }}</dd>
        </div>
        <div class="profile-detail-item">
          <dt>邮箱状态</dt>
          <dd>{{ profile?.emailVerified === false ? '未验证' : profile?.emailBound ? '已绑定' : '未绑定' }}</dd>
        </div>
        <div class="profile-detail-item">
          <dt>有效密钥</dt>
          <dd>{{ activeKeysCount }} 个</dd>
        </div>
        <div class="profile-detail-item">
          <dt>模型网关</dt>
          <dd>{{ gatewayReady ? '已就绪' : '待验证邮箱' }}</dd>
        </div>
      </dl>
      <NSpace :size="8" style="margin-top: 12px">
        <NButton size="small" quaternary @click="emit('navigate', 'user-stats')">查看用户统计</NButton>
        <NButton size="small" quaternary @click="emit('navigate', 'security')">账号安全</NButton>
        <NButton size="small" quaternary @click="emit('navigate', 'wallet')">钱包充值</NButton>
      </NSpace>
    </NCard>

    <NCard class="mntools-panel profile-table-card profile-list-region" title="最近调用">
      <template #header-extra>
        <NButton v-if="recentUsage.length" text type="primary" size="small" @click="emit('navigate', 'usage')">
          查看全部 →
        </NButton>
      </template>
      <NDataTable
        v-if="recentUsage.length"
        :columns="usageColumns"
        :data="recentUsage"
        :bordered="false"
        size="small"
        :pagination="false"
      />
      <div v-else class="profile-empty profile-empty--compact">
        <p>暂无调用记录</p>
        <span>发起模型调用后将在此展示最近 5 条记录</span>
      </div>
    </NCard>
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
</style>
