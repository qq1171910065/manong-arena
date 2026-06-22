<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Clock, Coins, Search, SlidersHorizontal } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName, matchImageByModeId } from '@renderer/data/arena-visual-assets'
import { navigate } from '../router'
import { formatUserMessage, gameModeService, matchService, matchWindowService } from '@renderer/services/arena'
import { formatTimeLabel, formatYuan } from '@renderer/utils/id'
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
  if (record.status === 'active') return `进行中 · 第${record.runtime.currentRound}夜 ${record.runtime.currentPhaseName}`
  if (record.status === 'paused' || record.status === 'aborted') return '中断 · 房主主动中断'
  return `已结束 · ${record.winnerCamp || '平民阵营'}胜利`
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
  <ArenaPageShell class="records-page">
    <section class="list-toolbar" aria-label="对局筛选">
      <label class="search-pill">
        <Search :size="17" />
        <input v-model="query" type="text" placeholder="搜索对局、玩法或角色..." />
      </label>
      <div class="toolbar-right">
        <div class="filter-cluster">
          <SlidersHorizontal :size="17" />
          <select v-model="statusFilter">
            <option value="all">全部状态</option>
            <option value="active">进行中</option>
            <option value="completed">已结束</option>
            <option value="interrupted">中断</option>
          </select>
          <select v-model="modeFilter">
            <option value="all">全部玩法</option>
            <option v-for="mode in modeOptions" :key="mode.id" :value="mode.id">{{ mode.name }}</option>
          </select>
          <select v-model="sortBy">
            <option value="updated-desc">最近更新</option>
            <option value="updated-asc">最早更新</option>
          </select>
        </div>
      </div>
    </section>

    <ArenaPageState
      :loading="loading"
      :error="error || undefined"
      :empty="!loading && !error && !filteredRecords.length"
      skeleton="list-rows"
      loading-label="加载对局记录..."
      @retry="load"
    >
      <template #empty>
        <strong>暂无符合条件的对局记录</strong>
        <span>试试调整搜索词或筛选条件。</span>
      </template>

      <div class="record-list arena-stagger">
      <article v-for="record in filteredRecords" :key="record.id" class="record-row" @click="openRecord(record)">
        <img class="record-emblem" :src="matchImageByModeId(record.gameModeId)" :alt="record.gameModeName" />
        <div class="record-main">
          <h2>
            {{ record.gameModeName }}
            <span>{{ record.title.replace(record.gameModeName, '').replace('·', '').trim() || record.title }}</span>
          </h2>
          <div class="record-avatars">
            <img
              v-for="(participant, index) in record.participants.slice(0, 6)"
              :key="participant.characterId"
              :src="characterAvatarByName(participant.characterName, index, participant.modelId, participant.avatarUrl)"
              :alt="participant.characterName"
            />
            <span v-if="record.participants.length > 6">+{{ record.participants.length - 6 }}</span>
          </div>
        </div>

        <div class="record-time">
          <p><Clock :size="17" /> {{ formatTimeLabel(record.updatedAt) }}</p>
          <strong :class="{ active: record.status === 'active', paused: record.status === 'paused' || record.status === 'aborted' }">
            {{ statusText(record) }}
          </strong>
        </div>

        <div class="record-cost">
          <Coins :size="18" />
          -{{ formatYuan(record.totalCostCents).replace('¥', '') }}
        </div>

        <button
          v-if="record.status === 'active' || record.status === 'paused'"
          class="row-action primary"
          type="button"
          @click.stop="matchWindowService.open(record.id)"
        >
          继续
        </button>
        <button class="row-action" type="button" @click.stop="navigate(`/match-detail/${record.id}`)">查看详情</button>
      </article>
      </div>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.records-page :deep(.aa-page-inner) {
  max-width: none;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 14px;
  padding: 28px 38px 20px;
  overflow: hidden;
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
  width: 360px;
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

.filter-cluster select {
  height: 32px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #243066;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.list-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  min-height: 0;
  color: #65709f;
  font-size: 15px;
}

.list-state button {
  border: 0;
  color: #5b57f3;
  cursor: pointer;
  font: inherit;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
}

.list-state.empty strong {
  color: #17205a;
  font-size: 18px;
}

.record-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 2px 4px 10px;
  scrollbar-width: none;
}

.record-list::-webkit-scrollbar {
  display: none;
}

.record-row {
  display: grid;
  grid-template-columns: 70px minmax(280px, 1fr) minmax(248px, 0.72fr) 96px 108px 116px;
  align-items: center;
  gap: 12px;
  min-height: 84px;
  padding: 9px 16px 9px 13px;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.68);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 12px 28px rgba(91, 101, 174, 0.08);
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.22s ease,
    background 0.22s ease;
}

.record-row:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 16px 28px rgba(91, 101, 174, 0.12);
}

.record-emblem {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 8px 14px rgba(45, 55, 116, 0.16);
}

.record-main {
  min-width: 0;
}

.record-main h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #17205a;
  font-size: 17px;
  font-weight: 680;
}

.record-main h2 span {
  overflow: hidden;
  color: #2a3268;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 520;
}

.record-avatars {
  display: flex;
  align-items: center;
  margin-top: 10px;
}

.record-avatars img,
.record-avatars span {
  width: 26px;
  height: 26px;
  margin-left: -5px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

.record-avatars img:first-child {
  margin-left: 0;
}

.record-avatars span {
  display: grid;
  place-items: center;
  color: #625cf0;
  background: #f0eeff;
  font-size: 13px;
}

.record-time {
  color: #65709f;
  font-size: 13px;
}

.record-time p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 6px;
}

.record-time strong {
  color: #24a967;
  font-weight: 550;
}

.record-time strong.active {
  color: #605cf1;
}

.record-time strong.paused {
  color: #f08435;
}

.record-cost {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #26305e;
  font-size: 14px;
  font-weight: 520;
}

.row-action {
  min-width: 104px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid rgba(130, 142, 207, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.5);
  color: #334078;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.row-action.primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  box-shadow: 0 12px 20px rgba(88, 80, 239, 0.22);
}

.row-action:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 18px rgba(91, 101, 174, 0.09);
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
