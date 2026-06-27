<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Plus, Search, SlidersHorizontal, Upload } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import ArenaPageSkeleton from '@renderer/components/arena/ArenaPageSkeleton.vue'
import CharacterEditDialog from '@renderer/components/arena/CharacterEditDialog.vue'
import { characterBannerUrl } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '@renderer/router'
import { characterService, formatUserMessage, portableDataService } from '@renderer/services/arena'
import { resolveModelInfo } from '@renderer/data/model-catalog'
import { CHARACTER_MODEL_OPTIONS } from '@shared/arena/constants'
import type { Character, CharacterStatus } from '@shared/arena/types'

const characters = ref<Character[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const modelFilter = ref('all')
const statusFilter = ref<CharacterStatus | 'all'>('all')
const sortBy = ref<'updated' | 'created' | 'name' | 'matches'>('updated')
const createOpen = ref(false)
const importing = ref(false)

function modelName(modelId: string) {
  return resolveModelInfo(modelId).label
}

function matchLabel(char: Character): string {
  if (char.stats.matchCount <= 0) return '尚未参战'
  return `${char.stats.matchCount} 场对局`
}

async function loadCharacters() {
  loading.value = true
  error.value = ''
  try {
    characters.value = await characterService.list({
      query: query.value,
      modelId: modelFilter.value,
      status: statusFilter.value,
      sort: sortBy.value,
    })
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

let searchTimer: number | undefined

watch(query, () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void loadCharacters(), 260)
})

onMounted(() => {
  void loadCharacters()
  if (route.value.path.includes('create=1')) createOpen.value = true
})

watch(
  () => route.value.path,
  (path) => {
    if (path.includes('create=1')) createOpen.value = true
  }
)

function openCreate() {
  createOpen.value = true
}

function onCharacterCreated(char: Character) {
  navigate(`/character-detail/${char.id}`)
}

async function importCharacter() {
  importing.value = true
  error.value = ''
  try {
    const imported = await portableDataService.importCharacter()
    if (imported) {
      await loadCharacters()
      navigate(`/character-detail/${imported.id}`)
    }
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <ArenaPageShell class="characters-page" viewport-lock>
    <section class="list-toolbar" aria-label="角色筛选">
      <label class="search-pill">
        <Search :size="17" />
        <input v-model="query" type="text" placeholder="搜索角色、标签或设定..." @keyup.enter="loadCharacters" />
      </label>
      <div class="toolbar-right">
        <div class="filter-cluster">
          <SlidersHorizontal :size="17" />
          <select v-model="modelFilter" @change="loadCharacters">
            <option value="all">全部模型</option>
            <option v-for="m in CHARACTER_MODEL_OPTIONS" :key="m.id" :value="m.id">{{ m.label }}</option>
          </select>
          <select v-model="statusFilter" @change="loadCharacters">
            <option value="all">全部状态</option>
            <option value="enabled">已启用</option>
            <option value="disabled">已停用</option>
          </select>
          <select v-model="sortBy" @change="loadCharacters">
            <option value="updated">最近更新</option>
            <option value="created">最近创建</option>
            <option value="name">名称排序</option>
            <option value="matches">对局次数</option>
          </select>
        </div>
        <button class="toolbar-action toolbar-action--ghost" type="button" :disabled="importing" @click="importCharacter">
          <Upload :size="17" />
          导入
        </button>
        <button class="toolbar-action" type="button" @click="openCreate">
          <Plus :size="17" />
          新建角色
        </button>
      </div>
    </section>

    <ArenaPageState
      :loading="loading"
      :error="error || undefined"
      :empty="!loading && !error && !characters.length"
      skeleton="grid-cards"
      loading-label="正在整理角色库..."
      @retry="loadCharacters"
    >
      <template #skeleton>
        <ArenaPageSkeleton variant="grid-cards" embedded label="正在整理角色库..." />
      </template>
      <template #empty>
        <strong>还没有符合条件的角色</strong>
        <span>新建一个 AI 伙伴，或者放宽筛选条件。</span>
        <button type="button" @click="openCreate">新建角色</button>
      </template>

      <section class="character-grid arena-stagger" aria-label="角色列表">
      <article
        v-for="char in characters"
        :key="char.id"
        class="library-card"
        :class="{ disabled: char.status !== 'enabled' }"
        :style="{ '--accent': char.accentColor }"
        @click="navigate(`/character-detail/${char.id}`)"
      >
        <div class="card-banner">
          <img
            class="card-banner__img"
            :src="characterBannerUrl(char)"
            :alt="char.name"
          />
          <span class="status-badge" :class="{ off: char.status !== 'enabled' }">
            <i aria-hidden="true" />
            {{ char.status === 'enabled' ? '在线' : '停用' }}
          </span>
        </div>
        <div class="card-body">
          <h2 class="card-body__name">{{ char.name }}</h2>
          <p class="card-body__subtitle">{{ char.subtitle || '未填写一句话设定' }}</p>
          <div v-if="char.tags.length || char.modelId" class="card-body__tags">
            <span class="card-body__tag card-body__tag--model">{{ modelName(char.modelId) }}</span>
            <span v-for="tag in char.tags.slice(0, 2)" :key="tag" class="card-body__tag">{{ tag }}</span>
          </div>
          <span class="card-body__stat">{{ matchLabel(char) }}</span>
        </div>
      </article>
      </section>
    </ArenaPageState>

    <CharacterEditDialog v-model="createOpen" section="create" @saved="onCharacterCreated" />
  </ArenaPageShell>
</template>

<style scoped>
.characters-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 28px 38px 0;
  min-height: 0;
}

.characters-page :deep(.arena-page-state) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.characters-page :deep(.arena-page-state__skeleton),
.characters-page :deep(.arena-page-state__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.characters-page :deep(.arena-page-state__skeleton)::-webkit-scrollbar,
.characters-page :deep(.arena-page-state__content)::-webkit-scrollbar {
  display: none;
}

.characters-page :deep(.arena-page-state__content) {
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
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.toolbar-action:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 28px rgba(88, 80, 239, 0.28);
}

.toolbar-action--ghost {
  color: #4b5688;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(130, 142, 207, 0.18);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.toolbar-action--ghost:hover {
  box-shadow: 0 10px 20px rgba(88, 80, 239, 0.12);
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

.character-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 280px);
  gap: 16px;
  align-content: start;
  align-items: start;
  justify-content: start;
  width: fit-content;
  max-width: 100%;
  padding: 2px 4px 24px;
}

.library-card {
  --accent: #7568ff;
  --card-width: 280px;
  --banner-ratio: 1280 / 720;
  width: var(--card-width);
  max-width: var(--card-width);
  align-self: start;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: none;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(91, 101, 174, 0.1);
  cursor: pointer;
  transition: transform 0.24s ease, box-shadow 0.24s ease, border-color 0.24s ease;
}

.library-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--accent) 28%, rgba(130, 142, 207, 0.22));
  box-shadow: 0 16px 32px rgba(91, 101, 174, 0.14);
}

.library-card.disabled {
  opacity: 0.62;
  filter: saturate(0.72);
}

.library-card.disabled:hover {
  transform: translateY(-2px);
}

.card-banner {
  position: relative;
  width: 100%;
  aspect-ratio: var(--banner-ratio);
  flex: none;
  overflow: hidden;
  background: #eef1f8;
}

.card-banner__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center center;
  transition: transform 0.35s ease;
}

.library-card:hover .card-banner__img {
  transform: scale(1.03);
}

.card-body {
  display: grid;
  gap: 6px;
  padding: 12px 14px 14px;
  background: #fff;
}

.card-body__name {
  margin: 0;
  overflow: hidden;
  color: #17205a;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body__subtitle {
  margin: 0;
  overflow: hidden;
  color: #66709d;
  font-size: 12px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
}

.card-body__tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 24px;
  padding: 0 9px;
  overflow: hidden;
  border-radius: 8px;
  font-size: 11px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-body__tag--model {
  color: color-mix(in srgb, var(--accent) 78%, #26305e);
  background: color-mix(in srgb, var(--accent) 12%, white);
}

.card-body__tag:not(.card-body__tag--model) {
  color: #655df0;
  border: 1px solid rgba(109, 101, 255, 0.12);
  background: rgba(112, 105, 255, 0.08);
}

.card-body__stat {
  margin-top: 2px;
  color: #9aa3c7;
  font-size: 11px;
  line-height: 1.3;
}

.status-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px 5px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(10px);
  color: #18a765;
  font-size: 11px;
  font-weight: 600;
}

.status-badge i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 18%, transparent);
}

.status-badge.off {
  color: #7380aa;
}

.character-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  min-height: 0;
  color: #65709f;
  font-size: 15px;
}

.character-state button {
  border: 0;
  color: #5b57f3;
  cursor: pointer;
  font: inherit;
  height: 34px;
  padding: 0 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
}

.empty strong {
  color: #17205a;
  font-size: 18px;
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
