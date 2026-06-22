<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Search, SlidersHorizontal, Users } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { modeBadges, modeImageById } from '@renderer/data/arena-visual-assets'
import { navigate } from '../router'
import { gameModeService } from '@renderer/services/arena'
import type { GameMode } from '@shared/arena/types'

const modes = ref<GameMode[]>([])
const query = ref('')
const availabilityFilter = ref<'all' | 'available' | 'coming'>('all')
const sortBy = ref<'name' | 'players' | 'recommended'>('name')

const tagMap: Record<string, string[]> = {
  werewolf: ['身份推理', '逻辑对抗', '阵营对抗'],
  avalon: ['阵营对抗', '策略投票', '角色能力'],
  undercover: ['语言推理', '词语猜测', '轻松娱乐'],
  custom: ['自由规则', '创意无限', '个性玩法'],
}

onMounted(() => {
  modes.value = gameModeService.list()
})

function isModeAvailable(mode: GameMode): boolean {
  return mode.id === 'werewolf'
}

const filteredModes = computed(() => {
  let list = [...modes.value]
  const q = query.value.trim().toLowerCase()
  if (q) {
    list = list.filter((mode) => {
      const tags = tagMap[mode.id] || []
      return (
        mode.name.toLowerCase().includes(q) ||
        mode.subtitle.toLowerCase().includes(q) ||
        mode.description.toLowerCase().includes(q) ||
        tags.some((tag) => tag.toLowerCase().includes(q))
      )
    })
  }
  if (availabilityFilter.value === 'available') {
    list = list.filter((mode) => isModeAvailable(mode))
  } else if (availabilityFilter.value === 'coming') {
    list = list.filter((mode) => !isModeAvailable(mode))
  }
  list.sort((a, b) => {
    if (sortBy.value === 'players') return a.minPlayers - b.minPlayers
    if (sortBy.value === 'recommended') return a.recommendedPlayers - b.recommendedPlayers
    return a.name.localeCompare(b.name, 'zh-CN')
  })
  return list
})

function openMode(mode: GameMode) {
  navigate(`/game-mode-detail/${mode.id}`)
}
</script>

<template>
  <ArenaPageShell class="modes-page">
    <section class="list-toolbar" aria-label="玩法筛选">
      <label class="search-pill">
        <Search :size="17" />
        <input v-model="query" type="text" placeholder="搜索玩法名称、标签或说明..." />
      </label>
      <div class="toolbar-right">
        <div class="filter-cluster">
          <SlidersHorizontal :size="17" />
          <select v-model="availabilityFilter">
            <option value="all">全部状态</option>
            <option value="available">已开放</option>
            <option value="coming">筹备中</option>
          </select>
          <select v-model="sortBy">
            <option value="name">名称排序</option>
            <option value="recommended">推荐人数</option>
            <option value="players">最少人数</option>
          </select>
        </div>
      </div>
    </section>

    <ArenaPageState :empty="!filteredModes.length">
      <template #empty>
        <strong>还没有符合条件的玩法</strong>
        <span>试试调整搜索词或筛选条件。</span>
      </template>

      <section class="modes-grid arena-stagger" aria-label="玩法场景">
      <article
        v-for="mode in filteredModes"
        :key="mode.id"
        class="mode-card"
        :class="{ disabled: !isModeAvailable(mode) }"
        @click="openMode(mode)"
      >
        <div class="mode-image-wrap">
          <img :src="modeImageById(mode.id)" :alt="mode.name" />
          <span v-if="!isModeAvailable(mode)" class="mode-soon">筹备中</span>
        </div>
        <div class="mode-copy">
          <h2><span>{{ modeBadges[mode.id] }}</span>{{ mode.name }}</h2>
          <p>{{ mode.subtitle }}</p>
          <strong>
            <Users :size="16" />
            {{ mode.minPlayers }}-{{ mode.maxPlayers }}人
          </strong>
          <div>
            <span v-for="tag in tagMap[mode.id]" :key="tag">{{ tag }}</span>
          </div>
        </div>
      </article>
      </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.modes-page :deep(.aa-page-inner) {
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

.list-state.empty strong {
  color: #17205a;
  font-size: 18px;
}

.modes-grid {
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
  padding: 2px 4px 10px;
  scrollbar-width: none;
}

.modes-grid::-webkit-scrollbar {
  display: none;
}

.mode-card {
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.76);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 16px 36px rgba(91, 101, 174, 0.1);
  backdrop-filter: blur(18px);
  cursor: pointer;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
}

.mode-card:hover {
  transform: translateY(-6px);
  border-color: rgba(112, 105, 255, 0.35);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 22px 42px rgba(91, 101, 174, 0.16);
}

.mode-card.disabled {
  opacity: 0.58;
  filter: saturate(0.65);
}

.mode-card.disabled:hover {
  transform: translateY(-3px);
}

.mode-image-wrap {
  position: relative;
  margin: 12px;
  height: clamp(180px, 24vh, 220px);
  overflow: hidden;
  border-radius: 14px;
}

.mode-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.mode-card:hover .mode-image-wrap img {
  transform: scale(1.05);
}

.mode-soon {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(40, 34, 82, 0.48);
  backdrop-filter: blur(10px);
  font-size: 12px;
  font-weight: 600;
}

.mode-copy {
  padding: 4px 18px 16px;
}

.mode-copy h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: #17205a;
  font-size: 19px;
  font-weight: 650;
}

.mode-copy p {
  margin: 8px 0 12px;
  color: #66709d;
  font-size: 13px;
}

.mode-copy strong {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #65709f;
  font-size: 13px;
  font-weight: 450;
}

.mode-copy div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.mode-copy div span {
  padding: 5px 10px;
  color: #655df0;
  border: 1px solid rgba(109, 101, 255, 0.12);
  border-radius: 8px;
  background: rgba(112, 105, 255, 0.08);
  font-size: 12px;
}
</style>
