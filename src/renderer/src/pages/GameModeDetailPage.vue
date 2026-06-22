<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Clock, Coins, Edit3, Loader2, PlayCircle, Sparkles, Users } from 'lucide-vue-next'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { modeBadges, modeImageById } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import {
  arenaSession,
  formatUserMessage,
  gameModeService,
  getBuiltinGameMode,
  loadGameModeOverrides,
  matchService,
  matchWindowService,
} from '@renderer/services/arena'
import { formatTimeLabel, formatYuan } from '@renderer/utils/id'
import type { GameMode, Match } from '@shared/arena/types'

const mode = ref<GameMode | null>(null)
const recentMatches = ref<Match[]>([])
const loading = ref(true)
const error = ref('')

const modeId = computed(() => route.value.id || '')
const isAvailable = computed(() => mode.value?.id === 'werewolf')
const hasCustomConfig = computed(() => (modeId.value ? gameModeService.hasOverride(modeId.value) : false))

async function load() {
  if (!modeId.value) return
  loading.value = true
  error.value = ''
  try {
    await loadGameModeOverrides()
    mode.value = gameModeService.get(modeId.value) || null
    if (!mode.value) {
      error.value = '玩法不存在'
      return
    }
    const matches = await matchService.list()
    recentMatches.value = matches.filter((m) => m.gameModeId === modeId.value).slice(0, 6)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
  }
}

function startCreate() {
  if (!mode.value || !isAvailable.value) return
  arenaSession.setSelectedMode(mode.value.id)
  navigate('/create-match')
}

function openMatch(match: Match) {
  if (match.status === 'active' || match.status === 'paused') {
    void matchWindowService.open(match.id)
    return
  }
  navigate(`/match-detail/${match.id}`)
}

watch(modeId, () => void load())
onMounted(() => void load())
</script>

<template>
  <ArenaPageShell class="detail-page">
    <ArenaPageState :loading="loading" :error="error || undefined" skeleton="detail-3col" loading-label="正在打开玩法详情..." @retry="load">
      <section v-if="mode" class="detail-layout">
      <aside class="visual-panel">
        <div class="cover-frame">
          <img class="cover" :src="modeImageById(mode.id)" :alt="mode.name" />
          <span v-if="!isAvailable" class="soon-badge">筹备中</span>
        </div>
        <div class="identity-card">
          <span class="mode-badge">{{ modeBadges[mode.id] }}</span>
          <div>
            <h2>{{ mode.name }}</h2>
            <p>{{ mode.subtitle }}</p>
          </div>
        </div>
        <div class="stats-row">
          <div><span>人数</span><strong>{{ mode.minPlayers }}-{{ mode.maxPlayers }}</strong></div>
          <div><span>推荐</span><strong>{{ mode.recommendedPlayers }}人</strong></div>
          <div><span>时长</span><strong>{{ mode.estimatedDurationMinutes }}分</strong></div>
        </div>
      </aside>

      <main class="profile-panel">
        <header class="profile-toolbar">
          <div>
            <span class="eyebrow">玩法档案</span>
            <p>{{ mode.description }}</p>
            <span v-if="hasCustomConfig" class="custom-tag">已自定义配置</span>
          </div>
          <div class="head-actions">
            <button class="primary" type="button" @click="navigate(`/game-mode-edit/${mode.id}`)">
              <Edit3 :size="17" />
              编辑
            </button>
            <button type="button" :disabled="!isAvailable" @click="startCreate">
              <Sparkles :size="17" />
              {{ isAvailable ? '创建对局' : '暂未开放' }}
            </button>
          </div>
        </header>

        <section class="meta-card">
          <div><Users :size="16" /> {{ mode.minPlayers }}-{{ mode.maxPlayers }} 人</div>
          <div><Coins :size="16" /> {{ formatYuan(mode.estimatedCostPerPlayerCents * mode.recommendedPlayers) }}/局</div>
          <div><Clock :size="16" /> 约 {{ mode.estimatedDurationMinutes }} 分钟</div>
        </section>

        <section v-if="mode.setupSummary" class="info-card">
          <h2>开局说明</h2>
          <p>{{ mode.setupSummary }}</p>
        </section>

        <div class="content-grid">
          <section v-if="mode.ruleHighlights?.length" class="info-card">
            <h2>规则要点</h2>
            <article v-for="(rule, index) in mode.ruleHighlights" :key="index">
              <i></i>
              <span>{{ rule }}</span>
            </article>
          </section>

          <section v-if="mode.sheriffRule" class="info-card">
            <h2>警长规则</h2>
            <p>{{ mode.sheriffRule }}</p>
          </section>
        </div>

        <section class="info-card roles-card">
          <h2>身份配置（{{ mode.roles.length }}）</h2>
          <div class="role-grid">
            <article v-for="role in mode.roles" :key="role.id">
              <strong>{{ role.name }}</strong>
              <em>{{ role.camp }}</em>
              <p>{{ role.description || role.skillDescription || '暂无说明' }}</p>
            </article>
          </div>
        </section>

        <section class="info-card">
          <h2>流程阶段</h2>
          <ol class="phase-list">
            <li v-for="phase in mode.phases" :key="phase.id">
              <strong>{{ phase.name }}</strong>
              <span>{{ phase.description }}</span>
            </li>
          </ol>
        </section>
      </main>

      <aside class="recent-panel">
        <header>
          <h2>最近对局</h2>
          <button type="button" @click="navigate('/match-records')">全部</button>
        </header>
        <article v-for="match in recentMatches" :key="match.id" @click="openMatch(match)">
          <img :src="modeImageById(match.gameModeId)" alt="" />
          <div>
            <strong>{{ match.title }}</strong>
            <p>{{ match.participants.length }} 人 · {{ formatTimeLabel(match.updatedAt) }}</p>
          </div>
          <PlayCircle :size="18" />
        </article>
        <div v-if="!recentMatches.length" class="empty-recent">这个玩法还没有对局记录。</div>
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
.meta-card {
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.66);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 24px 52px rgba(91, 101, 174, 0.11);
  backdrop-filter: blur(22px);
}

.visual-panel {
  min-height: 0;
  overflow: hidden;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto 82px;
}

.cover-frame {
  position: relative;
  overflow: hidden;
  margin: 14px;
  border-radius: 21px;
  background: radial-gradient(circle at 50% 8%, rgba(112, 105, 255, 0.18), transparent 58%);
}

.cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transform: scale(1.03);
}

.soon-badge {
  position: absolute;
  left: 12px;
  top: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  color: #fff;
  background: rgba(40, 34, 82, 0.48);
  backdrop-filter: blur(10px);
  font-size: 12px;
  font-weight: 600;
}

.identity-card {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 14px 10px;
  padding: 12px;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.76), rgba(112, 105, 255, 0.12));
}

.mode-badge {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: rgba(112, 105, 255, 0.12);
  color: #5b57f3;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
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
  font-size: 15px;
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
  max-width: none;
  margin: 8px 0 0;
  color: #5e68a0;
  font-size: 14px;
  line-height: 1.75;
}

.custom-tag {
  display: inline-flex;
  margin-top: 10px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(36, 169, 103, 0.1);
  color: #1a9a62;
  font-size: 12px;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
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
}

.head-actions button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.head-actions .primary {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
}

.meta-card {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 12px;
  color: #59649b;
  font-size: 13px;
}

.meta-card div {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}

.info-card {
  min-height: 120px;
  padding: 16px 18px;
  margin-bottom: 12px;
}

.info-card h2,
.recent-panel h2 {
  margin: 0 0 14px;
  color: #17205a;
  font-size: 17px;
  font-weight: 650;
}

.info-card p,
.info-card span,
.phase-list span {
  color: #59649b;
  font-size: 13px;
  line-height: 1.65;
}

.info-card article {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr);
  gap: 10px;
  margin-top: 10px;
}

.info-card article i {
  width: 7px;
  height: 7px;
  margin-top: 8px;
  border-radius: 999px;
  background: linear-gradient(180deg, #8b84ff, #f472b6);
}

.roles-card {
  margin-bottom: 12px;
}

.role-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.role-grid article {
  display: block;
  padding: 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.56);
}

.role-grid strong {
  color: #17205a;
  font-size: 14px;
}

.role-grid em {
  display: block;
  margin-top: 4px;
  color: #7a83ae;
  font-style: normal;
  font-size: 12px;
}

.role-grid p {
  margin: 8px 0 0;
}

.phase-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 10px;
}

.phase-list li {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.56);
}

.phase-list strong {
  color: #17205a;
  font-size: 14px;
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
}

.recent-panel article:hover {
  background: rgba(255, 255, 255, 0.56);
}

.recent-panel article img {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  object-fit: cover;
}

.recent-panel strong {
  color: #17205a;
  font-weight: 660;
}

.recent-panel p {
  margin: 4px 0 0;
  color: #6b75a7;
  font-size: 12px;
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
