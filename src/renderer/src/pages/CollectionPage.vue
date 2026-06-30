<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Award, Image, SlidersHorizontal, Sparkles, Tag } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CollectionAchievementCard from '@renderer/components/arena/collection/CollectionAchievementCard.vue'
import CollectionAssetPackCard from '@renderer/components/arena/collection/CollectionAssetPackCard.vue'
import CollectionPersonalityCard from '@renderer/components/arena/collection/CollectionPersonalityCard.vue'
import CollectionTalentCard from '@renderer/components/arena/collection/CollectionTalentCard.vue'
import ArenaSelect from '@renderer/components/common/ArenaSelect.vue'
import {
  listAchievementCatalog,
  listCollectionCategories,
  listPersonalityCatalog,
  listTalentCatalog,
  loadAssetPackCatalog,
  loadCollectionAggregateStats,
} from '@renderer/services/arena/collection-catalog-service'
import type { CollectionCategoryId } from '@shared/arena/builtin-collection'
import type { CharacterAssetPackOption } from '@renderer/data/character-asset-catalog'

const loading = ref(true)
const error = ref('')
const activeCategory = ref<CollectionCategoryId>('achievements')
const sortBy = ref<'default' | 'name-asc' | 'name-desc'>('default')
const personalityKind = ref<'all' | 'tag' | 'speech-style'>('all')
const stats = ref({
  characterCount: 0,
  maxLevel: 0,
  totalMatches: 0,
  totalWins: 0,
  totalChatMessages: 0,
})
const assetPacks = ref<CharacterAssetPackOption[]>([])

const categories = listCollectionCategories()

const categoryIcons: Record<CollectionCategoryId, typeof Award> = {
  achievements: Award,
  'asset-packs': Image,
  talents: Sparkles,
  personalities: Tag,
}

const achievements = computed(() => listAchievementCatalog(stats.value))
const talents = computed(() => listTalentCatalog())
const personalities = computed(() => listPersonalityCatalog())

const sortOptions = [
  { label: '默认排序', value: 'default' },
  { label: '名称 A-Z', value: 'name-asc' },
  { label: '名称 Z-A', value: 'name-desc' },
] as const

const personalityKindOptions = [
  { label: '全部类型', value: 'all' },
  { label: '性格标签', value: 'tag' },
  { label: '说话风格', value: 'speech-style' },
] as const

function sortByName<T extends { name: string }>(items: T[]): T[] {
  const list = [...items]
  if (sortBy.value === 'name-asc') return list.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  if (sortBy.value === 'name-desc') return list.sort((a, b) => b.name.localeCompare(a.name, 'zh-CN'))
  return list
}

const filteredAchievements = computed(() => sortByName(achievements.value))

const filteredAssetPacks = computed(() => {
  let list = [...assetPacks.value]
  if (sortBy.value === 'name-asc') return list.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
  if (sortBy.value === 'name-desc') return list.sort((a, b) => b.label.localeCompare(a.label, 'zh-CN'))
  return list
})

const filteredTalents = computed(() => sortByName(talents.value))

const filteredPersonalities = computed(() => {
  let list = personalities.value
  if (personalityKind.value === 'tag') list = list.filter((item) => item.kind === 'tag')
  if (personalityKind.value === 'speech-style') list = list.filter((item) => item.kind === 'speech-style')
  return sortByName(list)
})

async function loadPage() {
  loading.value = true
  error.value = ''
  try {
    const [nextStats, packs] = await Promise.all([
      loadCollectionAggregateStats(),
      loadAssetPackCatalog(),
    ])
    stats.value = nextStats
    assetPacks.value = packs
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载收藏目录失败'
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadPage()
})
</script>

<template>
  <ArenaPageShell class="collection-page" flow-scroll>
    <div class="collection-layout list-flow-layout">
      <aside class="collection-sidebar list-flow-layout__sidebar" aria-label="收藏分类">
        <nav class="sidebar-nav">
          <button
            v-for="item in categories"
            :key="item.id"
            type="button"
            class="sidebar-nav__item"
            :class="{ active: activeCategory === item.id }"
            @click="activeCategory = item.id"
          >
            <component :is="categoryIcons[item.id]" :size="16" />
            <span>{{ item.label }}</span>
          </button>
        </nav>
      </aside>

      <section class="collection-main list-flow-layout__main">
        <header class="collection-toolbar list-flow-layout__toolbar">
          <div class="toolbar-filters">
            <SlidersHorizontal :size="16" />
            <ArenaSelect
              v-if="activeCategory === 'personalities'"
              v-model="personalityKind"
              :options="[...personalityKindOptions]"
              aria-label="性格类型"
            />
            <ArenaSelect v-model="sortBy" :options="[...sortOptions]" aria-label="排序方式" />
          </div>
        </header>

        <div class="list-flow-layout__scroll">
        <ArenaPageState
          :loading="loading"
          :error="error || undefined"
          :empty="false"
          loading-label="正在整理收藏目录..."
          @retry="loadPage"
        >
          <div v-if="activeCategory === 'achievements'" class="collection-grid collection-grid--achievements">
            <CollectionAchievementCard
              v-for="item in filteredAchievements"
              :key="item.id"
              :id="item.id"
              :name="item.name"
              :description="item.description"
              :group="item.group"
              :unlocked="item.unlocked"
              :icon-url="item.iconUrl"
            />
          </div>

          <div v-else-if="activeCategory === 'asset-packs'" class="collection-grid collection-grid--packs">
            <CollectionAssetPackCard
              v-for="item in filteredAssetPacks"
              :key="item.characterId"
              :character-id="item.characterId"
              :label="item.label"
              :palette="item.palette"
              :preview-banner-url="item.previewBannerUrl"
              :preview-portrait-url="item.previewPortraitUrl"
            />
          </div>

          <div v-else-if="activeCategory === 'talents'" class="collection-grid collection-grid--talents">
            <CollectionTalentCard
              v-for="item in filteredTalents"
              :key="item.id"
              :id="item.id"
              :name="item.name"
              :description="item.description"
              :trigger-timing="item.triggerTiming"
              :trigger-effect="item.triggerEffect"
              :match-effect="item.matchEffect"
              :attribute-id="item.attributeId"
              :attribute-label="item.attributeLabel"
              :icon-url="item.iconUrl"
            />
          </div>

          <div v-else class="collection-grid collection-grid--personalities">
            <CollectionPersonalityCard
              v-for="item in filteredPersonalities"
              :key="item.id"
              :id="item.id"
              :kind="item.kind"
              :name="item.name"
              :description="item.description"
              :icon-url="item.iconUrl"
            />
          </div>
        </ArenaPageState>
        </div>
      </section>
    </div>
  </ArenaPageShell>
</template>

<style scoped>
.collection-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  padding: 12px 24px 16px;
}

.collection-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  flex: 1 1 0;
  min-height: 0;
}

.collection-sidebar {
  display: grid;
  align-content: start;
  gap: 14px;
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  border: 1px solid rgba(130, 142, 207, 0.14);
}

.sidebar-nav {
  display: grid;
  gap: 6px;
}

.sidebar-nav__item {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
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

.sidebar-nav__item.active {
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-weight: 600;
}

.collection-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

.collection-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 12px;
}

.toolbar-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(130, 142, 207, 0.14);
  color: #66709d;
  flex-shrink: 0;
}

.collection-grid {
  display: grid;
  gap: 14px;
  padding: 2px 4px 12px;
}

.collection-grid--achievements {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.collection-grid--packs {
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
}

.collection-grid--talents {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.collection-grid--personalities {
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
}

@media (max-width: 980px) {
  .collection-layout {
    grid-template-columns: 1fr;
  }
}
</style>
