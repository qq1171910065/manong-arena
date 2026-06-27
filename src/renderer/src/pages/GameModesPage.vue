<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Plus, Search, SlidersHorizontal, Upload, Users } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import ArenaPageSkeleton from '@renderer/components/arena/ArenaPageSkeleton.vue'
import CreateGameModeDialog from '@renderer/components/arena/CreateGameModeDialog.vue'
import { modeImageById } from '@renderer/data/arena-visual-assets'
import { navigate } from '../router'
import { formatUserMessage, gameModeService, isModePlayable, loadGameModeOverrides, portableDataService } from '@renderer/services/arena'
import type { GameMode } from '@shared/arena/types'

const modes = ref<GameMode[]>([])
const loading = ref(true)
const query = ref('')
const availabilityFilter = ref<'all' | 'available' | 'coming'>('all')
const sortBy = ref<'name' | 'players' | 'recommended'>('name')
const createOpen = ref(false)
const importing = ref(false)
const error = ref('')

const tagMap: Record<string, string[]> = {
  werewolf: ['身份推理', '逻辑对抗', '阵营对抗'],
  avalon: ['阵营对抗', '策略投票', '角色能力'],
  undercover: ['语言推理', '词语猜测', '轻松娱乐'],
  roundtable: ['自由讨论', '观点碰撞', '角色互动'],
}

onMounted(async () => {
  try {
    await loadGameModeOverrides()
    modes.value = gameModeService.list()
  } finally {
    loading.value = false
  }
})

function isModeAvailable(mode: GameMode): boolean {
  return isModePlayable(mode)
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

async function importGameMode() {
  importing.value = true
  error.value = ''
  try {
    const mode = await portableDataService.importGameMode()
    if (mode) {
      await loadGameModeOverrides()
      modes.value = gameModeService.list()
      navigate(`/game-mode-detail/${mode.id}`)
    }
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    importing.value = false
  }
}

function onModeCreated(modeId: string) {
  modes.value = gameModeService.list()
  navigate(`/game-mode-detail/${modeId}`)
}
</script>

<template>
  <ArenaPageShell class="modes-page" viewport-lock>
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
        <button class="toolbar-action toolbar-action--ghost" type="button" :disabled="importing" @click="importGameMode">
          <Upload :size="17" />
          导入
        </button>
        <button class="toolbar-action" type="button" @click="createOpen = true">
          <Plus :size="17" />
          新建玩法
        </button>
      </div>
    </section>

    <p v-if="error" class="modes-error">{{ error }}</p>

    <ArenaPageState
      :loading="loading"
      :empty="!loading && !filteredModes.length"
      skeleton="immersive-cards"
      loading-label="正在整理玩法库..."
    >
      <template #skeleton>
        <ArenaPageSkeleton variant="immersive-cards" embedded label="正在整理玩法库..." />
      </template>
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
          <div class="mode-card__media">
            <img class="mode-card__img" :src="modeImageById(mode.id)" :alt="mode.name" />
            <span v-if="!isModeAvailable(mode)" class="mode-card__status">筹备中</span>
            <div class="mode-card__caption">
              <h2 class="mode-card__name">{{ mode.name }}</h2>
              <p v-if="mode.subtitle" class="mode-card__subtitle">{{ mode.subtitle }}</p>
              <div class="mode-card__meta">
                <Users :size="14" />
                <span>{{ mode.minPlayers }}-{{ mode.maxPlayers }} 人</span>
                <span class="mode-card__meta-sep" aria-hidden="true">·</span>
                <span>推荐 {{ mode.recommendedPlayers }} 人</span>
              </div>
              <div v-if="tagMap[mode.id]?.length" class="mode-card__tags">
                <span v-for="tag in tagMap[mode.id].slice(0, 3)" :key="tag">{{ tag }}</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </ArenaPageState>

    <CreateGameModeDialog v-model:open="createOpen" @created="onModeCreated" />
  </ArenaPageShell>
</template>

<style scoped>
.modes-page {
  --mode-card-height: 300px;
}

.modes-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 38px 0;
  min-height: 0;
}

.modes-page :deep(.arena-page-state) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.modes-page :deep(.arena-page-state__skeleton),
.modes-page :deep(.arena-page-state__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.modes-page :deep(.arena-page-state__skeleton)::-webkit-scrollbar,
.modes-page :deep(.arena-page-state__content)::-webkit-scrollbar {
  display: none;
}

.modes-page :deep(.arena-page-state__content) {
  display: block;
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

.toolbar-action {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 18px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #7a75ff, #5b57f3);
  box-shadow: 0 12px 24px rgba(88, 80, 239, 0.22);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.toolbar-action--ghost {
  color: #4b5688;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(130, 142, 207, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.modes-error {
  margin: 0;
  padding: 0 4px;
  color: #dc2626;
  font-size: 13px;
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
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  align-content: start;
  width: 100%;
  max-width: 100%;
  padding: 2px 4px 24px;
}

.modes-page :deep(.aa-skeleton-grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  width: 100%;
  max-width: 100%;
}

.modes-page :deep(.aa-skeleton-immersive-card) {
  width: 100%;
  max-width: none;
  height: var(--mode-card-height);
  aspect-ratio: auto;
}

.mode-card {
  width: 100%;
  max-width: none;
  height: var(--mode-card-height);
  aspect-ratio: auto;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.58);
  border-radius: 20px;
  background:
    radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.95), transparent 44%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(217, 222, 255, 0.46));
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 16px 32px rgba(90, 102, 174, 0.14);
  cursor: pointer;
  transition: transform 0.28s ease, box-shadow 0.28s ease, border-color 0.28s ease, filter 0.28s ease;
}

.mode-card:hover {
  transform: translateY(-6px);
  border-color: rgba(255, 255, 255, 0.78);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 22px 42px rgba(91, 101, 174, 0.2);
  filter: drop-shadow(0 16px 24px rgba(82, 91, 168, 0.14));
}

.mode-card.disabled {
  opacity: 0.58;
  filter: saturate(0.65);
}

.mode-card.disabled:hover {
  transform: translateY(-3px);
}

.mode-card__media {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.mode-card__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 18%;
  transition: transform 0.45s ease, filter 0.35s ease;
}

.mode-card:hover .mode-card__img {
  transform: scale(1.08);
  filter: saturate(1.06);
}

.mode-card__status {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 4;
  padding: 5px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(40, 34, 82, 0.55);
  backdrop-filter: blur(10px);
  font-size: 11px;
  font-weight: 600;
}

.mode-card__caption {
  position: absolute;
  inset: auto 0 0;
  z-index: 3;
  display: grid;
  gap: 3px;
  padding: 22px 14px 12px;
  background: linear-gradient(
    180deg,
    rgba(18, 24, 58, 0) 0%,
    rgba(18, 24, 58, 0.45) 30%,
    rgba(18, 24, 58, 0.82) 100%
  );
  pointer-events: none;
}

.mode-card__name {
  margin: 0;
  overflow: hidden;
  color: #fff;
  font-size: 17px;
  font-weight: 680;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(8, 12, 36, 0.45);
}

.mode-card__subtitle {
  margin: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.9);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 6px rgba(8, 12, 36, 0.38);
}

.mode-card__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 2px;
  color: rgba(220, 228, 255, 0.88);
  font-size: 11px;
  line-height: 1.3;
  text-shadow: 0 1px 4px rgba(8, 12, 36, 0.32);
}

.mode-card__meta-sep {
  opacity: 0.72;
}

.mode-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.mode-card__tags span {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 8px;
  overflow: hidden;
  color: #fff;
  font-size: 10px;
  font-weight: 560;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.42);
  box-shadow: 0 2px 8px rgba(8, 12, 36, 0.16);
  backdrop-filter: blur(6px);
}
</style>
