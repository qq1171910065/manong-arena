<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { ChevronDown, ExternalLink, RefreshCw, Trophy } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import {
  AGENT_SIGNAL_LABELS,
  formatAgentMetric,
  getAgentLeaderboard,
  isLeaderboardCacheStale,
  syncAgentLeaderboard,
  type AgentSignalKey,
  type ArenaAgentLabEntry,
  type ArenaAgentLeaderboard,
  type ArenaAgentModelEntry,
} from '@renderer/services/arena-leaderboard-api'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import PortalDataTable from './PortalDataTable.vue'
import { AppChart, NButton, NSpace, NSpin, NTag, useMessage } from '../../ui'

const message = useMessage()

const loading = ref(false)
const syncing = ref(false)
const leaderboard = ref<ArenaAgentLeaderboard | null>(null)
const loadError = ref('')
const expandedLab = ref<string | null>(null)

const syncedLabel = computed(() => {
  if (!leaderboard.value) return '尚未同步'
  const d = new Date(leaderboard.value.syncedAt)
  const stale = isLeaderboardCacheStale()
  return `${d.toLocaleString()}${stale ? ' · 已过期' : ''}`
})

const headerDesc = '同步 Arena Agent Labs 因果测评信号，按厂商 Sessions 加权聚合。'

const metaLine = computed(() => {
  if (!leaderboard.value) return ''
  const parts = [
    `数据日期 ${leaderboard.value.date}`,
    `信号版本 ${leaderboard.value.signalsVersion}`,
    `${leaderboard.value.labs.length} 个厂商`,
    `${leaderboard.value.modelCount} 个 Agent 模型`,
  ]
  if (leaderboard.value.totalSessions) {
    parts.push(`Arena 总 Sessions ${leaderboard.value.totalSessions.toLocaleString()}`)
  }
  if (leaderboard.value.lastUpdated) {
    parts.push(`Arena 更新 ${leaderboard.value.lastUpdated}`)
  }
  parts.push(`上次同步 ${syncedLabel.value}`)
  return parts.join(' · ')
})

const topLabsChartOption = computed(() => {
  const labs = leaderboard.value?.labs.slice(0, 8) || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 56, right: 16, top: 24, bottom: 48 },
    xAxis: {
      type: 'category',
      data: labs.map((lab) => lab.lab),
      axisLabel: { rotate: 28, fontSize: 11 },
    },
    yAxis: { type: 'value', name: 'Net Improvement (%)' },
    series: [
      {
        type: 'bar',
        name: 'Net Improvement',
        data: labs.map((lab) => lab.netImprovement.value),
        itemStyle: { color: '#625cf0', borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 36,
      },
    ],
  }
})

const radarChartOption = computed(() => {
  const top = leaderboard.value?.labs[0]
  if (!top) return null
  const keys = Object.keys(AGENT_SIGNAL_LABELS) as AgentSignalKey[]
  const indicators = keys.map((key) => ({
    name: AGENT_SIGNAL_LABELS[key].short,
    max: 100,
    min: -20,
  }))
  const values = keys.map((key) => {
    const metric = top[key]
    const raw = metric?.value ?? 0
    return AGENT_SIGNAL_LABELS[key].higherIsBetter ? raw : -raw
  })
  return {
    tooltip: {},
    radar: { indicator: indicators, radius: '62%' },
    series: [
      {
        type: 'radar',
        data: [{ value: values, name: top.lab }],
        areaStyle: { opacity: 0.15 },
        lineStyle: { color: '#625cf0' },
        itemStyle: { color: '#625cf0' },
      },
    ],
  }
})

const sessionsChartOption = computed(() => {
  const labs = leaderboard.value?.labs.slice(0, 10) || []
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 100, right: 24, top: 16, bottom: 16 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: labs.map((lab) => lab.lab).reverse(),
      axisLabel: { fontSize: 11 },
    },
    series: [
      {
        type: 'bar',
        data: labs.map((lab) => lab.sessions).reverse(),
        itemStyle: { color: '#7c76ff', borderRadius: [0, 4, 4, 0] },
        barMaxWidth: 18,
      },
    ],
  }
})

function metricColumn(
  key: AgentSignalKey,
  title: string,
  width = 128
): DataTableColumns<ArenaAgentLabEntry>[number] {
  return {
    title,
    key,
    width,
    render: (row) => formatAgentMetric(row[key]),
  }
}

const labColumns: DataTableColumns<ArenaAgentLabEntry> = [
  { title: '#', key: 'rank', width: 48, fixed: 'left' },
  { title: '厂商 / Lab', key: 'lab', width: 120, fixed: 'left', ellipsis: { tooltip: true } },
  metricColumn('netImprovement', 'Net Improvement', 132),
  metricColumn('confirmedSuccess', 'Confirmed Success', 132),
  metricColumn('praiseVsComplaint', 'Praise vs Complaint', 132),
  metricColumn('steerability', 'Steerability', 112),
  metricColumn('bashRecovery', 'Bash Recovery', 112),
  metricColumn('toolHallucination', 'Tool Hallucination', 118),
  {
    title: 'Sessions',
    key: 'sessions',
    width: 96,
    render: (row) => row.sessions.toLocaleString(),
  },
  {
    title: '模型',
    key: 'modelCount',
    width: 72,
    render: (row) => String(row.modelCount),
  },
  {
    title: '',
    key: 'expand',
    width: 52,
    render: (row) =>
      h(
        NButton,
        {
          size: 'tiny',
          quaternary: true,
          onClick: () => toggleLab(row.lab),
        },
        () => (expandedLab.value === row.lab ? '收起' : '明细')
      ),
  },
]

const modelColumns: DataTableColumns<ArenaAgentModelEntry> = [
  { title: '#', key: 'rank', width: 48 },
  { title: '模型', key: 'model', ellipsis: { tooltip: true } },
  {
    title: 'Net Improvement',
    key: 'netImprovement',
    width: 132,
    render: (row) => formatAgentMetric(row.netImprovement),
  },
  {
    title: 'Confirmed Success',
    key: 'confirmedSuccess',
    width: 132,
    render: (row) => formatAgentMetric(row.confirmedSuccess),
  },
  {
    title: 'Praise vs Complaint',
    key: 'praiseVsComplaint',
    width: 132,
    render: (row) => formatAgentMetric(row.praiseVsComplaint),
  },
  {
    title: 'Steerability',
    key: 'steerability',
    width: 112,
    render: (row) => formatAgentMetric(row.steerability),
  },
  {
    title: 'Bash Recovery',
    key: 'bashRecovery',
    width: 112,
    render: (row) => formatAgentMetric(row.bashRecovery),
  },
  {
    title: 'Tool Hallucination',
    key: 'toolHallucination',
    width: 118,
    render: (row) => formatAgentMetric(row.toolHallucination),
  },
  {
    title: 'Sessions',
    key: 'sessions',
    width: 96,
    render: (row) => row.sessions.toLocaleString(),
  },
]

const expandedLabEntry = computed(() =>
  leaderboard.value?.labs.find((lab) => lab.lab === expandedLab.value) || null
)

function toggleLab(lab: string) {
  expandedLab.value = expandedLab.value === lab ? null : lab
}

async function loadCached(force = false) {
  loading.value = true
  loadError.value = ''
  try {
    leaderboard.value = await getAgentLeaderboard(force)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '加载排行榜失败'
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

async function syncNow() {
  syncing.value = true
  loadError.value = ''
  try {
    leaderboard.value = await syncAgentLeaderboard(true)
    message.success(`已同步 ${leaderboard.value.date} Agent Labs 测评数据`)
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '同步失败'
    message.error(loadError.value)
  } finally {
    syncing.value = false
  }
}

onMounted(async () => {
  await loadCached(false)
  if (isLeaderboardCacheStale()) {
    void syncNow()
  }
})
</script>

<template>
  <ProfileSectionLayout title="Agent 测评榜" :desc="headerDesc">
    <template #actions>
      <NSpace>
        <NButton quaternary size="small" :loading="loading && !syncing" @click="loadCached(true)">
          <template #icon><RefreshCw :size="14" /></template>
          读取缓存
        </NButton>
        <NButton type="primary" size="small" :loading="syncing" @click="syncNow">
          <template #icon><Trophy :size="14" /></template>
          立即同步
        </NButton>
      </NSpace>
    </template>

    <p v-if="loadError" class="leaderboard-error">{{ loadError }}</p>
    <p v-if="metaLine" class="leaderboard-meta text-muted">{{ metaLine }}</p>

    <NSpin :show="loading && !leaderboard">
      <div v-if="leaderboard?.signalLeaders.length" class="leaderboard-signal-grid">
        <div
          v-for="item in leaderboard.signalLeaders"
          :key="item.signal"
          class="leaderboard-signal-card"
        >
          <span class="leaderboard-signal-card__label">{{ AGENT_SIGNAL_LABELS[item.signal].short }}</span>
          <strong>{{ item.lab }}</strong>
          <span class="text-muted">{{ item.model }}</span>
          <NTag size="small" :bordered="false" type="success">{{ formatAgentMetric(item.metric) }}</NTag>
        </div>
      </div>

      <div v-if="leaderboard" class="leaderboard-charts">
        <section class="portal-plain-block profile-chart-card">
          <h4 class="portal-plain-block__title">Net Improvement 对比</h4>
          <AppChart :option="topLabsChartOption" height="260px" />
        </section>
        <section v-if="radarChartOption" class="portal-plain-block profile-chart-card">
          <h4 class="portal-plain-block__title">榜首厂商信号雷达</h4>
          <AppChart :option="radarChartOption" height="260px" />
        </section>
        <section class="portal-plain-block profile-chart-card">
          <h4 class="portal-plain-block__title">Sessions 分布</h4>
          <AppChart :option="sessionsChartOption" height="260px" />
        </section>
      </div>

      <section class="portal-plain-block profile-table-card">
        <div class="leaderboard-tab-head">
          <div>
            <h4 class="portal-plain-block__title">Agent Arena · Labs 对比</h4>
            <p class="portal-plain-block__desc" title="各指标为相对随机基线的 Net Improvement（百分点）。Tool Hallucination 越低越好，其余越高越好。">
              相对随机基线的净提升（百分点），幻觉率越低越好
            </p>
          </div>
          <NButton
            text
            tag="a"
            href="https://arena.ai/leaderboard/agent?rankBy=labs"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看 Arena 原文
            <template #icon><ExternalLink :size="14" /></template>
          </NButton>
        </div>

        <PortalDataTable
          v-if="leaderboard?.labs.length"
          :columns="labColumns"
          :data="leaderboard.labs"
          :scroll-x="1400"
          :pagination="false"
        />
        <div v-else class="profile-empty">
          <Trophy :size="28" />
          <p>暂无 Agent Labs 数据</p>
          <span>点击「立即同步」从 Arena 镜像拉取</span>
        </div>

        <div v-if="expandedLabEntry" class="leaderboard-lab-detail">
          <div class="leaderboard-lab-detail__head">
            <ChevronDown :size="16" aria-hidden="true" />
            <strong>{{ expandedLabEntry.lab }}</strong>
            <span class="text-muted">旗下 {{ expandedLabEntry.models.length }} 个模型信号明细</span>
          </div>
          <PortalDataTable
            :columns="modelColumns"
            :data="expandedLabEntry.models"
            :scroll-x="1200"
            :pagination="false"
          />
        </div>
      </section>
    </NSpin>
  </ProfileSectionLayout>
</template>

<style scoped>
.leaderboard-error {
  margin: 0 0 8px;
  color: #d03050;
  font-size: 13px;
}

.leaderboard-meta {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.55;
  word-break: break-word;
}

.leaderboard-charts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.leaderboard-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.leaderboard-signal-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 14px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
}

.leaderboard-signal-card__label {
  color: #8792be;
  font-size: 12px;
}

.leaderboard-tab-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.leaderboard-tab-head .portal-plain-block__desc {
  margin-bottom: 0;
}

.leaderboard-lab-detail {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.leaderboard-lab-detail__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

@media (max-width: 1200px) {
  .leaderboard-charts {
    grid-template-columns: 1fr;
  }

  .leaderboard-signal-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
