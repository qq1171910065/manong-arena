<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { Plus, Search, SlidersHorizontal } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterQuickMenu from '@renderer/components/arena/CharacterQuickMenu.vue'
import { characterAvatarByName, characterPortraitByName } from '@renderer/data/arena-visual-assets'
import { navigate } from '@renderer/router'
import { characterService, formatUserMessage } from '@renderer/services/arena'
import { CHARACTER_MODEL_OPTIONS } from '@shared/arena/constants'
import type { Character, CharacterStatus } from '@shared/arena/types'

const characters = ref<Character[]>([])
const loading = ref(true)
const error = ref('')
const query = ref('')
const modelFilter = ref('all')
const statusFilter = ref<CharacterStatus | 'all'>('all')
const sortBy = ref<'updated' | 'created' | 'name' | 'matches'>('updated')

function modelName(modelId: string) {
  return CHARACTER_MODEL_OPTIONS.find((item) => item.id === modelId)?.label || modelId
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
})

async function toggleCharacterStatus(char: Character) {
  try {
    await characterService.toggleStatus(char.id)
    await loadCharacters()
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function duplicateCharacter(char: Character) {
  try {
    const copy = await characterService.duplicate(char.id)
    navigate(`/character-detail/${copy.id}`)
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}

async function removeCharacter(char: Character) {
  if (!window.confirm(`确定删除角色「${char.name}」吗？此操作不可恢复。`)) return
  try {
    await characterService.remove(char.id)
    await loadCharacters()
  } catch (err) {
    error.value = formatUserMessage(err)
  }
}
</script>

<template>
  <ArenaPageShell class="characters-page">
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
        <button class="toolbar-action" type="button" @click="navigate('/character-edit/new')">
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
      <template #empty>
        <strong>还没有符合条件的角色</strong>
        <span>新建一个 AI 伙伴，或者放宽筛选条件。</span>
        <button type="button" @click="navigate('/character-edit/new')">新建角色</button>
      </template>

      <section class="character-grid arena-stagger" aria-label="角色列表">
      <article
        v-for="(char, index) in characters"
        :key="char.id"
        class="library-card"
        :class="{ disabled: char.status !== 'enabled' }"
        :style="{ '--accent': char.accentColor }"
        @click="navigate(`/character-detail/${char.id}`)"
      >
        <div class="card-visual">
          <div class="visual-bg" aria-hidden="true" />
          <img
            class="portrait"
            :src="characterPortraitByName(char.name, index, char.modelId, char.portraitUrl)"
            :alt="char.name"
          />
          <div class="visual-scrim" aria-hidden="true" />
          <img
            class="avatar"
            :src="characterAvatarByName(char.name, index, char.modelId, char.avatarUrl)"
            :alt="`${char.name}头像`"
          />
          <span class="status-badge" :class="{ off: char.status !== 'enabled' }">
            <i aria-hidden="true" />
            {{ char.status === 'enabled' ? '在线' : '停用' }}
          </span>
          <CharacterQuickMenu
            class="card-menu"
            compact
            :status="char.status"
            @click.stop
            @edit="navigate(`/character-edit/${char.id}`)"
            @duplicate="duplicateCharacter(char)"
            @toggle-status="toggleCharacterStatus(char)"
            @remove="removeCharacter(char)"
          />
        </div>
        <div class="card-body">
          <h2>{{ char.name }}</h2>
          <p class="subtitle">{{ char.subtitle || '未填写一句话设定' }}</p>
          <div class="meta-row">
            <span class="model-chip">{{ modelName(char.modelId) }}</span>
            <span v-for="tag in char.tags.slice(0, 2)" :key="tag" class="tag">{{ tag }}</span>
          </div>
          <div class="stats-row">
            <span>{{ char.stats.matchCount }} 场对局</span>
            <span class="sep" aria-hidden="true">·</span>
            <span class="speech">{{ char.speechStyle }}</span>
          </div>
        </div>
      </article>
      </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.characters-page :deep(.aa-page-inner) {
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
  min-height: 0;
  overflow: auto;
  display: grid;
  grid-template-columns: repeat(4, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
  padding: 2px 4px 10px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.character-grid::-webkit-scrollbar {
  display: none;
}

.library-card {
  --accent: #7568ff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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

.library-card:hover {
  transform: translateY(-6px);
  border-color: color-mix(in srgb, var(--accent) 36%, white);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.94),
    0 22px 42px rgba(91, 101, 174, 0.16);
}

.library-card.disabled {
  opacity: 0.62;
  filter: saturate(0.72);
}

.library-card.disabled:hover {
  transform: translateY(-3px);
}

.card-visual {
  position: relative;
  height: 168px;
  margin: 10px 10px 0;
  overflow: hidden;
  border-radius: 14px;
}

.visual-bg {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 22% 18%, rgba(255, 255, 255, 0.42), transparent 42%),
    linear-gradient(160deg, color-mix(in srgb, var(--accent) 28%, white), color-mix(in srgb, var(--accent) 10%, #f4f6ff));
}

.portrait {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center bottom;
  transform: scale(1.06) translateY(6px);
  transition: transform 0.4s ease, filter 0.3s ease;
}

.library-card:hover .portrait {
  transform: scale(1.1) translateY(2px);
  filter: saturate(1.06);
}

.visual-scrim {
  position: absolute;
  inset: auto 0 0;
  z-index: 2;
  height: 56%;
  background: linear-gradient(to top, rgba(18, 24, 58, 0.28), transparent);
  pointer-events: none;
}

.avatar {
  position: absolute;
  left: 12px;
  bottom: 10px;
  z-index: 3;
  width: 44px;
  height: 44px;
  border: 2px solid rgba(255, 255, 255, 0.92);
  border-radius: 14px;
  object-fit: cover;
  box-shadow: 0 8px 18px rgba(34, 42, 88, 0.22);
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

.card-menu {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 4;
}

.card-menu :deep(.char-menu__trigger) {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(10px);
  color: #455180;
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease, background 0.2s ease;
}

.library-card:hover .card-menu :deep(.char-menu__trigger),
.card-menu :deep(.char-menu__trigger:focus-visible) {
  opacity: 1;
  transform: translateY(0);
}

.card-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding: 12px 16px 16px;
}

.card-body h2 {
  margin: 0;
  color: #17205a;
  font-size: 18px;
  font-weight: 650;
  line-height: 1.2;
}

.subtitle {
  overflow: hidden;
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.45;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 2px;
}

.model-chip {
  display: inline-flex;
  align-items: center;
  height: 26px;
  padding: 0 10px;
  color: color-mix(in srgb, var(--accent) 78%, #26305e);
  border-radius: 8px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  font-size: 12px;
  font-weight: 600;
}

.meta-row .tag {
  display: inline-flex;
  align-items: center;
  height: 26px;
  max-width: 88px;
  padding: 0 10px;
  overflow: hidden;
  color: #655df0;
  border: 1px solid rgba(109, 101, 255, 0.12);
  border-radius: 8px;
  background: rgba(112, 105, 255, 0.08);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 2px;
  color: #7b84ad;
  font-size: 12px;
}

.stats-row .sep {
  color: #b4bbda;
}

.stats-row .speech {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
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
