<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Clock, Play, Search, SlidersHorizontal, Sparkles, Users } from 'lucide-vue-next'
import { formatWinnerCampLabel } from '@shared/arena/camp-labels'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaSelect from '@renderer/components/common/ArenaSelect.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName, matchImageByModeId } from '@renderer/data/arena-visual-assets'
import { navigate } from '../router'
import { formatUserMessage, gameModeService, matchService, matchWindowService } from '@renderer/services/arena'
import { formatTimeLabel } from '@renderer/utils/id'
import type { Match, MatchStatus } from '@shared/arena/types'

const query = ref('')
const statusFilter = ref<'all' | MatchStatus | 'interrupted'>('all')
const modeFilter = ref('all')
const sortBy = ref<'updated-desc' | 'updated-asc'>('updated-desc')
const records = ref<Match[]>([])
const loading = ref(true)
const error = ref('')

const modeOptions = computed(() => gameModeService.list())

const filteredRecords = computed(() => {
  let list = [...records.value]
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((record) => {
      const names = record.participants.map((p) => p.characterName).join(' ')
      return (
        record.title.toLowerCase().includes(q) ||
        record.gameModeName.toLowerCase().includes(q) ||
        names.toLowerCase().includes(q)
      )
    })
  }
  if (modeFilter.value !== 'all') {
    list = list.filter((record) => record.gameModeId === modeFilter.value)
  }
  if (statusFilter.value === 'interrupted') {
    list = list.filter((record) => record.status === 'paused' || record.status === 'aborted')
  } else if (statusFilter.value !== 'all') {
    list = list.filter((record) => record.status === statusFilter.value)
  }
  return list.sort((a, b) =>
    sortBy.value === 'updated-asc'
      ? a.updatedAt.localeCompare(b.updatedAt)
      : b.updatedAt.localeCompare(a.updatedAt)
  )
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    records.value = await matchService.list()
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

function statusText(record: Match): string {
  if (record.status === 'active') {
    return `进行中 · 第${record.runtime.currentRound}轮 ${record.runtime.currentPhaseName}`
  }
  if (record.status === 'paused' || record.status === 'aborted') return '中断 · 可继续'
  return `已结束 · ${formatWinnerCampLabel(record.winnerCamp)}胜利`
}

function recordTeaser(record: Match): string {
  const text = record.recap?.summary || record.resultSummary
  if (text) return text
  return `${record.participants.length} 人局，点击查看详情与战报。`
}

function statusBadgeClass(record: Match): string {
  if (record.status === 'active') return 'is-active'
  if (record.status === 'paused' || record.status === 'aborted') return 'is-paused'
  if (record.status === 'completed') return 'is-done'
  return ''
}

function recordSubtitle(record: Match): string {
  const extra = record.title.replace(record.gameModeName, '').replace('·', '').trim()
  return extra || `${record.participants.length} 人局`
}

function openRecord(record: Match) {
  if (record.status === 'active' || record.status === 'paused') {
    void matchWindowService.open(record.id)
    return
  }
  navigate(`/match-detail/${record.id}`)
}

onMounted(() => {
  void load()
})
</script>

<template>
  <ArenaPageShell class="records-page" flow-scroll>
    <div class="list-flow-page">
    <section class="list-toolbar list-flow-layout__toolbar" aria-label="对局筛选">
      <label class="search-pill">
        <Search :size="17" />
        <input v-model="query" type="text" placeholder="搜索对局、玩法或角色..." />
      </label>
      <div class="toolbar-right">
        <div class="filter-cluster">
          <SlidersHorizontal :size="17" />
          <ArenaSelect
            v-model="statusFilter"
            :options="[
              { label: '全部状态', value: 'all' },
              { label: '进行中', value: 'active' },
              { label: '已结束', value: 'completed' },
              { label: '中断', value: 'interrupted' },
            ]"
            aria-label="对局状态"
          />
          <ArenaSelect v-model="modeFilter" aria-label="玩法筛选">
            <option value="all">全部玩法</option>
            <option v-for="mode in modeOptions" :key="mode.id" :value="mode.id">{{ mode.name }}</option>
          </ArenaSelect>
          <ArenaSelect
            v-model="sortBy"
            :options="[
              { label: '最近更新', value: 'updated-desc' },
              { label: '最早更新', value: 'updated-asc' },
            ]"
            aria-label="排序方式"
          />
        </div>
      </div>
    </section>

    <div class="list-flow-layout__scroll">
    <ArenaPageState
      :loading="loading"
      :error="error || undefined"
      :empty="!loading && !error && !filteredRecords.length"
      skeleton="list-rows"
      loading-label="加载对局记录..."
      @retry="load"
    >
      <template #skeleton>
        <div class="record-grid record-grid--skeleton">
          <div v-for="i in 6" :key="i" class="record-card record-card--skeleton" />
        </div>
      </template>
      <template #empty>
        <strong>暂无符合条件的对局记录</strong>
        <span>试试调整搜索词或筛选条件。</span>
      </template>

      <div class="record-grid arena-stagger">
        <article
          v-for="record in filteredRecords"
          :key="record.id"
          class="record-card"
          @click="openRecord(record)"
        >
          <div class="record-card__banner">
            <img :src="matchImageByModeId(record.gameModeId)" :alt="record.gameModeName" />
            <span class="record-card__badge" :class="statusBadgeClass(record)">{{ statusText(record) }}</span>
          </div>

          <div class="record-card__body">
            <div class="record-card__head">
              <div>
                <p class="record-card__mode">{{ record.gameModeName }}</p>
                <h2>{{ recordSubtitle(record) }}</h2>
              </div>
              <time><Clock :size="14" /> {{ formatTimeLabel(record.updatedAt) }}</time>
            </div>

            <p class="record-card__teaser" :title="recordTeaser(record)">{{ recordTeaser(record) }}</p>

            <div class="record-card__foot">
              <div class="record-card__avatars">
                <img
                  v-for="(participant, index) in record.participants.slice(0, 5)"
                  :key="participant.characterId"
                  :src="characterAvatarByName(participant.characterName, index, participant.modelId, participant.avatarUrl, participant.characterId)"
                  :alt="participant.characterName"
                />
                <span v-if="record.participants.length > 5">+{{ record.participants.length - 5 }}</span>
              </div>
              <div class="record-card__meta">
                <span><Users :size="14" /> {{ record.participants.length }} 人</span>
                <span v-if="record.recap?.source === 'narrator'" class="record-card__recap-tag">
                  <Sparkles :size="13" /> 解说战报
                </span>
              </div>
            </div>
          </div>

          <div
            v-if="record.status === 'active' || record.status === 'paused'"
            class="record-card__actions"
          >
            <button
              class="record-card__btn record-card__btn--primary"
              type="button"
              @click.stop="matchWindowService.open(record.id)"
            >
              <Play :size="15" />
              继续对局
            </button>
          </div>
        </article>
      </div>
    </ArenaPageState>
    </div>
    </div>
  </ArenaPageShell>
</template>

<style scoped>
.records-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 20px 38px 16px;
}

.list-flow-page {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.list-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.search-pill,
.filter-cluster {
  height: 42px;
  display: flex;
  align-items: center;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  color: #66709d;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(16px);
}

.search-pill {
  width: min(360px, 100%);
  gap: 10px;
  padding: 0 16px;
}

.search-pill input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #18205a;
  font: inherit;
}

.filter-cluster {
  gap: 4px;
  padding: 0 10px 0 14px;
}

.record-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
  padding: 2px 4px 20px;
  align-content: start;
}

.record-grid--skeleton {
  padding-top: 4px;
}

.record-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.78);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 14px 32px rgba(91, 101, 174, 0.1);
  backdrop-filter: blur(18px);
  overflow: hidden;
  cursor: pointer;
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.record-card:hover {
  transform: translateY(-4px);
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 18px 36px rgba(91, 101, 174, 0.14);
}

.record-card--skeleton {
  min-height: 280px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.55), rgba(244, 246, 255, 0.72));
  animation: pulse 1.4s ease-in-out infinite;
}

.record-card__banner {
  position: relative;
  aspect-ratio: 16 / 8;
  min-height: 156px;
  max-height: 196px;
  overflow: hidden;
}

.record-card__banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.02);
}

.record-card__banner::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(18, 24, 68, 0.08), rgba(18, 24, 68, 0.42));
}

.record-card__badge {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1;
  max-width: calc(100% - 24px);
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #334078;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.record-card__badge.is-active {
  color: #5b57f3;
}

.record-card__badge.is-paused {
  color: #e07a2f;
}

.record-card__badge.is-done {
  color: #1f9f65;
}

.record-card__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  padding: 14px 16px 16px;
  min-width: 0;
}

.record-card__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.record-card__head time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  color: #7a84ad;
  font-size: 12px;
  white-space: nowrap;
}

.record-card__mode {
  margin: 0 0 4px;
  color: #7a84ad;
  font-size: 12px;
  font-weight: 650;
}

.record-card__head h2 {
  margin: 0;
  color: #17205a;
  font-size: 18px;
  font-weight: 680;
  line-height: 1.25;
}

.record-card__teaser {
  margin: 0;
  color: #526099;
  font-size: 13px;
  line-height: 1.55;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.9em;
}

.record-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: auto;
}

.record-card__avatars {
  display: flex;
  align-items: center;
}

.record-card__avatars img,
.record-card__avatars span {
  width: 28px;
  height: 28px;
  margin-left: -6px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

.record-card__avatars img:first-child {
  margin-left: 0;
}

.record-card__avatars span {
  display: grid;
  place-items: center;
  color: #625cf0;
  background: #f0eeff;
  font-size: 11px;
  font-weight: 700;
}

.record-card__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: #7a84ad;
  font-size: 12px;
}

.record-card__meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.record-card__recap-tag {
  color: #7a5cff;
  font-weight: 650;
}

.record-card__actions {
  padding: 0 16px 16px;
}

.record-card__btn {
  width: 100%;
  height: 38px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #334078;
  font: inherit;
  font-size: 13px;
  font-weight: 650;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;
}

.record-card__btn--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  box-shadow: 0 10px 18px rgba(88, 80, 239, 0.22);
}

.record-card__btn:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.82);
}

.record-card__btn--primary:hover {
  background: linear-gradient(180deg, #817dff, #635ff5);
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.72;
  }
  50% {
    opacity: 1;
  }
}

@media (max-width: 720px) {
  .records-page :deep(.aa-page-inner) {
    padding-inline: 18px;
  }

  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .search-pill {
    width: 100%;
  }

  .record-grid {
    grid-template-columns: 1fr;
  }
}
</style>
