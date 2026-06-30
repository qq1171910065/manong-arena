<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { characterAvatarUrl } from '@renderer/data/arena-visual-assets'
import { characterService, lineupService } from '@renderer/services/arena'
import type { Character, CharacterLineup } from '@shared/arena/types'

const props = defineProps<{ character: Character }>()

const lineups = ref<CharacterLineup[]>([])
const activeLineupId = ref<string | null>(null)
const allCharacters = ref<Character[]>([])
const loading = ref(true)

const relatedLineups = computed(() =>
  lineups.value.filter((lineup) => lineup.characterIds.includes(props.character.id))
)

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

function lineupMemberSubtitle(lineup: CharacterLineup): string {
  const members = lineupMembers(lineup).filter((item) => item.id !== props.character.id)
  if (!members.length) return '仅本角色'
  const names = members.slice(0, 3).map((item) => item.name).join('、')
  return members.length > 3 ? `与 ${names}… 同队` : `与 ${names} 同队`
}

onMounted(async () => {
  loading.value = true
  try {
    ;[lineups.value, activeLineupId.value, allCharacters.value] = await Promise.all([
      lineupService.list(),
      lineupService.getActiveId(),
      characterService.list(),
    ])
  } catch {
    lineups.value = []
    activeLineupId.value = null
    allCharacters.value = []
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="character-lineup-preview">
    <p v-if="loading" class="character-lineup-preview__loading">加载阵容中…</p>
    <div v-else-if="relatedLineups.length" class="character-lineup-preview__list">
      <article
        v-for="lineup in relatedLineups"
        :key="lineup.id"
        class="character-lineup-preview__card"
      >
        <div class="character-lineup-preview__head">
          <strong>{{ lineup.name }}</strong>
          <span
            class="character-lineup-preview__badge"
            :class="{ 'character-lineup-preview__badge--active': lineup.id === activeLineupId }"
          >
            {{ lineup.id === activeLineupId ? '当前阵容' : `${lineup.characterIds.length} 人` }}
          </span>
        </div>
        <p class="character-lineup-preview__subtitle">{{ lineupMemberSubtitle(lineup) }}</p>
        <div class="character-lineup-preview__avatars" aria-hidden="true">
          <img
            v-for="member in lineupMembers(lineup).slice(0, 6)"
            :key="member.id"
            :src="characterAvatarUrl(member)"
            :alt="member.name"
            :title="member.name"
          />
        </div>
        <div class="character-lineup-preview__stats">
          <span>{{ lineup.stats.matchCount }} 对局</span>
          <span>·</span>
          <span>胜率 {{ lineupWinRateText(lineup) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.character-lineup-preview {
  min-height: 72px;
}

.character-lineup-preview__loading {
  margin: 0;
  padding: 16px 0;
  color: #9aa3c7;
  font-size: 12px;
  text-align: center;
}

.character-lineup-preview__list {
  display: grid;
  gap: 10px;
}

.character-lineup-preview__card {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(130, 142, 207, 0.1);
}

.character-lineup-preview__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.character-lineup-preview__head strong {
  color: #17205a;
  font-size: 14px;
  font-weight: 650;
}

.character-lineup-preview__badge {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.1);
  color: #66709d;
  font-size: 10px;
  font-weight: 650;
}

.character-lineup-preview__badge--active {
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
}

.character-lineup-preview__subtitle {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.5;
}

.character-lineup-preview__avatars {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.character-lineup-preview__avatars img {
  width: 28px;
  height: 28px;
  border-radius: 9px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.88);
  box-shadow: 0 2px 6px rgba(34, 42, 88, 0.08);
}

.character-lineup-preview__stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
  color: #9aa3c7;
  font-size: 11px;
}
</style>
