<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Copy, Edit3, Loader2, PlayCircle, Star, Trash2 } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { characterAvatarByName, characterPortraitByName, matchImageByModeId, modeBadges } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import { characterService, formatUserMessage, gameModeService, matchService, matchWindowService } from '@renderer/services/arena'
import { formatTimeLabel } from '@renderer/utils/id'
import type { Character, Match } from '@shared/arena/types'

const character = ref<Character | null>(null)
const recentMatches = ref<Match[]>([])
const loading = ref(true)
const error = ref('')
const saving = ref(false)

const characterId = computed(() => route.value.id || '')
const winRate = computed(() => {
  if (!character.value || character.value.stats.matchCount === 0) return '0%'
  return `${Math.round((character.value.stats.winCount / character.value.stats.matchCount) * 100)}%`
})
const preferredModes = computed(() =>
  (character.value?.gameModePreferences || []).map((pref) => gameModeService.get(pref.modeId)).filter(Boolean)
)

async function load() {
  if (!characterId.value) return
  loading.value = true
  error.value = ''
  try {
    character.value = await characterService.get(characterId.value)
    const matches = await matchService.list()
    recentMatches.value = matches.filter((m) => m.participantIds.includes(characterId.value)).slice(0, 5)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

async function duplicateCharacter() {
  if (!character.value) return
  saving.value = true
  try {
    const copy = await characterService.duplicate(character.value.id)
    navigate(`/character-detail/${copy.id}`)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function toggleCharacterStatus() {
  if (!character.value) return
  saving.value = true
  try {
    character.value = await characterService.toggleStatus(character.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    saving.value = false
  }
}

async function removeCharacter() {
  if (!character.value) return
  if (!window.confirm(`确定删除角色“${character.value.name}”吗？此操作不可恢复。`)) return
  saving.value = true
  try {
    await characterService.remove(character.value.id)
    navigate('/characters')
  } catch (err) {
    error.value = formatUserMessage(err)
    saving.value = false
  }
}

function openMatch(match: Match) {
  if (match.status === 'active' || match.status === 'paused') {
    void matchWindowService.open(match.id)
    return
  }
  navigate(`/match-detail/${match.id}`)
}

onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="detail-page">
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="detail-3col" loading-label="正在打开角色档案..." @retry="load">
      <section v-if="character" class="detail-layout">
      <aside class="visual-panel" :style="{ '--accent': character.accentColor }">
        <div class="portrait-frame">
          <img
            class="portrait"
            :src="characterPortraitByName(character.name, 0, character.modelId, character.portraitUrl)"
            :alt="character.name"
          />
          <button
            type="button"
            class="favorite"
            :class="{ active: character.status === 'enabled' }"
            :disabled="saving"
            @click="toggleCharacterStatus"
          >
            <Star :size="20" />
          </button>
        </div>
        <div class="identity-card">
          <img :src="characterAvatarByName(character.name, 0, character.modelId, character.avatarUrl)" alt="" />
          <div>
            <h2>{{ character.name }}</h2>
            <p>{{ character.subtitle }}</p>
          </div>
        </div>
        <div class="stats-row">
          <div><span>对局</span><strong>{{ character.stats.matchCount }}</strong></div>
          <div><span>胜率</span><strong>{{ winRate }}</strong></div>
          <div><span>语气</span><strong>{{ character.speechStyle }}</strong></div>
        </div>
      </aside>

      <main class="profile-panel">
        <header class="profile-toolbar">
          <div>
            <span class="eyebrow">角色档案</span>
            <p>{{ character.bio || '这个角色还没有写下完整档案，可以在编辑中补充背景、语气和推理偏好。' }}</p>
          </div>
          <div class="head-actions">
            <button class="primary" type="button" @click="navigate(`/character-edit/${character.id}`)">
              <Edit3 :size="17" />
              编辑
            </button>
            <button type="button" :disabled="saving" @click="duplicateCharacter">
              <Copy :size="17" />
              复制
            </button>
            <button class="danger" type="button" :disabled="saving" @click="removeCharacter">
              <Trash2 :size="17" />
              删除
            </button>
          </div>
        </header>

        <section class="voice-card">
          <span>常用发言</span>
          <strong>“{{ character.commonPhrases[0] || '我会先观察局势，再给出判断。' }}”</strong>
        </section>

        <section class="trait-cloud">
          <span v-for="tag in character.tags" :key="tag">{{ tag }}</span>
          <span v-if="!character.tags.length">暂无标签</span>
        </section>

        <div class="content-grid">
          <section class="info-card principle-card">
            <h2>行为原则</h2>
            <article v-for="item in character.behaviorPrinciples.slice(0, 4)" :key="item">
              <i></i>
              <span>{{ item }}</span>
            </article>
            <article v-if="!character.behaviorPrinciples.length">
              <i></i>
              <span>优先保持角色口吻，并遵循玩法规则。</span>
            </article>
          </section>

          <section class="info-card strategy-card">
            <h2>推理倾向</h2>
            <label><span>共情</span><i><b :style="{ width: `${character.strategy.empathyVsLogic}%` }"></b></i><em>逻辑</em></label>
            <label><span>谨慎</span><i><b :style="{ width: `${character.strategy.cautiousVsBold}%` }"></b></i><em>冒险</em></label>
            <label><span>主导</span><i><b :style="{ width: `${character.strategy.leadVsFollow}%` }"></b></i><em>跟随</em></label>
          </section>
        </div>

        <section class="mode-ribbon">
          <h2>适合玩法</h2>
          <div>
            <article v-for="mode in preferredModes" :key="mode!.id">
              <span>{{ modeBadges[mode!.id] }}</span>
              <strong>{{ mode!.name }}</strong>
              <p>{{ mode!.subtitle }}</p>
            </article>
            <article v-if="!preferredModes.length">
              <span>新</span>
              <strong>自由配置</strong>
              <p>可在编辑中添加偏好玩法</p>
            </article>
          </div>
        </section>
      </main>

      <aside class="recent-panel">
        <header>
          <h2>最近参与</h2>
          <button type="button" @click="navigate('/match-records')">全部</button>
        </header>
        <article v-for="match in recentMatches" :key="match.id" @click="openMatch(match)">
          <img :src="matchImageByModeId(match.gameModeId)" alt="" />
          <div>
            <strong>{{ match.title }}</strong>
            <p>{{ match.participants.length }} 人 · {{ formatTimeLabel(match.updatedAt) }}</p>
          </div>
          <PlayCircle :size="18" />
        </article>
        <div v-if="!recentMatches.length" class="empty-recent">这个角色还没有参与过对局。</div>
      </aside>
    </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.detail-page :deep(.aa-page-inner) {
  max-width: none;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr);
  padding: 26px 34px 16px;
  overflow: hidden;
}

.detail-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 338px minmax(0, 1fr) 318px;
  gap: 16px;
  overflow: hidden;
}

.visual-panel,
.profile-panel,
.recent-panel,
.info-card,
.voice-card,
.mode-ribbon {
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 24px 52px rgba(91, 101, 174, 0.11);
  backdrop-filter: blur(22px);
}

.visual-panel {
  --accent: #7568ff;
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto 82px;
}

.portrait-frame {
  position: relative;
  overflow: hidden;
  margin: 14px;
  border-radius: 21px;
  background: radial-gradient(circle at 50% 8%, color-mix(in srgb, var(--accent) 18%, white), transparent 58%);
}

.portrait-frame::after {
  content: '';
  position: absolute;
  inset: auto 18px 18px;
  height: 38%;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  filter: blur(28px);
}

.portrait {
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  transform: scale(1.035);
}

.favorite {
  position: absolute;
  z-index: 2;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.72);
  color: #8b95bd;
  cursor: pointer;
  transition: transform 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

.favorite:hover {
  transform: translateY(-2px) scale(1.04);
  box-shadow: 0 12px 24px rgba(94, 88, 202, 0.15);
}

.favorite.active {
  color: #f5b335;
  filter: drop-shadow(0 0 10px rgba(245, 179, 53, 0.4));
}

.identity-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 14px 10px;
  padding: 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.76), color-mix(in srgb, var(--accent) 12%, white));
}

.identity-card img {
  width: 60px;
  height: 60px;
  border-radius: 20px;
  object-fit: cover;
  box-shadow: 0 10px 22px color-mix(in srgb, var(--accent) 22%, transparent);
}

.identity-card h2 {
  margin: 0 0 5px;
  color: #111a51;
  font-size: 21px;
  font-weight: 660;
}

.identity-card p {
  margin: 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.45;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  border-top: 1px solid rgba(130, 142, 207, 0.12);
}

.stats-row div {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 5px;
  color: #66709d;
  font-size: 12px;
}

.stats-row strong {
  color: #17205a;
  font-size: 17px;
  font-weight: 680;
}

.profile-panel,
.recent-panel {
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 18px;
}

.profile-panel::-webkit-scrollbar,
.recent-panel::-webkit-scrollbar {
  display: none;
}

.profile-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  margin-bottom: 14px;
}

.eyebrow {
  color: #6c63ff;
  font-size: 12px;
  font-weight: 680;
  letter-spacing: 0.08em;
}

.profile-toolbar p {
  max-width: 620px;
  margin: 8px 0 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 8px;
}

.head-actions button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 36px;
  padding: 0 13px;
  border: 1px solid rgba(130, 142, 207, 0.15);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: #26305e;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.head-actions button:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: 0 14px 24px rgba(91, 101, 174, 0.11);
}

.head-actions .primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
}

.head-actions .danger {
  color: #dc2626;
}

.voice-card {
  padding: 16px 18px;
  margin-bottom: 12px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.78), rgba(237, 241, 255, 0.72)),
    radial-gradient(circle at 92% 12%, rgba(244, 114, 182, 0.14), transparent 34%);
}

.voice-card span {
  display: block;
  margin-bottom: 8px;
  color: #7a85b0;
  font-size: 12px;
}

.voice-card strong {
  color: #17205a;
  font-size: 18px;
  font-weight: 620;
  line-height: 1.6;
}

.trait-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.trait-cloud span {
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.09);
  color: #625cf0;
  font-size: 12px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-card {
  min-height: 180px;
  padding: 16px 18px;
}

.info-card h2,
.mode-ribbon h2,
.recent-panel h2 {
  margin: 0 0 14px;
  color: #17205a;
  font-size: 17px;
  font-weight: 650;
}

.principle-card {
  display: grid;
  align-content: start;
  gap: 10px;
}

.principle-card article {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  color: #59649b;
  font-size: 13px;
  line-height: 1.65;
}

.principle-card i {
  width: 7px;
  height: 7px;
  margin-top: 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, #8b84ff, #f472b6);
}

.strategy-card label {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 36px;
  gap: 10px;
  align-items: center;
  margin: 15px 0;
  color: #66709d;
  font-size: 13px;
}

.strategy-card em {
  font-style: normal;
  text-align: right;
}

.strategy-card i {
  height: 9px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(130, 142, 207, 0.16);
}

.strategy-card b {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #8b84ff, #f472b6);
}

.mode-ribbon {
  margin-top: 12px;
  padding: 16px 18px;
}

.mode-ribbon > div {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.mode-ribbon article {
  min-width: 0;
  padding: 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.56);
  transition: transform 0.2s ease, background 0.2s ease;
}

.mode-ribbon article:hover {
  transform: translateY(-3px);
  background: rgba(255, 255, 255, 0.8);
}

.mode-ribbon article > span {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  margin-bottom: 8px;
  border-radius: 12px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-weight: 700;
}

.mode-ribbon strong,
.recent-panel strong {
  color: #17205a;
  font-weight: 660;
}

.mode-ribbon p,
.recent-panel p {
  margin: 4px 0 0;
  color: #6b75a7;
  font-size: 12px;
}

.recent-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.recent-panel header button {
  border: 0;
  background: transparent;
  color: #5b57f3;
  font: inherit;
  cursor: pointer;
}

.recent-panel article {
  display: grid;
  grid-template-columns: 58px minmax(0, 1fr) 22px;
  gap: 12px;
  align-items: center;
  min-height: 72px;
  padding: 8px;
  border-radius: 16px;
  cursor: pointer;
  transition: background 0.2s ease, transform 0.2s ease;
}

.recent-panel article:hover {
  background: rgba(255, 255, 255, 0.56);
  transform: translateX(3px);
}

.recent-panel article img {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  object-fit: cover;
}

.empty-recent {
  display: grid;
  place-items: center;
  min-height: 140px;
  color: #7a85b0;
  font-size: 13px;
}

.detail-state {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #65709f;
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
