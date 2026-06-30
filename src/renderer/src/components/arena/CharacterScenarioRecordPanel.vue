<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { BarChart3, Loader2 } from 'lucide-vue-next'
import CharacterGrowthTrendChart from './CharacterGrowthTrendChart.vue'
import { characterScenarioRecordService, formatUserMessage } from '@renderer/services/arena'
import { navigate } from '@renderer/router'
import { formatTimeLabel } from '@renderer/utils/id'
import {
  brainstormCategoryLabel,
  outcomeLabel,
  type CharacterScenarioDetail,
} from '@shared/arena/character-scenario-record'
import { modeSupportsExperienceLessons, isBrainstormGameModeId } from '@shared/arena/builtin-game-mode-registry'
import type { Character } from '@shared/arena/types'

type RecordTab = 'overview' | 'performance' | 'charts' | 'artifacts' | 'lessons'

const props = defineProps<{
  character: Character
  scenarioId: string
  scenarioName?: string
}>()

const loading = ref(false)
const error = ref('')
const detail = ref<CharacterScenarioDetail | null>(null)
const activeTab = ref<RecordTab>('overview')

watch(
  () => [props.scenarioId, props.character.id] as const,
  () => {
    activeTab.value = 'overview'
    void loadDetail()
  },
  { immediate: true },
)

async function loadDetail() {
  if (!props.scenarioId) return
  loading.value = true
  error.value = ''
  try {
    detail.value = await characterScenarioRecordService.getDetail(props.character.id, props.scenarioId)
  } catch (err) {
    error.value = formatUserMessage(err)
    detail.value = null
  } finally {
    loading.value = false
  }
}

const showLessonsTab = computed(() =>
  detail.value ? modeSupportsExperienceLessons(detail.value.summary.gameModeId) : false,
)
const showArtifactsTab = computed(() =>
  detail.value ? isBrainstormGameModeId(detail.value.summary.gameModeId) : false,
)

const speechChart = computed(() => {
  const rows = detail.value?.matches || []
  const max = Math.max(1, ...rows.map((r) => r.speechCount))
  return rows.slice(0, 12).map((row) => ({
    id: row.matchId,
    label: formatTimeLabel(row.endedAt).slice(0, 10),
    value: row.speechCount,
    percent: Math.round((row.speechCount / max) * 100),
  }))
})

function openMatch(matchId: string) {
  navigate(`/match-detail/${matchId}`)
}
</script>

<template>
  <section class="scenario-record-panel">
    <nav class="scenario-record-panel__tabs">
      <button type="button" :class="{ active: activeTab === 'overview' }" @click="activeTab = 'overview'">概览</button>
      <button type="button" :class="{ active: activeTab === 'performance' }" @click="activeTab = 'performance'">发挥记录</button>
      <button type="button" :class="{ active: activeTab === 'charts' }" @click="activeTab = 'charts'">成长图表</button>
      <button
        v-if="showArtifactsTab"
        type="button"
        :class="{ active: activeTab === 'artifacts' }"
        @click="activeTab = 'artifacts'"
      >
        讨论产物
      </button>
      <button
        v-if="showLessonsTab"
        type="button"
        :class="{ active: activeTab === 'lessons' }"
        @click="activeTab = 'lessons'"
      >
        经验教训
      </button>
    </nav>

    <div class="scenario-record-panel__body">
      <p v-if="loading" class="scenario-record-panel__state">
        <Loader2 :size="18" class="spin" />
        加载中…
      </p>
      <p v-else-if="error" class="scenario-record-panel__error">{{ error }}</p>
      <template v-else-if="detail">
        <template v-if="activeTab === 'overview'">
          <div class="stat-grid">
            <article><span>演练次数</span><strong>{{ detail.summary.matchCount }}</strong></article>
            <article><span>阵营胜利</span><strong>{{ detail.summary.winCount }}</strong></article>
            <article><span>本局 MVP</span><strong>{{ detail.summary.mvpCount }}</strong></article>
            <article><span>范式掌握</span><strong>{{ detail.summary.statusLabel }}</strong></article>
            <article><span>最近演练</span><strong>{{ detail.summary.lastMatchAt ? formatTimeLabel(detail.summary.lastMatchAt) : '暂无' }}</strong></article>
            <article><span>范式类型</span><strong>{{ detail.summary.paradigmShortLabel }}</strong></article>
          </div>
        </template>

        <template v-else-if="activeTab === 'performance'">
          <p v-if="!detail.matches.length" class="scenario-record-panel__empty">尚无已完成演练记录。</p>
          <article
            v-for="row in detail.matches"
            :key="row.matchId"
            class="match-row"
            @click="openMatch(row.matchId)"
          >
            <header>
              <strong>{{ row.title }}</strong>
              <em>{{ formatTimeLabel(row.endedAt) }}</em>
            </header>
            <p class="match-row__meta">
              {{ outcomeLabel(row.outcome) }}
              · 发言 {{ row.speechCount }}
              · 模型调用 {{ row.modelCallCount }}
              <template v-if="row.isMvp"> · MVP</template>
              <template v-if="row.roleName"> · {{ row.roleName }}</template>
            </p>
            <p v-if="row.sessionLabel || row.discussionTopic" class="match-row__topic">
              {{ row.sessionLabel || '' }}
              <template v-if="row.discussionTopic">「{{ row.discussionTopic }}」</template>
              <template v-if="row.brainstormCategory"> · {{ brainstormCategoryLabel(row.brainstormCategory) }}</template>
            </p>
            <p v-if="row.designTarget" class="match-row__design">设计焦点：{{ row.designTarget }}</p>
            <p v-if="row.recapSnippet" class="match-row__recap">{{ row.recapSnippet }}</p>
          </article>
        </template>

        <template v-else-if="activeTab === 'charts'">
          <article class="chart-panel">
            <h3><BarChart3 :size="16" /> 发言参与度（最近演练）</h3>
            <p v-if="!speechChart.length" class="scenario-record-panel__empty">暂无数据。</p>
            <ul v-else class="speech-bars">
              <li v-for="item in speechChart" :key="item.id">
                <span>{{ item.label }}</span>
                <div class="speech-bars__track"><i :style="{ width: `${item.percent}%` }" /></div>
                <em>{{ item.value }}</em>
              </li>
            </ul>
          </article>
          <article v-if="detail.snapshots.length" class="chart-panel">
            <CharacterGrowthTrendChart :snapshots="detail.snapshots" />
          </article>
          <p v-else class="scenario-record-panel__empty">该场景下尚无属性成长快照。</p>
        </template>

        <template v-else-if="activeTab === 'artifacts'">
          <p v-if="!detail.matches.some((m) => m.artifactSummary || m.recapSnippet)" class="scenario-record-panel__empty">
            尚无讨论产物。
          </p>
          <article
            v-for="row in detail.matches.filter((m) => m.artifactSummary || m.recapSnippet)"
            :key="row.matchId"
            class="match-row"
            @click="openMatch(row.matchId)"
          >
            <header>
              <strong>{{ row.title }}</strong>
              <em>{{ formatTimeLabel(row.endedAt) }}</em>
            </header>
            <p v-if="row.discussionTopic" class="match-row__topic">议题「{{ row.discussionTopic }}」</p>
            <p v-if="row.designTarget" class="match-row__design">设计焦点：{{ row.designTarget }}</p>
            <p class="match-row__recap">{{ row.artifactSummary || row.recapSnippet }}</p>
          </article>
        </template>

        <template v-else-if="activeTab === 'lessons'">
          <p v-if="!detail.lessons.length" class="scenario-record-panel__empty">尚无经验教训。</p>
          <article v-for="lesson in detail.lessons" :key="lesson.id" class="lesson-row">
            <header>
              <span>{{ lesson.source }}</span>
              <time v-if="lesson.createdAt">{{ formatTimeLabel(lesson.createdAt) }}</time>
            </header>
            <p>{{ lesson.summary }}</p>
            <button v-if="lesson.matchId" type="button" class="lesson-row__link" @click="openMatch(lesson.matchId!)">
              查看对应演练
            </button>
          </article>
        </template>
      </template>
    </div>
  </section>
</template>

<style scoped>
.scenario-record-panel {
  margin-top: 12px;
  padding: 14px 16px;
  border: 1px solid rgba(91, 87, 243, 0.2);
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.04);
}

.scenario-record-panel__tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.scenario-record-panel__tabs button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: #fff;
  color: #59649b;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.scenario-record-panel__tabs button.active {
  border-color: rgba(91, 87, 243, 0.35);
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-weight: 650;
}

.scenario-record-panel__state,
.scenario-record-panel__empty {
  margin: 0;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.6;
}

.scenario-record-panel__error {
  margin: 0;
  color: #c2410c;
  font-size: 13px;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat-grid article {
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}

.stat-grid span {
  display: block;
  color: #7a85b0;
  font-size: 11px;
}

.stat-grid strong {
  display: block;
  margin-top: 4px;
  color: #17205a;
  font-size: 15px;
}

.match-row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(130, 142, 207, 0.1);
  cursor: pointer;
}

.match-row header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.match-row strong {
  color: #17205a;
  font-size: 14px;
}

.match-row header em {
  color: #9aa3c7;
  font-size: 11px;
  font-style: normal;
}

.match-row__meta,
.match-row__topic,
.match-row__design,
.match-row__recap {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.55;
}

.chart-panel {
  margin-bottom: 14px;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
}

.chart-panel h3 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
  color: #17205a;
  font-size: 14px;
}

.speech-bars {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 8px;
}

.speech-bars li {
  display: grid;
  grid-template-columns: 72px 1fr 28px;
  gap: 8px;
  align-items: center;
  font-size: 11px;
  color: #66709d;
}

.speech-bars__track {
  height: 8px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.12);
  overflow: hidden;
}

.speech-bars__track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8b84ff, #5b57f3);
}

.lesson-row {
  padding: 12px 0;
  border-bottom: 1px solid rgba(130, 142, 207, 0.1);
}

.lesson-row header {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.lesson-row header span {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 600;
}

.lesson-row header time {
  color: #9aa3c7;
  font-size: 11px;
}

.lesson-row p {
  margin: 0;
  color: #59649b;
  font-size: 13px;
  line-height: 1.6;
}

.lesson-row__link {
  margin-top: 8px;
  border: 0;
  background: none;
  color: #5b57f3;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
