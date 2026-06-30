<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Award, Image, Search, Sparkles, Tag } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import {
  listAchievementCatalog,
  listCollectionCategories,
  listPersonalityCatalog,
  listSkillCatalog,
  loadAssetPackCatalog,
  loadCollectionAggregateStats,
} from '@renderer/services/arena/collection-catalog-service'
import type { CollectionCategoryId } from '@shared/arena/builtin-collection'
import type { CharacterAssetPackOption } from '@renderer/data/character-asset-catalog'

const loading = ref(true)
const error = ref('')
const query = ref('')
const activeCategory = ref<CollectionCategoryId>('achievements')
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
  skills: Sparkles,
  personalities: Tag,
}

const achievements = computed(() => listAchievementCatalog(stats.value))
const skills = computed(() => listSkillCatalog())
const personalities = computed(() => listPersonalityCatalog())

const unlockedCount = computed(() => achievements.value.filter((item) => item.unlocked).length)

const filteredAchievements = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return achievements.value
  return achievements.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q)
  )
})

const filteredAssetPacks = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return assetPacks.value
  return assetPacks.value.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.characterId.toLowerCase().includes(q) ||
      (item.palette || '').toLowerCase().includes(q)
  )
})

const filteredSkills = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return skills.value
  return skills.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.attributeLabel.toLowerCase().includes(q)
  )
})

const filteredPersonalities = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return personalities.value
  return personalities.value.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.kind === 'tag' ? '标签' : '说话风格').includes(q)
  )
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
  <ArenaPageShell class="collection-page" viewport-lock>
    <div class="collection-layout">
      <aside class="collection-sidebar" aria-label="收藏分类">
        <label class="sidebar-search">
          <Search :size="16" />
          <input v-model="query" type="text" placeholder="搜索成就、素材、技能..." />
        </label>

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

        <p v-if="activeCategory === 'achievements'" class="sidebar-note">
          已解锁 {{ unlockedCount }}/{{ achievements.length }}
        </p>
      </aside>

      <section class="collection-main">
        <header class="collection-header">
          <div>
            <h2>{{ categories.find((item) => item.id === activeCategory)?.label }}</h2>
            <p>{{ categories.find((item) => item.id === activeCategory)?.description }}</p>
          </div>
        </header>

        <ArenaPageState
          :loading="loading"
          :error="error || undefined"
          :empty="false"
          loading-label="正在整理收藏目录..."
          @retry="loadPage"
        >
          <div v-if="activeCategory === 'achievements'" class="collection-grid">
            <article
              v-for="item in filteredAchievements"
              :key="item.id"
              class="collection-card"
              :class="{ unlocked: item.unlocked }"
            >
              <span class="collection-card__badge">{{ item.unlocked ? '已解锁' : '未解锁' }}</span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.description }}</p>
              <em>{{ item.group }}</em>
            </article>
          </div>

          <div v-else-if="activeCategory === 'asset-packs'" class="collection-grid collection-grid--media">
            <article v-for="item in filteredAssetPacks" :key="item.characterId" class="collection-card collection-card--media">
              <div class="collection-card__preview">
                <img :src="item.previewBannerUrl || item.previewPortraitUrl" :alt="item.label" />
              </div>
              <strong>{{ item.label }}</strong>
              <p>{{ item.palette || item.characterId }}</p>
              <em>内置素材包</em>
            </article>
          </div>

          <div v-else-if="activeCategory === 'skills'" class="collection-grid">
            <article v-for="item in filteredSkills" :key="item.id" class="collection-card">
              <span class="collection-card__badge collection-card__badge--soft">专属技能</span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.description }}</p>
              <em>{{ item.attributeLabel }}</em>
            </article>
          </div>

          <div v-else class="collection-grid">
            <article v-for="item in filteredPersonalities" :key="item.id" class="collection-card">
              <span class="collection-card__badge collection-card__badge--soft">
                {{ item.kind === 'tag' ? '性格标签' : '说话风格' }}
              </span>
              <strong>{{ item.name }}</strong>
              <p>{{ item.description }}</p>
            </article>
          </div>
        </ArenaPageState>
      </section>
    </div>
  </ArenaPageShell>
</template>

<style scoped>
.collection-page :deep(.aa-page-inner) {
  max-width: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 20px 24px 16px;
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

.sidebar-note {
  margin: 0;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(112, 105, 255, 0.08);
  color: #66709d;
  font-size: 12px;
}

.collection-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  min-height: 0;
}

.collection-page :deep(.arena-page-state) {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.collection-page :deep(.arena-page-state__content) {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
}

.collection-header h2 {
  margin: 0;
  color: #17205a;
  font-size: 22px;
  font-weight: 700;
}

.collection-header p {
  margin: 4px 0 0;
  color: #66709d;
  font-size: 13px;
}

.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
  padding: 2px 4px 12px;
}

.collection-grid--media {
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}

.collection-card {
  display: grid;
  gap: 8px;
  padding: 14px;
  border-radius: 16px;
  background: #fff;
  border: 1px solid rgba(130, 142, 207, 0.16);
  box-shadow: 0 8px 20px rgba(91, 101, 174, 0.08);
}

.collection-card.unlocked {
  border-color: rgba(91, 87, 243, 0.28);
  background: linear-gradient(180deg, rgba(112, 105, 255, 0.06), #fff 42%);
}

.collection-card strong {
  color: #17205a;
  font-size: 15px;
  line-height: 1.3;
}

.collection-card p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.45;
}

.collection-card em {
  color: #9aa3c7;
  font-style: normal;
  font-size: 11px;
}

.collection-card__badge {
  justify-self: start;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.12);
  color: #7380aa;
  font-size: 11px;
  font-weight: 600;
}

.collection-card.unlocked .collection-card__badge {
  background: rgba(91, 87, 243, 0.12);
  color: #5b57f3;
}

.collection-card__badge--soft {
  background: rgba(112, 105, 255, 0.1);
  color: #6b66e8;
}

.collection-card__preview {
  aspect-ratio: 16 / 10;
  overflow: hidden;
  border-radius: 12px;
  background: #eef1f8;
}

.collection-card__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@media (max-width: 980px) {
  .collection-layout {
    grid-template-columns: 1fr;
  }
}
</style>
