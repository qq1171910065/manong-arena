<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Award, BarChart3, Bot, Gamepad2, Sparkles, Trophy, Users } from 'lucide-vue-next'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import SettingsBlock from './SettingsBlock.vue'
import SettingsInfoRow from './SettingsInfoRow.vue'
import { AppChart, NSpin, NTag } from '../../ui'
import { characterService, matchService, portalApi } from '@renderer/services'
import { yuanToPoints } from '@renderer/composables/fee-points'

const loading = ref(false)
const characterCount = ref(0)
const enabledCharacterCount = ref(0)
const disabledCharacterCount = ref(0)
const totalMatches = ref(0)
const completedMatches = ref(0)
const activeMatches = ref(0)
const pausedMatches = ref(0)
const usageTotal = ref(0)
const usageTokens = ref(0)
const totalCostYuan = ref(0)
const totalRechargedYuan = ref(0)
const balancePoints = ref(0)
const balanceYuan = ref(0)

const statCards = computed(() => [
  {
    id: 'characters',
    label: '角色总数',
    value: String(characterCount.value),
    hint: `${enabledCharacterCount.value} 启用 · ${disabledCharacterCount.value} 停用`,
    icon: Users,
    tone: 'characters',
  },
  {
    id: 'matches',
    label: '对局总数',
    value: String(totalMatches.value),
    hint: `${completedMatches.value} 完成 · ${activeMatches.value + pausedMatches.value} 进行中`,
    icon: Gamepad2,
    tone: 'matches',
  },
  {
    id: 'usage',
    label: '模型调用',
    value: usageTotal.value.toLocaleString(),
    hint: `约 ${usageTokens.value.toLocaleString()} Token`,
    icon: BarChart3,
    tone: 'usage',
  },
  {
    id: 'balance',
    label: '当前积分',
    value: balancePoints.value.toLocaleString(),
    hint: `约 ${balanceYuan.value.toFixed(2)} 元`,
    icon: Sparkles,
    tone: 'balance',
  },
])

const activityChartOption = computed(() => {
  const labels = ['角色', '对局', '已完成', '模型调用']
  const values = [
    characterCount.value,
    totalMatches.value,
    completedMatches.value,
    Math.min(usageTotal.value, 9999),
  ]
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    xAxis: { type: 'category', data: labels },
    yAxis: { type: 'value', minInterval: 1 },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: { color: '#625cf0', borderRadius: [6, 6, 0, 0] },
        barMaxWidth: 48,
      },
    ],
  }
})

const matchBreakdownOption = computed(() => ({
  tooltip: { trigger: 'item' },
  series: [
    {
      type: 'pie',
      radius: ['42%', '68%'],
      data: [
        { name: '已完成', value: completedMatches.value },
        { name: '进行中', value: activeMatches.value },
        { name: '已暂停', value: pausedMatches.value },
      ].filter((item) => item.value > 0),
      itemStyle: { borderRadius: 4 },
    },
  ],
}))

const upcomingAchievements = [
  { id: 'first-match', title: '初出茅庐', desc: '完成首场对局', icon: Trophy },
  { id: 'character-5', title: '角色收藏家', desc: '创建 5 个角色', icon: Bot },
  { id: 'usage-100', title: '模型常客', desc: '累计 100 次模型调用', icon: Award },
]

async function loadStats() {
  loading.value = true
  try {
    const [characters, matches, wallet, usageRes] = await Promise.all([
      characterService.list(),
      matchService.list(),
      portalApi.wallet().catch(() => null),
      portalApi.usage(1, 200).catch(() => null),
    ])
    characterCount.value = characters.length
    enabledCharacterCount.value = characters.filter((c) => c.status === 'enabled').length
    disabledCharacterCount.value = characters.filter((c) => c.status === 'disabled').length
    totalMatches.value = matches.length
    completedMatches.value = matches.filter((m) => m.status === 'completed').length
    activeMatches.value = matches.filter((m) => m.status === 'active').length
    pausedMatches.value = matches.filter((m) => m.status === 'paused').length
    const usageList = usageRes?.list || []
    usageTotal.value = usageRes?.pagination?.total ?? usageList.length
    usageTokens.value = usageList.reduce(
      (sum, row) => sum + (row.promptTokens || 0) + (row.completionTokens || 0),
      0
    )
    totalCostYuan.value = Number(wallet?.totalConsumedYuan || wallet?.usedYuan || 0)
    totalRechargedYuan.value = Number(wallet?.totalRechargedYuan || 0)
    balanceYuan.value = Number(wallet?.balanceYuan || 0)
    balancePoints.value = yuanToPoints(balanceYuan.value)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadStats()
})
</script>

<template>
  <ProfileSectionLayout title="用户统计" desc="角色、对局、模型与消费汇总。">
    <NSpin :show="loading">
      <div class="profile-stats profile-stats--quad" role="list" aria-label="用户统计概览">
        <div
          v-for="item in statCards"
          :key="item.id"
          class="profile-stat"
          :class="`profile-stat--${item.tone}`"
          role="listitem"
        >
          <span class="profile-stat__icon" aria-hidden="true">
            <component :is="item.icon" :size="18" />
          </span>
          <span class="profile-stat__body">
            <span class="profile-stat__label">{{ item.label }}</span>
            <strong class="profile-stat__value">{{ item.value }}</strong>
            <span class="profile-stat__hint" :title="item.hint">{{ item.hint }}</span>
          </span>
        </div>
      </div>

      <SettingsBlock title="角色统计" desc="本地创建的角色数量与启用状态。">
        <SettingsInfoRow label="角色总数" :value="String(characterCount)" />
        <SettingsInfoRow label="启用中" :value="`${enabledCharacterCount} 个`" />
        <SettingsInfoRow label="已停用" :value="`${disabledCharacterCount} 个`" />
      </SettingsBlock>

      <SettingsBlock title="对局统计" desc="本地对局记录按状态汇总。">
        <SettingsInfoRow label="对局总数" :value="String(totalMatches)" />
        <SettingsInfoRow label="已完成" :value="`${completedMatches} 局`" />
        <SettingsInfoRow label="进行中" :value="`${activeMatches} 局`" />
        <SettingsInfoRow label="已暂停" :value="`${pausedMatches} 局`" />
      </SettingsBlock>

      <SettingsBlock title="模型与消费" desc="平台侧记录的模型调用与账户消费。">
        <SettingsInfoRow label="累计调用" :value="usageTotal.toLocaleString()" />
        <SettingsInfoRow label="采样 Token" hint="最近 200 条估算" :value="usageTokens.toLocaleString()" />
        <SettingsInfoRow label="累计消费" :value="`${totalCostYuan.toFixed(2)} 元`" />
        <SettingsInfoRow label="累计充值" :value="`${totalRechargedYuan.toFixed(2)} 元`" />
        <SettingsInfoRow label="当前积分" :value="balancePoints.toLocaleString()" />
        <SettingsInfoRow label="余额折合" :value="`约 ${balanceYuan.toFixed(2)} 元`" />
      </SettingsBlock>

      <section class="portal-plain-block">
        <h4 class="portal-plain-block__title">活动概览</h4>
        <p class="portal-plain-block__desc">角色、对局与模型调用的数量对比。</p>
        <AppChart :option="activityChartOption" height="240px" :loading="loading" />
      </section>

      <section v-if="totalMatches > 0" class="portal-plain-block">
        <h4 class="portal-plain-block__title">对局分布</h4>
        <p class="portal-plain-block__desc">按完成、进行中与暂停状态拆分。</p>
        <AppChart :option="matchBreakdownOption" height="220px" :loading="loading" />
      </section>

      <SettingsBlock title="成就预览" desc="成就系统开发中，以下为规划中的首批成就。">
        <div v-for="item in upcomingAchievements" :key="item.id" class="user-stats-achievement">
          <span class="user-stats-achievement__icon" aria-hidden="true">
            <component :is="item.icon" :size="18" />
          </span>
          <div class="user-stats-achievement__body">
            <strong>{{ item.title }}</strong>
            <p class="text-muted">{{ item.desc }}</p>
          </div>
          <NTag size="small" :bordered="false">即将推出</NTag>
        </div>
      </SettingsBlock>
    </NSpin>
  </ProfileSectionLayout>
</template>

<style scoped>
.user-stats-achievement {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 0;
  border-bottom: 1px solid var(--line);
}

.user-stats-achievement:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.user-stats-achievement:first-child {
  padding-top: 0;
}

.user-stats-achievement__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--brand) 10%, var(--surface));
  color: var(--brand);
  flex-shrink: 0;
}

.user-stats-achievement__body {
  flex: 1;
  min-width: 0;
}

.user-stats-achievement strong {
  display: block;
  margin-bottom: 2px;
}

.user-stats-achievement p {
  margin: 0;
  font-size: 12px;
}
</style>
