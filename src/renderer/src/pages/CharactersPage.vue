<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Clock3,
  Crown,
  Heart,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
  Tag,
  Upload,
  Users,
} from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterEditDialog from '@renderer/components/arena/CharacterEditDialog.vue'
import LineupSection from '@renderer/components/arena/LineupSection.vue'
import { characterBannerUrl } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '@renderer/router'
import { characterService, formatUserMessage, portableDataService } from '@renderer/services/arena'
import {
  getCharacterLibraryPrefs,
  touchRecentCharacter,
  type CharacterLibraryCategory,
} from '@renderer/services/arena/character-library-prefs'
import { resolveModelInfo } from '@renderer/data/model-catalog'
import { CHARACTER_MODEL_OPTIONS } from '@shared/arena/constants'
import type { Character, CharacterStatus } from '@shared/arena/types'
import { formatExpProgress } from '@shared/arena/character-growth'

type SidebarView = 'library' | 'lineup'

const allCharacters = ref<Character[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const modelFilter = ref('all')
const statusFilter = ref<CharacterStatus | 'all'>('all')
const sortBy = ref<'updated' | 'created' | 'name' | 'matches' | 'level'>('updated')
const sidebarView = ref<SidebarView>('library')
const sidebarCategory = ref<CharacterLibraryCategory | 'tag'>('all')
const tagFilter = ref('')
const createOpen = ref(false)
const importing = ref(false)
const prefsVersion = ref(0)

const sidebarTags = computed(() => {
  const set = new Set<string>()
  for (const char of allCharacters.value) {
    for (const tag of char.tags) set.add(tag)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const prefs = computed(() => {
  prefsVersion.value
  return getCharacterLibraryPrefs()
})

const categoryCounts = computed(() => ({
  all: allCharacters.value.length,
  mine: allCharacters.value.filter((c) => c.status === 'enabled' && !c.isUserProfile).length,
  favorites: allCharacters.value.filter((c) => prefs.value.favoriteIds.includes(c.id)).length,
  recent: allCharacters.value.filter((c) => prefs.value.recentIds.includes(c.id)).length,
}))

const filteredCharacters = computed(() => {
  let items = [...allCharacters.value]
  const q = query.value.trim().toLowerCase()
  if (q) {
    items = items.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q))
    )
  }
  if (modelFilter.value !== 'all') items = items.filter((c) => c.modelId === modelFilter.value)
  if (statusFilter.value !== 'all') items = items.filter((c) => c.status === statusFilter.value)

  if (sidebarCategory.value === 'mine') {
    items = items.filter((c) => c.status === 'enabled' && !c.isUserProfile)
  } else if (sidebarCategory.value === 'favorites') {
    const fav = new Set(prefs.value.favoriteIds)
    items = items.filter((c) => fav.has(c.id))
  } else if (sidebarCategory.value === 'recent') {
    const order = new Map(prefs.value.recentIds.map((id, index) => [id, index]))
    items = items.filter((c) => order.has(c.id))
    items.sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999))
    return items
  } else if (sidebarCategory.value === 'tag' && tagFilter.value) {
    items = items.filter((c) => c.tags.includes(tagFilter.value))
  }

  switch (sortBy.value) {
    case 'name':
      return items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    case 'created':
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'matches':
      return items.sort((a, b) => b.stats.matchCount - a.stats.matchCount)
    case 'level':
      return items.sort(
        (a, b) =>
          formatExpProgress(b).level - formatExpProgress(a).level ||
          formatExpProgress(b).current - formatExpProgress(a).current
      )
    case 'updated':
    default:
      return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
})

function modelName(modelId: string) {
  return resolveModelInfo(modelId).label
}

function levelLabel(char: Character): string {
  return `Lv.${formatExpProgress(char).level}`
}

function openCharacter(char: Character) {
  touchRecentCharacter(char.id)
  prefsVersion.value += 1
  navigate(`/character-detail/${char.id}`)
}

async function loadCharacters() {
  loading.value = true
  error.value = ''
  try {
    allCharacters.value = await characterService.list({
      modelId: modelFilter.value,
      status: statusFilter.value,
    })
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

watch([modelFilter, statusFilter], () => {
  void loadCharacters()
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
      openCharacter(imported)
    }
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    importing.value = false
  }
}

function selectSidebarCategory(id: CharacterLibraryCategory | 'tag') {
  sidebarView.value = 'library'
  sidebarCategory.value = id
}

function openLineupView() {
  sidebarView.value = 'lineup'
}

const sidebarItems: Array<{
  id: CharacterLibraryCategory
  label: string
  icon: typeof Crown
}> = [
  { id: 'all', label: '全部角色', icon: Crown },
  { id: 'mine', label: '我的角色', icon: Users },
  { id: 'favorites', label: '收藏角色', icon: Heart },
  { id: 'recent', label: '最近互动', icon: Clock3 },
]
</script>

<template>
  <ArenaPageShell class="characters-page" viewport-lock>
    <div class="characters-layout">
      <aside class="characters-sidebar" aria-label="角色筛选">
        <label v-if="sidebarView === 'library'" class="sidebar-search">
          <Search :size="16" />
          <input v-model="query" type="text" placeholder="搜索角色、标签或设定..." />
        </label>

        <nav class="sidebar-nav">
          <button
            v-for="item in sidebarItems"
            :key="item.id"
            type="button"
            class="sidebar-nav__item"
            :class="{ active: sidebarView === 'library' && sidebarCategory === item.id }"
            @click="selectSidebarCategory(item.id)"
          >
            <component :is="item.icon" :size="16" />
            <span>{{ item.label }}</span>
            <em>{{ categoryCounts[item.id] }}</em>
          </button>

          <div v-if="sidebarView === 'library'" class="sidebar-nav__tag">
            <label>
              <Tag :size="16" />
              <span>按标签浏览</span>
            </label>
            <select v-model="tagFilter" @change="selectSidebarCategory(tagFilter ? 'tag' : 'all')">
              <option value="">选择标签</option>
              <option v-for="tag in sidebarTags" :key="tag" :value="tag">{{ tag }}</option>
            </select>
          </div>

          <div class="sidebar-nav__divider" />

          <button
            type="button"
            class="sidebar-nav__item sidebar-nav__item--lineup"
            :class="{ active: sidebarView === 'lineup' }"
            @click="openLineupView"
          >
            <LayoutGrid :size="16" />
            <span>我的阵容</span>
          </button>
        </nav>
      </aside>

      <section class="characters-main">
        <template v-if="sidebarView === 'library'">
          <header class="characters-toolbar">
          <div class="toolbar-filters">
            <SlidersHorizontal :size="16" />
            <select v-model="modelFilter">
              <option value="all">全部模型</option>
              <option v-for="m in CHARACTER_MODEL_OPTIONS" :key="m.id" :value="m.id">{{ m.label }}</option>
            </select>
            <select v-model="statusFilter">
              <option value="all">全部状态</option>
              <option value="enabled">已启用</option>
              <option value="disabled">已停用</option>
            </select>
            <select v-model="sortBy">
              <option value="updated">最近更新</option>
              <option value="created">最近创建</option>
              <option value="name">名称排序</option>
              <option value="matches">对局次数</option>
              <option value="level">等级优先</option>
            </select>
          </div>
          <div class="toolbar-actions">
            <button class="toolbar-btn toolbar-btn--ghost" type="button" :disabled="importing" @click="importCharacter">
              <Upload :size="16" />
              导入
            </button>
            <button class="toolbar-btn" type="button" @click="openCreate">
              <Plus :size="16" />
              新建角色
            </button>
          </div>
        </header>

        <ArenaPageState
          :loading="loading"
          :error="error || undefined"
          :empty="!loading && !error && !filteredCharacters.length"
          skeleton="grid-cards"
          loading-label="正在整理角色库..."
          @retry="loadCharacters"
        >
          <template #empty>
            <strong>还没有符合条件的角色</strong>
            <span>新建一个 AI 伙伴，或者放宽筛选条件。</span>
            <button type="button" @click="openCreate">新建角色</button>
          </template>

          <div class="characters-grid" aria-label="角色列表">
            <article
              v-for="char in filteredCharacters"
              :key="char.id"
              class="library-card"
              :class="{ disabled: char.status !== 'enabled' }"
              :style="{ '--accent': char.accentColor }"
              @click="openCharacter(char)"
            >
              <div class="library-card__banner">
                <img :src="characterBannerUrl(char)" :alt="char.name" />
                <span class="library-card__status" :class="{ off: char.status !== 'enabled' }">
                  {{ char.status === 'enabled' ? '在线' : '停用' }}
                </span>
                <span class="library-card__level">{{ levelLabel(char) }}</span>
              </div>
              <div class="library-card__body">
                <h3>{{ char.name }}</h3>
                <p>{{ char.subtitle || char.tags[0] || modelName(char.modelId) }}</p>
              </div>
            </article>
          </div>
        </ArenaPageState>
        </template>

        <div v-else class="lineup-page">
          <LineupSection :characters="allCharacters" />
        </div>
      </section>
    </div>

    <CharacterEditDialog v-model="createOpen" section="create" @saved="onCharacterCreated" />
  </ArenaPageShell>
</template>

<style scoped>
.characters-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 24px 16px;
}

.characters-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  flex: 1 1 0;
  min-height: 0;
}

.characters-sidebar {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(130, 142, 207, 0.14);
}

.sidebar-search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(130, 142, 207, 0.14);
  color: #66709d;
}

.sidebar-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #18205a;
  font: inherit;
  font-size: 13px;
}

.sidebar-nav {
  display: grid;
  gap: 6px;
}

.sidebar-nav__item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #59649b;
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.sidebar-nav__item em {
  color: #9aa3c7;
  font-style: normal;
  font-size: 12px;
}

.sidebar-nav__item.active {
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-weight: 600;
}

.sidebar-nav__tag {
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding-top: 10px;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.sidebar-nav__tag label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #59649b;
  font-size: 13px;
}

.sidebar-nav__tag select {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  color: #243066;
  font: inherit;
  font-size: 12px;
}

.sidebar-nav__divider {
  height: 1px;
  margin: 8px 0;
  background: rgba(130, 142, 207, 0.12);
}

.sidebar-nav__item--lineup {
  margin-top: 2px;
}

.characters-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

.characters-page :deep(.arena-page-state) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.characters-page :deep(.arena-page-state__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
}

.characters-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.toolbar-filters,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toolbar-filters {
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(130, 142, 207, 0.14);
  color: #66709d;
}

.toolbar-filters select {
  border: 0;
  outline: 0;
  background: transparent;
  color: #243066;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #7a75ff, #5b57f3);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.toolbar-btn--ghost {
  color: #4b5688;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(130, 142, 207, 0.18);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(248px, 1fr));
  gap: 18px;
  align-content: start;
  padding: 2px 4px 12px;
}

.library-card {
  --accent: #7568ff;
  overflow: hidden;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(91, 101, 174, 0.1);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.library-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--accent) 28%, rgba(130, 142, 207, 0.22));
  box-shadow: 0 18px 36px rgba(91, 101, 174, 0.15);
}

.library-card.disabled {
  opacity: 0.68;
}

.library-card__banner {
  position: relative;
  aspect-ratio: 16 / 11;
  overflow: hidden;
  background: #eef1f8;
}

.library-card__banner img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.35s ease;
}

.library-card:hover .library-card__banner img {
  transform: scale(1.03);
}

.library-card__status {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.88);
  color: #18a765;
  font-size: 11px;
  font-weight: 600;
}

.library-card__status.off {
  color: #7380aa;
}

.library-card__level {
  position: absolute;
  left: 12px;
  bottom: 12px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(14, 18, 46, 0.76);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.library-card__body {
  display: grid;
  gap: 6px;
  padding: 14px 14px 16px;
}

.library-card__body h3 {
  margin: 0;
  overflow: hidden;
  color: #17205a;
  font-size: 17px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-card__body p {
  margin: 0;
  overflow: hidden;
  color: #66709d;
  font-size: 13px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-page {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 4px 2px;
}

@media (max-width: 980px) {
  .characters-layout {
    grid-template-columns: 1fr;
  }
}
</style>
