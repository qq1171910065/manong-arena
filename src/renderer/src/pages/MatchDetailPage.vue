<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import {
  Copy,
  Crown,
  Flame,
  MessageSquare,
  Play,
  RotateCcw,
  Star,
  Trophy,
  Vote,
} from 'lucide-vue-next'
import { formatWinnerCampLabel } from '@shared/arena/camp-labels'
import ArenaPageShell from '@renderer/components/arena/ArenaPageShell.vue'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import DetailEditableBlock from '@renderer/components/arena/DetailEditableBlock.vue'
import DetailRailActions from '@renderer/components/arena/DetailRailActions.vue'
import DetailSectionNav from '@renderer/components/arena/DetailSectionNav.vue'
import MatchSpeechContent from '@renderer/components/arena/MatchSpeechContent.vue'
import { useScrollSpySections } from '@renderer/composables/useScrollSpySections'
import { characterAvatarByName, matchImageByModeId } from '@renderer/data/arena-visual-assets'
import { navigate, route } from '../router'
import {
  arenaSession,
  formatUserMessage,
  gameModeService,
  matchRecapService,
  matchService,
  matchWindowService,
  ttsService,
} from '@renderer/services/arena'
import { formatTimeLabel, matchStatusLabel } from '@renderer/utils/id'
import { resolveSpeechDisplayConfig } from '@shared/arena/speech-display'
import { WEREWOLF_EXPANSION_ROLES, type WerewolfExpansionRoleId } from '@shared/arena/werewolf-dlc'
import { normalizeWerewolfWinCondition } from '@shared/arena/werewolf-win-condition'
import type { Match, MatchMessage, MatchParticipant, MatchRecap, MatchRecapMoment } from '@shared/arena/types'

type RecapTimelineItem = MatchRecapMoment & { kind: 'highlight' | 'reversal' }

const activeTab = ref<'speeches' | 'votes' | 'events'>('speeches')
const match = ref<Match | null>(null)
const loading = ref(true)
const recapLoading = ref(false)
const error = ref('')
const scrollRoot = ref<HTMLElement | null>(null)

const canReturnToRoom = computed(() => {
  const status = match.value?.status
  return status === 'active' || status === 'paused' || status === 'aborted' || status === 'completed'
})

const recap = computed<MatchRecap | null>(() => {
  if (match.value?.recap?.summary) return match.value.recap
  if (match.value?.status === 'completed') {
    return matchRecapService.buildFallbackRecap(match.value)
  }
  return null
})

const recapTimeline = computed<RecapTimelineItem[]>(() => {
  if (!recap.value) return []
  const items: RecapTimelineItem[] = [
    ...recap.value.highlights.map((item) => ({ ...item, kind: 'highlight' as const })),
    ...recap.value.reversals.map((item) => ({ ...item, kind: 'reversal' as const })),
  ]
  return items.sort((a, b) => a.round - b.round || a.title.localeCompare(b.title))
})

const speechMessages = computed(() =>
  (match.value?.messages || []).filter((msg) => msg.kind === 'speech' && msg.confirmed)
)

const speechDisplayConfig = computed(() =>
  match.value ? resolveSpeechDisplayConfig(match.value.gameModeId, gameModeService.get(match.value.gameModeId)?.speechDisplay) : null
)

const statItems = computed(() => {
  if (!match.value) return []
  return [
    { label: '人数', value: String(match.value.participants.length) },
    { label: '轮次', value: String(match.value.runtime.currentRound || 1) },
    { label: '发言', value: String(speechMessages.value.length) },
    { label: '投票', value: String(match.value.votes.length) },
  ]
})

const navTabs = computed(() => {
  const tabs: Array<{ id: string; label: string }> = []
  if (match.value?.status === 'completed') tabs.push({ id: 'recap', label: '战报' })
  tabs.push({ id: 'participants', label: '角色' }, { id: 'log', label: '记录' })
  return tabs
})

const { activeSection, scrollToSection, refreshSpy } = useScrollSpySections(navTabs, scrollRoot)

function isParticipantMvp(participant: MatchParticipant): boolean {
  const mvp = recap.value?.mvp
  if (!mvp) return false
  return mvp.characterId === participant.characterId
}

function speechDisplayText(msg: MatchMessage): string {
  return ttsService.stripDisplayText(msg.content)
}

function statusBadgeClass(status: Match['status']): string {
  if (status === 'active') return 'is-active'
  if (status === 'paused' || status === 'aborted') return 'is-paused'
  if (status === 'completed') return 'is-done'
  return ''
}

async function load() {
  if (!route.value.id) return
  loading.value = true
  error.value = ''
  try {
    match.value = await matchService.get(route.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    loading.value = false
    await nextTick(refreshSpy)
  }
}

async function ensureRecap() {
  if (!match.value || match.value.status !== 'completed' || match.value.recap?.summary) return
  recapLoading.value = true
  try {
    match.value = await matchRecapService.ensureRecap(match.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    recapLoading.value = false
    await nextTick(refreshSpy)
  }
}

async function regenerateRecap() {
  if (!match.value || match.value.status !== 'completed' || recapLoading.value) return
  recapLoading.value = true
  error.value = ''
  try {
    match.value = await matchRecapService.regenerateRecap(match.value.id)
  } catch (err) {
    error.value = formatUserMessage(err)
  } finally {
    recapLoading.value = false
    await nextTick(refreshSpy)
  }
}

function inferWerewolfExpansions(source: Match): WerewolfExpansionRoleId[] {
  const expansionIds = new Set(WEREWOLF_EXPANSION_ROLES.map((role) => role.id))
  return [
    ...new Set(
      source.participants
        .map((participant) => participant.roleId)
        .filter((roleId): roleId is WerewolfExpansionRoleId => Boolean(roleId && expansionIds.has(roleId as WerewolfExpansionRoleId)))
    ),
  ]
}

function copyConfig() {
  if (!match.value) return
  const isWerewolf = match.value.gameModeId === 'werewolf'
  arenaSession.setCreatePreset({
    gameModeId: match.value.gameModeId,
    characterIds: [...match.value.participantIds],
    identityAssignMode: match.value.identityAssignMode,
    targetPlayerCount: match.value.participants.length,
    werewolfDlcs: isWerewolf ? inferWerewolfExpansions(match.value) : undefined,
    werewolfRuleModules: isWerewolf ? match.value.werewolfRuleModules : undefined,
    sheriffEnabled: isWerewolf ? match.value.runtime.sheriffEnabled !== false : undefined,
    werewolfWinCondition: isWerewolf ? normalizeWerewolfWinCondition(match.value.werewolfWinCondition) : undefined,
  })
  navigate('/create-match')
}

function openRoom() {
  if (!match.value) return
  void matchWindowService.open(match.value.id)
}

onMounted(async () => {
  await load()
  await ensureRecap()
})
</script>

<template>
  <ArenaPageShell class="detail-page match-detail-page" viewport-lock>
    <ArenaPageState
      :loading="loading"
      :error="error || undefined"
      skeleton="detail-3col"
      loading-label="加载对局详情..."
      @retry="load"
    >
      <section v-if="match" class="detail-layout match-detail-layout">
        <aside class="detail-layout__rail detail-layout__rail--left">
          <div class="aa-detail-float-panel sticky-rail detail-layout__panel match-rail-panel">
            <div class="match-cover">
              <img :src="matchImageByModeId(match.gameModeId)" :alt="match.gameModeName" />
              <span class="match-cover__badge" :class="statusBadgeClass(match.status)">
                {{ matchStatusLabel(match.status) }}
              </span>
            </div>

            <div class="match-identity">
              <p class="match-identity__mode">{{ match.gameModeName }}</p>
              <h2>{{ match.title }}</h2>
              <p class="match-identity__meta">
                {{ match.participants.length }} 人局 · {{ formatTimeLabel(match.updatedAt) }}
              </p>
              <div v-if="match.status === 'completed'" class="match-identity__result">
                <Trophy :size="14" />
                {{ formatWinnerCampLabel(match.winnerCamp) }}胜利
              </div>
            </div>

            <div class="match-stats">
              <div v-for="item in statItems" :key="item.label">
                <strong>{{ item.value }}</strong>
                <span>{{ item.label }}</span>
              </div>
            </div>

            <div class="match-avatar-strip">
              <img
                v-for="(participant, index) in match.participants.slice(0, 6)"
                :key="participant.characterId"
                :src="characterAvatarByName(participant.characterName, index, participant.modelId, participant.avatarUrl, participant.characterId)"
                :alt="participant.characterName"
                :title="participant.characterName"
              />
              <span v-if="match.participants.length > 6">+{{ match.participants.length - 6 }}</span>
            </div>

            <DetailRailActions tools-label="对局操作">
              <template v-if="canReturnToRoom" #hero>
                <button type="button" class="aa-rail-btn aa-rail-btn--primary aa-rail-btn--featured" @click="openRoom">
                  <strong>回到游戏房间</strong>
                  <em>查看局内状态与回放</em>
                  <Play :size="18" />
                </button>
              </template>
              <template #row>
                <button
                  v-if="match.status === 'completed'"
                  type="button"
                  class="aa-rail-btn aa-rail-btn--accent"
                  :disabled="recapLoading"
                  @click="regenerateRecap"
                >
                  <RotateCcw :size="16" :class="{ spin: recapLoading }" />
                  {{ recapLoading ? '生成中…' : '重新生成战报' }}
                </button>
              </template>
              <template #tools>
                <button type="button" class="aa-rail-tile" @click="copyConfig">
                  <Copy :size="17" />
                  复制配置
                </button>
              </template>
            </DetailRailActions>
          </div>
        </aside>

        <div ref="scrollRoot" class="detail-layout__main aa-detail-content-scroll">
          <div class="aa-detail-content-stack">
            <section
              v-if="match.status === 'completed'"
              id="section-recap"
              class="aa-detail-region"
            >
              <DetailEditableBlock
                title="对局战报"
                :hint="recapLoading ? '战报生成中…' : '本局走势回顾与关键节点'"
              >
                <p class="recap-summary">
                  {{ recap?.summary || match.resultSummary || '暂无总结' }}
                </p>

                <div v-if="recap?.mvp" class="mvp-spotlight">
                  <div class="mvp-spotlight__glow" aria-hidden="true" />
                  <div class="mvp-spotlight__badge">
                    <Crown :size="16" />
                    本局 MVP
                  </div>
                  <strong>{{ recap.mvp.seatOrder }}号 · {{ recap.mvp.characterName }}</strong>
                  <p>{{ recap.mvp.reason }}</p>
                </div>

                <div v-if="recapTimeline.length" class="recap-timeline">
                  <article
                    v-for="item in recapTimeline"
                    :key="`${item.kind}-${item.id}`"
                    class="recap-timeline__item"
                    :class="item.kind === 'reversal' ? 'is-reversal' : 'is-highlight'"
                  >
                    <div class="recap-timeline__rail">
                      <span class="recap-timeline__dot" />
                    </div>
                    <div class="recap-timeline__body">
                      <div class="recap-timeline__meta">
                        <span class="recap-timeline__round">第 {{ item.round }} 轮</span>
                        <span class="recap-timeline__kind">
                          <Star v-if="item.kind === 'highlight'" :size="12" />
                          <RotateCcw v-else :size="12" />
                          {{ item.kind === 'highlight' ? '高光' : '反转' }}
                        </span>
                      </div>
                      <strong>{{ item.title }}</strong>
                      <p>{{ item.description }}</p>
                    </div>
                  </article>
                </div>
                <p v-else class="recap-empty">本局暂无高光或反转记录</p>
              </DetailEditableBlock>
            </section>

            <section id="section-participants" class="aa-detail-region">
              <DetailEditableBlock title="参与角色" hint="本局登场角色与最终身份">
                <div class="participant-roster">
                  <article
                    v-for="(participant, index) in match.participants"
                    :key="participant.characterId"
                    class="participant-tile"
                    :class="{
                      'is-mvp': isParticipantMvp(participant),
                      'is-out': participant.alive !== 'alive',
                    }"
                  >
                    <div class="participant-tile__visual">
                      <img
                        :src="characterAvatarByName(participant.characterName, index, participant.modelId, participant.avatarUrl, participant.characterId)"
                        :alt="participant.characterName"
                      />
                      <span class="participant-tile__seat">{{ participant.seatOrder }}</span>
                      <div v-if="isParticipantMvp(participant)" class="participant-tile__mvp">
                        <Crown :size="13" />
                        MVP
                      </div>
                    </div>
                    <div class="participant-tile__copy">
                      <strong>{{ participant.characterName }}</strong>
                      <p>
                        <template v-if="participant.roleName">{{ participant.roleName }}</template>
                        <template v-else>身份未公开</template>
                      </p>
                      <span v-if="participant.isSheriff" class="participant-tile__sheriff">警长</span>
                    </div>
                  </article>
                </div>
              </DetailEditableBlock>
            </section>

            <section id="section-log" class="aa-detail-region aa-detail-region--flush">
              <DetailEditableBlock title="对局记录" hint="公开发言、投票与事件时间线">
                <div class="log-tabs">
                  <button :class="{ active: activeTab === 'speeches' }" type="button" @click="activeTab = 'speeches'">
                    <MessageSquare :size="14" /> 发言 {{ speechMessages.length }}
                  </button>
                  <button :class="{ active: activeTab === 'votes' }" type="button" @click="activeTab = 'votes'">
                    <Vote :size="14" /> 投票 {{ match.votes.length }}
                  </button>
                  <button :class="{ active: activeTab === 'events' }" type="button" @click="activeTab = 'events'">
                    <Flame :size="14" /> 事件 {{ match.events.length }}
                  </button>
                </div>

                <div v-if="activeTab === 'speeches'" class="log-panel">
                  <p v-if="!speechMessages.length" class="log-empty">暂无发言记录</p>
                  <article v-for="msg in speechMessages" :key="msg.id" class="log-item">
                    <header>
                      <div>
                        <strong>{{ msg.participantName }}</strong>
                        <span v-if="msg.roleLabel"> · {{ msg.roleLabel }}</span>
                      </div>
                      <time>{{ formatTimeLabel(msg.createdAt) }}</time>
                    </header>
                    <p>
                      <MatchSpeechContent
                        :text="speechDisplayText(msg)"
                        :config="speechDisplayConfig"
                        :participants="match.participants"
                      />
                    </p>
                  </article>
                </div>

                <div v-else-if="activeTab === 'votes'" class="log-panel">
                  <p v-if="!match.votes.length" class="log-empty">暂无投票记录</p>
                  <article v-for="vote in match.votes" :key="vote.id" class="log-item log-item--compact">
                    <header>
                      <strong>{{ vote.voterName }}</strong>
                      <time>第 {{ vote.round }} 轮</time>
                    </header>
                    <p>{{ vote.abstain ? '弃权' : `投票给 ${vote.targetName || '未知'}` }}</p>
                  </article>
                </div>

                <div v-else class="log-panel">
                  <p v-if="!match.events.length" class="log-empty">暂无公开事件</p>
                  <article v-for="event in match.events" :key="event.id" class="log-item log-item--compact">
                    <header>
                      <strong>{{ event.icon }} {{ event.text }}</strong>
                      <time>第 {{ event.round }} 轮 · {{ formatTimeLabel(event.createdAt) }}</time>
                    </header>
                  </article>
                </div>
              </DetailEditableBlock>
            </section>
          </div>
        </div>

        <aside class="detail-layout__rail detail-layout__rail--right">
          <DetailSectionNav :tabs="navTabs" :active-id="activeSection" @select="scrollToSection" />
        </aside>
      </section>
    </ArenaPageState>
  </ArenaPageShell>
</template>

<style scoped>
.match-detail-layout {
  --detail-rail-left: 248px;
}

.match-rail-panel {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.match-cover {
  position: relative;
  height: 196px;
  margin: 8px 8px 0;
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(circle at 50% 8%, rgba(112, 105, 255, 0.18), transparent 58%);
}

.match-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.match-cover__badge {
  position: absolute;
  left: 10px;
  top: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.9);
  color: #334078;
  font-size: 11px;
  font-weight: 650;
}

.match-cover__badge.is-active {
  color: #5b57f3;
}

.match-cover__badge.is-paused {
  color: #e07a2f;
}

.match-cover__badge.is-done {
  color: #1f9f65;
}

.match-identity {
  padding: 10px 12px 0;
}

.match-identity__mode {
  margin: 0 0 4px;
  color: #7a84ad;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.match-identity h2 {
  margin: 0;
  color: #111a51;
  font-size: 17px;
  font-weight: 680;
  line-height: 1.3;
}

.match-identity__meta {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 12px;
  line-height: 1.45;
}

.match-identity__result {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  padding: 5px 10px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
  font-size: 12px;
  font-weight: 650;
}

.match-stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 10px 8px 0;
  border-top: 1px solid rgba(130, 142, 207, 0.12);
  border-bottom: 1px solid rgba(130, 142, 207, 0.12);
}

.match-stats div {
  display: grid;
  place-items: center;
  gap: 2px;
  padding: 8px 2px;
}

.match-stats strong {
  color: #17205a;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.1;
}

.match-stats span {
  color: #7a84ad;
  font-size: 10px;
  white-space: nowrap;
}

.match-avatar-strip {
  display: flex;
  align-items: center;
  padding: 10px 12px 0;
}

.match-avatar-strip img,
.match-avatar-strip span {
  width: 30px;
  height: 30px;
  margin-left: -7px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

.match-avatar-strip img:first-child {
  margin-left: 0;
}

.match-avatar-strip span {
  display: grid;
  place-items: center;
  color: #625cf0;
  background: #f0eeff;
  font-size: 10px;
  font-weight: 700;
}

.recap-summary {
  margin: 0 0 14px;
  padding: 14px 16px;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(112, 105, 255, 0.08), rgba(255, 255, 255, 0.72));
  border: 1px solid rgba(130, 142, 207, 0.12);
  color: #243066;
  font-size: 15px;
  line-height: 1.75;
}

.mvp-spotlight {
  position: relative;
  overflow: hidden;
  margin-bottom: 16px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid rgba(245, 179, 53, 0.42);
  background:
    linear-gradient(135deg, rgba(255, 247, 214, 0.95), rgba(255, 255, 255, 0.82)),
    radial-gradient(circle at 12% 18%, rgba(255, 214, 102, 0.35), transparent 52%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.72) inset,
    0 14px 32px rgba(245, 158, 11, 0.16);
}

.mvp-spotlight__glow {
  position: absolute;
  inset: -40% -20%;
  background: conic-gradient(from 120deg, transparent, rgba(255, 214, 102, 0.28), transparent 55%);
  animation: mvp-glow 4.5s linear infinite;
  pointer-events: none;
}

.mvp-spotlight__badge {
  position: relative;
  z-index: 1;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 12px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffd76a, #f59e0b 58%, #ea580c);
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-shadow: 0 1px 2px rgba(146, 64, 14, 0.35);
  box-shadow: 0 8px 18px rgba(245, 158, 11, 0.28);
}

.mvp-spotlight strong {
  position: relative;
  z-index: 1;
  display: block;
  color: #7c2d12;
  font-size: 16px;
  font-weight: 780;
}

.mvp-spotlight p {
  position: relative;
  z-index: 1;
  margin: 8px 0 0;
  color: #9a3412;
  font-size: 13px;
  line-height: 1.65;
}

.recap-timeline {
  display: grid;
  gap: 0;
}

.recap-timeline__item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 12px;
  min-height: 0;
}

.recap-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.recap-timeline__rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(130, 142, 207, 0.16);
}

.recap-timeline__item:first-child .recap-timeline__rail::before {
  top: 12px;
}

.recap-timeline__item:last-child .recap-timeline__rail::before {
  bottom: auto;
  height: 12px;
}

.recap-timeline__dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  margin-top: 12px;
  border-radius: 50%;
  background: #7b61ff;
  box-shadow: 0 0 0 4px rgba(123, 97, 255, 0.14);
}

.recap-timeline__item.is-reversal .recap-timeline__dot {
  background: #e07a2f;
  box-shadow: 0 0 0 4px rgba(224, 122, 47, 0.14);
}

.recap-timeline__body {
  padding: 8px 0 18px;
  min-width: 0;
}

.recap-timeline__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.recap-timeline__round {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(122, 92, 255, 0.1);
  color: #6d5dfb;
  font-size: 11px;
  font-weight: 700;
}

.recap-timeline__kind {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #7a84ad;
  font-size: 11px;
  font-weight: 650;
}

.recap-timeline__item.is-reversal .recap-timeline__kind {
  color: #c56a1f;
}

.recap-timeline__body strong {
  display: block;
  color: #17205a;
  font-size: 14px;
  line-height: 1.35;
}

.recap-timeline__body p {
  margin: 6px 0 0;
  color: #66709d;
  font-size: 13px;
  line-height: 1.6;
}

.recap-empty,
.log-empty {
  margin: 0;
  color: #8b93b8;
  font-size: 13px;
}

.participant-roster {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
  gap: 12px;
}

.participant-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 8px 10px;
  border-radius: 18px;
  border: 1px solid rgba(130, 142, 207, 0.12);
  background: rgba(255, 255, 255, 0.52);
  text-align: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.participant-tile.is-out {
  opacity: 0.68;
  filter: grayscale(0.25);
}

.participant-tile.is-mvp {
  border-color: rgba(245, 179, 53, 0.55);
  background:
    linear-gradient(180deg, rgba(255, 248, 230, 0.96), rgba(255, 255, 255, 0.72)),
    radial-gradient(circle at 50% 0%, rgba(255, 214, 102, 0.28), transparent 62%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.8) inset,
    0 12px 28px rgba(245, 158, 11, 0.18);
  transform: translateY(-2px);
}

.participant-tile__visual {
  position: relative;
  width: 64px;
  height: 64px;
}

.participant-tile__visual img {
  width: 100%;
  height: 100%;
  border-radius: 18px;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 18px rgba(91, 101, 174, 0.12);
}

.participant-tile.is-mvp .participant-tile__visual img {
  border-color: rgba(255, 214, 102, 0.95);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18), 0 10px 22px rgba(245, 158, 11, 0.22);
}

.participant-tile__seat {
  position: absolute;
  left: -4px;
  top: -4px;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(18, 24, 68, 0.82);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(18, 24, 68, 0.18);
}

.participant-tile__mvp {
  position: absolute;
  left: 50%;
  bottom: -8px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border-radius: 999px;
  background: linear-gradient(135deg, #ffd76a, #f59e0b 60%, #ea580c);
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  white-space: nowrap;
  box-shadow: 0 6px 14px rgba(245, 158, 11, 0.28);
  animation: mvp-pulse 2.4s ease-in-out infinite;
}

.participant-tile__copy {
  min-width: 0;
  width: 100%;
}

.participant-tile__copy strong {
  display: block;
  color: #17205a;
  font-size: 13px;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participant-tile__copy p {
  margin: 4px 0 0;
  color: #7a84ad;
  font-size: 11px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.participant-tile__sheriff {
  display: inline-flex;
  margin-top: 6px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 10px;
  font-weight: 650;
}

.log-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.log-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid rgba(130, 142, 207, 0.16);
  background: rgba(255, 255, 255, 0.58);
  color: #526099;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}

.log-tabs button.active {
  border-color: transparent;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  color: #fff;
}

.log-panel {
  display: grid;
  gap: 8px;
}

.log-item {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(130, 142, 207, 0.1);
  background: rgba(255, 255, 255, 0.52);
}

.log-item header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
}

.log-item header strong {
  color: #243066;
  font-size: 13px;
}

.log-item header time {
  color: #8b93b8;
  font-size: 11px;
  white-space: nowrap;
}

.log-item p {
  margin: 0;
  color: #526099;
  font-size: 13px;
  line-height: 1.65;
}

.log-item--compact header {
  margin-bottom: 4px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes mvp-glow {
  to {
    transform: rotate(360deg);
  }
}

@keyframes mvp-pulse {
  0%,
  100% {
    box-shadow: 0 6px 14px rgba(245, 158, 11, 0.28);
  }
  50% {
    box-shadow: 0 8px 20px rgba(245, 158, 11, 0.42);
  }
}

@media (max-width: 960px) {
  .participant-roster {
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  }
}
</style>
