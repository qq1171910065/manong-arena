<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Award, BarChart3, Bot, Gamepad2, Sparkles, Trophy, Users } from 'lucide-vue-next'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { AppChart, NCard, NSpin, NTag } from '../../ui'
import { characterService, matchService, portalApi } from '@renderer/services'
import { yuanToPoints } from '@renderer/composables/fee-points'

const loading = ref(false)
const characterCount = ref(0)
const enabledCharacterCount = ref(0)
const totalMatches = ref(0)
const completedMatches = ref(0)
const activeMatches = ref(0)
const usageTotal = ref(0)
const totalCostYuan = ref(0)
const balancePoints = ref(0)

const statCards = computed(() => [
  {
    id: 'characters',
    label: '角色总数',
    value: String(characterCount.value),
    hint: `${enabledCharacterCount.value} 个启用中`,
    icon: Users,
    tone: 'characters',
  },
  {
    id: 'matches',
    label: '对局总数',
    value: String(totalMatches.value),
    hint: `${completedMatches.value} 局已完成 · ${activeMatches.value} 局进行中`,
    icon: Gamepad2,
    tone: 'matches',
  },
  {
    id: 'usage',
    label: '模型调用',
    value: usageTotal.value.toLocaleString(),
    hint: `累计消费约 ${totalCostYuan.value.toFixed(2)} 元`,
    icon: BarChart3,
    tone: 'usage',
  },
  {
    id: 'balance',
    label: '当前积分',
    value: balancePoints.value.toLocaleString(),
    hint: '可在钱包充值查看明细',
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
    totalMatches.value = matches.length
    completedMatches.value = matches.filter((m) => m.status === 'completed').length
    activeMatches.value = matches.filter((m) => m.status === 'active' || m.status === 'paused').length
    usageTotal.value = usageRes?.pagination?.total ?? usageRes?.list?.length ?? 0
    totalCostYuan.value = Number(wallet?.totalConsumedYuan || wallet?.usedYuan || 0)
    balancePoints.value = yuanToPoints(Number(wallet?.balanceYuan) || 0)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadStats()
})
</script>

<template>
  <ProfileSectionLayout
    title="用户统计"
    desc="多维度汇总你的角色、对局与模型使用情况。成就系统即将上线。"
  >
    <NSpin :show="loading">
      <div class="profile-stats" role="list" aria-label="用户统计">
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
            <span class="profile-stat__hint">{{ item.hint }}</span>
          </span>
        </div>
      </div>

      <NCard class="mntools-panel profile-chart-card" title="活动概览">
        <AppChart :option="activityChartOption" height="240px" :loading="loading" />
      </NCard>

      <NCard class="mntools-panel" title="成就预览">
        <p class="text-muted user-stats-achievement-intro">成就系统开发中，以下为规划中的首批成就。</p>
        <div class="user-stats-achievements">
          <div v-for="item in upcomingAchievements" :key="item.id" class="user-stats-achievement">
            <span class="user-stats-achievement__icon" aria-hidden="true">
              <component :is="item.icon" :size="18" />
            </span>
            <div>
              <strong>{{ item.title }}</strong>
              <p class="text-muted">{{ item.desc }}</p>
            </div>
            <NTag size="small" :bordered="false">即将推出</NTag>
          </div>
        </div>
      </NCard>
    </NSpin>
  </ProfileSectionLayout>
</template>

<style scoped>
.user-stats-achievement-intro {
  margin: 0 0 12px;
  font-size: 13px;
}

.user-stats-achievements {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-stats-achievement {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.45);
}

.user-stats-achievement__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: rgba(98, 92, 240, 0.1);
  color: #625cf0;
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
