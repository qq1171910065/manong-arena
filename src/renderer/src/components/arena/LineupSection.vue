<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pencil, Plus, X } from 'lucide-vue-next'
import { characterAvatarUrl, characterPortraitUrl } from '@renderer/data/arena-visual-assets'
import { navigate } from '@renderer/router'
import { formatUserMessage, lineupService } from '@renderer/services/arena'
import { LINEUP_MAX_SIZE, resolveCharacterGrowth } from '@shared/arena/character-growth'
import type { Character, CharacterLineup, LineupGrowthRecord } from '@shared/arena/types'

const props = defineProps<{
  characters: Character[]
}>()

const lineups = ref<CharacterLineup[]>([])
const activeLineupId = ref<string | null>(null)
const growthRecords = ref<LineupGrowthRecord[]>([])
const loading = ref(true)
const editing = ref(false)
const pickerOpen = ref(false)
const error = ref('')

const activeLineup = computed(() => lineups.value.find((item) => item.id === activeLineupId.value) || lineups.value[0] || null)

const lineupCharacters = computed(() => {
  if (!activeLineup.value) return []
  return activeLineup.value.characterIds
    .map((id) => props.characters.find((item) => item.id === id))
    .filter(Boolean) as Character[]
})

const availableCharacters = computed(() => {
  const used = new Set(activeLineup.value?.characterIds || [])
  return props.characters.filter((item) => !used.has(item.id))
})

const winRate = computed(() => {
  const count = activeLineup.value?.stats.matchCount || 0
  if (!count) return '—'
  return `${Math.round(((activeLineup.value?.stats.winCount || 0) / count) * 100)}%`
})

async function loadLineups() {
  loading.value = true
  error.value = ''
  try {
    await lineupService.ensureDefault()
    ;[lineups.value, activeLineupId.value] = await Promise.all([
      lineupService.list(),
      lineupService.getActiveId(),
    ])
    if (!activeLineupId.value && lineups.value.length) activeLineupId.value = lineups.value[0].id
    if (activeLineup.value) growthRecords.value = await lineupService.listGrowth(activeLineup.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function persistLineup(nextIds: string[]) {
  if (!activeLineup.value) return
  const saved = await lineupService.save({ ...activeLineup.value, characterIds: nextIds })
  lineups.value = lineups.value.map((item) => (item.id === saved.id ? saved : item))
  growthRecords.value = await lineupService.listGrowth(saved.id)
}

async function addCharacter(id: string) {
  if (!activeLineup.value || activeLineup.value.characterIds.length >= LINEUP_MAX_SIZE) return
  await persistLineup([...activeLineup.value.characterIds, id])
  pickerOpen.value = false
}

async function removeCharacter(id: string) {
  if (!activeLineup.value) return
  await persistLineup(activeLineup.value.characterIds.filter((item) => item !== id))
}

watch(() => props.characters.length, () => {
  if (!loading.value) void loadLineups()
})

void loadLineups()
</script>

<template>
  <section class="lineup-section">
    <header class="lineup-section__head">
      <div>
        <h2>{{ activeLineup?.name || '我的阵容' }}</h2>
        <p>最多 {{ LINEUP_MAX_SIZE }} 人 · 全员参战的对局会计入阵容战绩</p>
      </div>
      <button type="button" class="lineup-section__edit" @click="editing = !editing">
        <Pencil :size="15" />
        {{ editing ? '完成编辑' : '编辑阵容' }}
      </button>
    </header>

    <p v-if="error" class="lineup-section__error">{{ error }}</p>
    <p v-else-if="loading" class="lineup-section__hint">加载阵容中…</p>

    <div v-else class="lineup-section__body">
      <div class="lineup-section__row">
        <div class="lineup-section__members">
          <article
            v-for="char in lineupCharacters"
            :key="char.id"
            class="lineup-card"
            @click="navigate(`/character-detail/${char.id}`)"
          >
            <img class="lineup-card__portrait" :src="characterPortraitUrl(char)" :alt="char.name" />
            <div class="lineup-card__meta">
              <strong>{{ char.name }}</strong>
              <span>Lv.{{ resolveCharacterGrowth(char).level }}</span>
            </div>
            <button
              v-if="editing"
              type="button"
              class="lineup-card__remove"
              aria-label="移出阵容"
              @click.stop="removeCharacter(char.id)"
            >
              <X :size="14" />
            </button>
          </article>

          <button
            v-if="editing && (activeLineup?.characterIds.length || 0) < LINEUP_MAX_SIZE"
            type="button"
            class="lineup-card lineup-card--add"
            @click="pickerOpen = !pickerOpen"
          >
            <Plus :size="22" />
            <span>加入角色</span>
          </button>
        </div>

        <aside class="lineup-section__stats">
          <div class="lineup-stat"><strong>{{ activeLineup?.characterIds.length || 0 }}</strong><span>成员</span></div>
          <div class="lineup-stat"><strong>{{ activeLineup?.stats.matchCount || 0 }}</strong><span>对局</span></div>
          <div class="lineup-stat"><strong>{{ activeLineup?.stats.winCount || 0 }}</strong><span>胜场</span></div>
          <div class="lineup-stat"><strong>{{ winRate }}</strong><span>胜率</span></div>
        </aside>
      </div>

      <div v-if="pickerOpen" class="lineup-picker">
        <button
          v-for="char in availableCharacters"
          :key="char.id"
          type="button"
          class="lineup-picker__item"
          @click="addCharacter(char.id)"
        >
          <img :src="characterAvatarUrl(char)" :alt="char.name" />
          <span>{{ char.name }}</span>
          <em>Lv.{{ resolveCharacterGrowth(char).level }}</em>
        </button>
        <p v-if="!availableCharacters.length" class="lineup-section__hint">没有可加入的角色</p>
      </div>

      <section class="lineup-log">
        <h3>组队记录</h3>
        <div v-if="growthRecords.length" class="lineup-log__list">
          <article v-for="item in growthRecords" :key="item.id" :class="{ won: item.won }">
            <strong>{{ item.gameModeName }}</strong>
            <p>{{ item.summary }}</p>
            <time>{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</time>
          </article>
        </div>
        <p v-else class="lineup-section__hint">把常一起上场的角色编进阵容，全员参战后会在这里留下记录。</p>
      </section>
    </div>
  </section>
</template>

<style scoped>
.lineup-section {
  display: grid;
  gap: 14px;
  min-height: 0;
}

.lineup-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.lineup-section__head h2 {
  margin: 0;
  color: #17205a;
  font-size: 18px;
}

.lineup-section__head p {
  margin: 4px 0 0;
  color: #9aa3c7;
  font-size: 12px;
}

.lineup-section__edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 0;
  border-radius: 999px;
  padding: 8px 14px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.lineup-section__body {
  display: grid;
  gap: 14px;
}

.lineup-section__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 14px;
}

.lineup-section__members {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.lineup-card {
  position: relative;
  width: 108px;
  padding: 8px;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.lineup-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(91, 101, 174, 0.12);
}

.lineup-card__portrait {
  width: 100%;
  aspect-ratio: 3 / 4;
  object-fit: cover;
  object-position: center top;
  border-radius: 12px;
  background: #eef1f8;
}

.lineup-card__meta {
  display: grid;
  gap: 2px;
  margin-top: 8px;
}

.lineup-card__meta strong {
  overflow: hidden;
  color: #17205a;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lineup-card__meta span {
  color: #9aa3c7;
  font-size: 10px;
}

.lineup-card--add {
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 168px;
  border-style: dashed;
  color: #7b61ff;
  background: rgba(255, 255, 255, 0.42);
}

.lineup-card--add span {
  font-size: 11px;
}

.lineup-card__remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: #ef6a8a;
  color: #fff;
  cursor: pointer;
}

.lineup-section__stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  align-content: start;
}

.lineup-stat {
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 12px 8px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.08);
}

.lineup-stat strong {
  color: #17205a;
  font-size: 18px;
}

.lineup-stat span {
  color: #7b84ad;
  font-size: 11px;
}

.lineup-picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 8px;
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.55);
}

.lineup-picker__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.lineup-picker__item img {
  width: 32px;
  height: 32px;
  border-radius: 10px;
  object-fit: cover;
}

.lineup-picker__item em {
  color: #9aa3c7;
  font-size: 10px;
  font-style: normal;
}

.lineup-log h3 {
  margin: 0 0 10px;
  color: #17205a;
  font-size: 14px;
}

.lineup-log__list {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.lineup-log__list article {
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.55);
  border-left: 3px solid rgba(130, 142, 207, 0.22);
}

.lineup-log__list article.won {
  border-left-color: #18a765;
}

.lineup-log__list strong {
  color: #17205a;
  font-size: 13px;
}

.lineup-log__list p {
  margin: 4px 0;
  color: #59649b;
  font-size: 12px;
  line-height: 1.5;
}

.lineup-log__list time {
  color: #9aa3c7;
  font-size: 11px;
}

.lineup-section__hint,
.lineup-section__error {
  margin: 0;
  font-size: 12px;
}

.lineup-section__hint {
  color: #9aa3c7;
}

.lineup-section__error {
  color: #ef6a8a;
}

@media (max-width: 900px) {
  .lineup-section__row {
    grid-template-columns: 1fr;
  }
}
</style>
