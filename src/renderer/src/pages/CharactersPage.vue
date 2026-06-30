<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  Clock3,
  Crown,
  Heart,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Star,
  Upload,
  Users,
} from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterChatDialog from '@renderer/components/arena/CharacterChatDialog.vue'
import CharacterEditDialog from '@renderer/components/arena/CharacterEditDialog.vue'
import LineupEditDialog from '@renderer/components/arena/LineupEditDialog.vue'
import ArenaSelect from '@renderer/components/common/ArenaSelect.vue'
import { characterBannerUrl } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '@renderer/router'
import { characterService, formatUserMessage, lineupService, portableDataService } from '@renderer/services/arena'
import {
  getCharacterLibraryPrefs,
  touchRecentCharacter,
  type CharacterLibraryCategory,
} from '@renderer/services/arena/character-library-prefs'
import { resolveModelInfo } from '@renderer/data/model-catalog'
import { CHARACTER_MODEL_OPTIONS } from '@shared/arena/constants'
import { computeStarRating, formatExpProgress } from '@shared/arena/character-growth'
import type { Character, CharacterLineup, CharacterStatus } from '@shared/arena/types'

type SidebarView = 'library' | 'lineup'

const allCharacters = ref<Character[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const modelFilter = ref('all')
const statusFilter = ref<CharacterStatus | 'all'>('all')
const sortBy = ref<'updated' | 'created' | 'name' | 'matches' | 'level'>('updated')
const sidebarView = ref<SidebarView>('library')
const sidebarCategory = ref<CharacterLibraryCategory>('all')
const createOpen = ref(false)
const importing = ref(false)
const prefsVersion = ref(0)
const chatOpen = ref(false)
const chatCharacter = ref<Character | null>(null)

const lineups = ref<CharacterLineup[]>([])
const activeLineupId = ref<string | null>(null)
const lineupLoading = ref(false)
const lineupError = ref('')
const lineupEditOpen = ref(false)
const editingLineup = ref<CharacterLineup | null>(null)

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

function lineupMembers(lineup: CharacterLineup): Character[] {
  return lineup.characterIds
    .map((id) => allCharacters.value.find((item) => item.id === id))
    .filter(Boolean) as Character[]
}

function lineupWinRateText(lineup: CharacterLineup): string {
  const count = lineup.stats.matchCount || 0
  if (!count) return '—'
  return `${Math.round((lineup.stats.winCount / count) * 100)}%`
}

function lineupCardSubtitle(lineup: CharacterLineup): string {
  const members = lineupMembers(lineup)
  if (!members.length) return '尚未添加成员'
  const names = members.slice(0, 3).map((item) => item.name).join('、')
  return members.length > 3 ? `${names}…` : names
}

function lineupCardBanner(lineup: CharacterLineup): string {
  const members = lineupMembers(lineup)
  if (members.length) return characterBannerUrl(members[0])
  const fallback = allCharacters.value.find((item) => item.status === 'enabled')
  return fallback ? characterBannerUrl(fallback) : ''
}

function lineupAvgLevel(lineup: CharacterLineup): number {
  const members = lineupMembers(lineup)
  if (!members.length) return 0
  const total = members.reduce((sum, item) => sum + formatExpProgress(item).level, 0)
  return Math.round(total / members.length)
}

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

const filteredLineups = computed(() => {
  let items = [...lineups.value]
  const q = query.value.trim().toLowerCase()
  if (q) {
    items = items.filter((lineup) => {
      if (lineup.name.toLowerCase().includes(q)) return true
      return lineupMembers(lineup).some(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.subtitle.toLowerCase().includes(q) ||
          c.tags.some((t) => t.toLowerCase().includes(q))
      )
    })
  }
  if (modelFilter.value !== 'all') {
    items = items.filter((lineup) => lineupMembers(lineup).some((c) => c.modelId === modelFilter.value))
  }
  if (statusFilter.value !== 'all') {
    items = items.filter((lineup) => lineupMembers(lineup).some((c) => c.status === statusFilter.value))
  }

  switch (sortBy.value) {
    case 'name':
      return items.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    case 'created':
      return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'matches':
      return items.sort((a, b) => b.stats.matchCount - a.stats.matchCount)
    case 'level':
      return items.sort((a, b) => lineupAvgLevel(b) - lineupAvgLevel(a))
    case 'updated':
    default:
      return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
})

const modelFilterOptions = computed(() => [
  { label: '全部模型', value: 'all' },
  ...CHARACTER_MODEL_OPTIONS.map((m) => ({ label: m.label, value: m.id })),
])

const statusFilterOptions = [
  { label: '全部状态', value: 'all' },
  { label: '已启用', value: 'enabled' },
  { label: '已停用', value: 'disabled' },
] as const

const sortOptions = [
  { label: '最近更新', value: 'updated' },
  { label: '最近创建', value: 'created' },
  { label: '名称排序', value: 'name' },
  { label: '对局次数', value: 'matches' },
  { label: '等级优先', value: 'level' },
] as const

function modelName(modelId: string) {
  return resolveModelInfo(modelId).label
}

function starRating(char: Character): number {
  return computeStarRating(formatExpProgress(char).level)
}

function agentSummary(char: Character): string | null {
  const memories = char.agentMemories?.length || 0
  const skills = char.agentSkills?.filter((s) => s.enabled).length || 0
  if (!memories && !skills) return null
  const parts: string[] = []
  if (memories) parts.push(`${memories} 记忆`)
  if (skills) parts.push(`${skills} 技能`)
  return parts.join(' · ')
}

function cardSubtitle(char: Character): string {
  return char.subtitle || char.tags[0] || modelName(char.modelId)
}

function openCharacter(char: Character) {
  touchRecentCharacter(char.id)
  prefsVersion.value += 1
  navigate(`/character-detail/${char.id}`)
}

function openChat(char: Character) {
  touchRecentCharacter(char.id)
  prefsVersion.value += 1
  chatCharacter.value = char
  chatOpen.value = true
}

function onChatUpdated(updated: Character) {
  allCharacters.value = allCharacters.value.map((item) => (item.id === updated.id ? updated : item))
  if (chatCharacter.value?.id === updated.id) chatCharacter.value = updated
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

async function loadLineups() {
  lineupLoading.value = true
  lineupError.value = ''
  try {
    await lineupService.ensureDefault()
    ;[lineups.value, activeLineupId.value] = await Promise.all([
      lineupService.list(),
      lineupService.getActiveId(),
    ])
    if (!activeLineupId.value && lineups.value.length) activeLineupId.value = lineups.value[0].id
  } catch (err) {
    lineupError.value = formatUserMessage(err)
  } finally {
    lineupLoading.value = false
  }
}

function openCreateLineup() {
  editingLineup.value = null
  lineupEditOpen.value = true
}

function openLineupEdit(lineup: CharacterLineup) {
  editingLineup.value = lineup
  lineupEditOpen.value = true
}

async function onLineupSaved(saved: CharacterLineup) {
  const exists = lineups.value.some((item) => item.id === saved.id)
  lineups.value = exists
    ? lineups.value.map((item) => (item.id === saved.id ? saved : item))
    : [...lineups.value, saved]
  if (!activeLineupId.value) {
    activeLineupId.value = saved.id
    await lineupService.setActiveId(saved.id)
  }
}

async function onLineupDeleted(id: string) {
  lineups.value = lineups.value.filter((item) => item.id !== id)
  if (activeLineupId.value === id) {
    activeLineupId.value = lineups.value[0]?.id ?? null
    await lineupService.setActiveId(activeLineupId.value)
  }
}

watch([modelFilter, statusFilter], () => {
  void loadCharacters()
})

onMounted(() => {
  void loadCharacters()
  void loadLineups()
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

function selectSidebarCategory(id: CharacterLibraryCategory) {
  sidebarView.value = 'library'
  sidebarCategory.value = id
}

function openLineupView() {
  sidebarView.value = 'lineup'
  if (!lineups.value.length) void loadLineups()
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

const pageLoading = computed(() => (sidebarView.value === 'lineup' ? lineupLoading.value : loading.value))
const pageError = computed(() => (sidebarView.value === 'lineup' ? lineupError.value : error.value))
const pageEmpty = computed(() => {
  if (sidebarView.value === 'lineup') {
    return !lineupLoading.value && !lineupError.value && !filteredLineups.value.length
  }
  return !loading.value && !error.value && !filteredCharacters.value.length
})

const searchPlaceholder = computed(() =>
  sidebarView.value === 'lineup' ? '搜索阵容名称或成员...' : '搜索角色、标签或设定...'
)
</script>

<template>
  <ArenaPageShell class="characters-page" flow-scroll>
    <div class="characters-layout list-flow-layout">
      <aside class="characters-sidebar list-flow-layout__sidebar" aria-label="角色筛选">
        <label class="sidebar-search">
          <Search :size="16" />
          <input v-model="query" type="text" :placeholder="searchPlaceholder" />
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

          <div class="sidebar-nav__divider" />

          <button
            type="button"
            class="sidebar-nav__item sidebar-nav__item--lineup"
            :class="{ active: sidebarView === 'lineup' }"
            @click="openLineupView"
          >
            <LayoutGrid :size="16" />
            <span>全部阵容</span>
            <em>{{ lineups.length }}</em>
          </button>
        </nav>
      </aside>

      <section class="characters-main list-flow-layout__main">
        <header class="characters-toolbar list-flow-layout__toolbar">
          <div class="toolbar-filters">
            <SlidersHorizontal :size="16" />
            <ArenaSelect v-model="modelFilter" :options="modelFilterOptions" aria-label="模型筛选" />
            <ArenaSelect v-model="statusFilter" :options="[...statusFilterOptions]" aria-label="状态筛选" />
            <ArenaSelect v-model="sortBy" :options="[...sortOptions]" aria-label="排序方式" />
          </div>

          <div class="toolbar-actions">
            <template v-if="sidebarView === 'library'">
              <button class="toolbar-btn toolbar-btn--ghost" type="button" :disabled="importing" @click="importCharacter">
                <Upload :size="16" />
                导入
              </button>
              <button class="toolbar-btn" type="button" @click="openCreate">
                <Plus :size="16" />
                新建角色
              </button>
            </template>
            <button v-else type="button" class="toolbar-btn" @click="openCreateLineup">
              <Plus :size="16" />
              新建阵容
            </button>
          </div>
        </header>

        <div class="list-flow-layout__scroll">
        <ArenaPageState
          :loading="pageLoading"
          :error="pageError || undefined"
          :empty="pageEmpty"
          skeleton="grid-cards"
          :loading-label="sidebarView === 'lineup' ? '正在整理阵容库...' : '正在整理角色库...'"
          @retry="sidebarView === 'lineup' ? loadLineups() : loadCharacters()"
        >
          <template #empty>
            <template v-if="sidebarView === 'lineup'">
              <strong>还没有符合条件的阵容</strong>
              <span>新建一个阵容，把常一起上场的角色编进来。</span>
              <button type="button" @click="openCreateLineup">新建阵容</button>
            </template>
            <template v-else>
              <strong>还没有符合条件的角色</strong>
              <span>新建一个 AI 伙伴，或者放宽筛选条件。</span>
              <button type="button" @click="openCreate">新建角色</button>
            </template>
          </template>

          <div v-if="sidebarView === 'library'" class="characters-grid" aria-label="角色列表">
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
              </div>
              <div class="library-card__body">
                <div class="library-card__head">
                  <h3>{{ char.name }}</h3>
                  <button
                    type="button"
                    class="library-card__chat"
                    aria-label="与角色对话"
                    title="与角色对话"
                    @click.stop="openChat(char)"
                  >
                    <MessageCircle :size="17" />
                  </button>
                </div>
                <p>{{ cardSubtitle(char) }}</p>
                <div class="library-card__stars" :aria-label="`${starRating(char)} 星成熟度`">
                  <Star v-for="index in 7" :key="index" :size="10" :class="{ on: index <= starRating(char) }" />
                  <span>Lv.{{ formatExpProgress(char).level }}</span>
                </div>
                <p v-if="agentSummary(char)" class="library-card__agent">{{ agentSummary(char) }}</p>
              </div>
            </article>
          </div>

          <div v-else class="characters-grid" aria-label="阵容列表">
            <article
              v-for="lineup in filteredLineups"
              :key="lineup.id"
              class="library-card lineup-list-card"
              @click="openLineupEdit(lineup)"
            >
              <div class="library-card__banner">
                <img v-if="lineupCardBanner(lineup)" :src="lineupCardBanner(lineup)" :alt="lineup.name" />
                <div v-else class="lineup-list-card__placeholder" />
                <span
                  class="library-card__status"
                  :class="{ 'library-card__status--active': lineup.id === activeLineupId }"
                >
                  {{ lineup.id === activeLineupId ? '当前' : `${lineup.characterIds.length} 人` }}
                </span>
              </div>
              <div class="library-card__body">
                <div class="library-card__head">
                  <h3>{{ lineup.name }}</h3>
                </div>
                <p>{{ lineupCardSubtitle(lineup) }}</p>
                <div class="library-card__stars" :aria-label="`胜率 ${lineupWinRateText(lineup)}`">
                  <span>{{ lineup.stats.matchCount }} 对局</span>
                  <span>·</span>
                  <span>胜率 {{ lineupWinRateText(lineup) }}</span>
                </div>
              </div>
            </article>
          </div>
        </ArenaPageState>
        </div>
      </section>
    </div>

    <CharacterEditDialog v-model="createOpen" section="create" @saved="onCharacterCreated" />
    <LineupEditDialog
      v-model="lineupEditOpen"
      :lineup="editingLineup"
      :characters="allCharacters"
      @saved="onLineupSaved"
      @deleted="onLineupDeleted"
    />
    <CharacterChatDialog
      v-if="chatCharacter && chatOpen"
      v-model="chatOpen"
      :character="chatCharacter"
      @updated="onChatUpdated"
    />
  </ArenaPageShell>
</template>

<style scoped>
.characters-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 12px 24px 16px;
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
  position: relative;
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

.library-card__status--active {
  color: #5b57f3;
}

.lineup-list-card__placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, rgba(112, 105, 255, 0.18), rgba(130, 142, 207, 0.08));
}

.lineup-list-card .library-card__stars {
  gap: 6px;
  color: #9aa3c7;
  font-size: 11px;
  font-weight: 600;
}

.library-card__body {
  display: grid;
  gap: 4px;
  padding: 12px 14px 14px;
}

.library-card__head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.library-card__head h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: #17205a;
  font-size: 16px;
  font-weight: 650;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-card__chat {
  flex-shrink: 0;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: rgba(91, 87, 243, 0.08);
  color: #5b57f3;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, transform 0.2s ease;
}

.library-card__chat:hover {
  background: rgba(91, 87, 243, 0.16);
  transform: scale(1.05);
}

.library-card__body p {
  margin: 0;
  overflow: hidden;
  color: #66709d;
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.library-card__stars {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 2px;
  color: rgba(130, 142, 207, 0.35);
}

.library-card__stars :deep(svg.on) {
  color: #e8b923;
  fill: rgba(232, 185, 35, 0.25);
}

.library-card__stars span {
  margin-left: 4px;
  color: #9aa3c7;
  font-size: 11px;
  font-weight: 600;
}

.library-card__agent {
  margin: 6px 0 0;
  font-size: 11px;
  color: #5b57f3;
}

@media (max-width: 980px) {
  .characters-layout {
    grid-template-columns: 1fr;
  }
}
</style>
