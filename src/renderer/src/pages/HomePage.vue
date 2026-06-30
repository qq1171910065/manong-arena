<script setup lang="ts">
import { ChevronRight, Play, Sparkles } from 'lucide-vue-next'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import CharacterActivityTicker from '@renderer/components/arena/CharacterActivityTicker.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigate } from '../router'
import {
  arenaSession,
  dashboardService,
  mapCharacterActivityFeed,
  mapCharactersForHome,
  mapMatchesForHome,
  matchWindowService,
} from '@renderer/services/arena'
import type { HomeCharacterActivity, HomeCharacterCard, HomeMatchRow } from '@renderer/services/arena/home-mapper'

const characters = ref<HomeCharacterCard[]>([])
const recentMatches = ref<HomeMatchRow[]>([])
const characterActivities = ref<HomeCharacterActivity[]>([])

const sloganLines = [
  { lead: '我的 AI 角色', highlight: '已就位', mark: '✦' },
  { lead: '推理搭子', highlight: '正在集结', mark: '✦' },
  { lead: '今晚的真相', highlight: '等你揭晓', mark: '✦' },
]

const typingLines = [
  '与你的 AI 伙伴一起，开启精彩推理之旅',
  '选择角色进入场景，让每次发言都有迹可循',
  '从线索到投票，AI 会陪你慢慢照亮局势',
  '准备好之后，就把下一场真相交给对局吧',
]

const bubbleLines = [
  '我觉得 TA 有点可疑呢。',
  '让我分析一下线索。',
  '保持冷静，先观察局势。',
  '我的直觉告诉我...',
  '记住每一个细节。',
  '真相总会浮出水面。',
  '这一轮先别急着投。',
  '信息差正在缩小。',
]

const sloganIndex = ref(0)
const typingIndex = ref(0)
const typedText = ref('')
const typingCursor = ref(0)
const activeBubbleIndex = ref<number | null>(null)
const activeBubbleText = ref('')
const activeBubbleTyped = ref('')
const speakingCharacterIndex = ref<number | null>(null)
const carouselIndex = ref(0)
const hoveredCardIndex = ref<number | null>(null)
const deckHovered = ref(false)
const canCreateMatch = ref(true)
const resumableMatchId = ref('')
const homeLoading = ref(true)

let sloganTimer: number | undefined
let typingTimer: number | undefined
let bubbleTimer: number | undefined
let bubbleHideTimer: number | undefined
let bubbleRevealTimer: number | undefined
let bubbleTypingTimer: number | undefined
let carouselTimer: number | undefined

const activeSlogan = computed(() => sloganLines[sloganIndex.value])
const hasResumeMatch = computed(() => Boolean(resumableMatchId.value))
const MAX_RECENT_MATCHES = 10
const MAX_CHARACTER_ACTIVITIES = 50

const visibleMatches = computed(() => recentMatches.value.slice(0, MAX_RECENT_MATCHES))
const visibleActivities = computed(() => characterActivities.value.slice(0, MAX_CHARACTER_ACTIVITIES))

function getCardRelativeIndex(index: number, count = characters.value.length): number {
  if (count <= 1) return 0
  const center = ((carouselIndex.value % count) + count) % count
  let rel = index - center
  const half = count / 2
  if (rel >= half) rel -= count
  if (rel < -half) rel += count
  return rel
}

function advanceCarousel() {
  const count = characters.value.length
  if (count <= 1) return
  carouselIndex.value = (carouselIndex.value + 1) % count
}

function getCardDeckStyle(index: number): Record<string, string | number> {
  const count = characters.value.length
  if (!count) return {}

  const rel = getCardRelativeIndex(index, count)
  const isHovered = hoveredCardIndex.value === index
  const isSpeaking = speakingCharacterIndex.value === index
  const spread = count > 4 ? 124 : 138
  const translateX = rel * spread
  const rotate = rel * 4.2
  const lift = isSpeaking ? 24 : isHovered ? 20 : rel === 0 ? 16 : Math.max(0, 4 - Math.abs(rel))
  const scale = isSpeaking ? 1.14 : isHovered ? 1.1 : rel === 0 ? 1.07 : Math.max(0.88, 1 - Math.abs(rel) * 0.032)
  const zIndex = isSpeaking ? 30 : isHovered ? 24 : 16 - Math.abs(rel)
  const opacity = Math.max(0.78, 1 - Math.abs(rel) * 0.045)

  return {
    zIndex,
    opacity,
    transform: `translateX(${translateX}px) translateY(${-lift}px) rotate(${rotate}deg) scale(${scale})`,
  }
}

function speechSide(index: number): 'left' | 'right' {
  const count = characters.value.length
  if (count <= 1) return 'right'
  return getCardRelativeIndex(index, count) >= 0 ? 'right' : 'left'
}

function startCarousel() {
  if (carouselTimer) window.clearInterval(carouselTimer)
  carouselTimer = window.setInterval(() => {
    if (deckHovered.value) return
    if (speakingCharacterIndex.value !== null) return
    advanceCarousel()
  }, 4200)
}

async function loadDashboard() {
  homeLoading.value = true
  try {
    const dashboard = await dashboardService.load()
    characters.value = mapCharactersForHome(dashboard.characters)
    recentMatches.value = mapMatchesForHome(dashboard.recentMatches, dashboard.allCharacters)
    characterActivities.value = mapCharacterActivityFeed({
      characters: dashboard.allCharacters,
      behaviorChanges: dashboard.behaviorChanges,
      growthRecords: dashboard.growthRecords,
      growthSnapshots: dashboard.growthSnapshots,
      recentMatches: dashboard.recentMatches,
      limit: MAX_CHARACTER_ACTIVITIES,
    })
    resumableMatchId.value = dashboard.resumableMatch?.id || ''
    canCreateMatch.value = dashboard.allCharacters.some((c) => c.status === 'enabled')
    carouselIndex.value = 0
    startCarousel()
    if (characters.value.length) scheduleCharacterBubble(900)
  } catch {
    characters.value = mapCharactersForHome([])
    characterActivities.value = mapCharacterActivityFeed({
      characters: [],
      behaviorChanges: [],
      growthRecords: [],
      growthSnapshots: [],
      recentMatches: [],
      limit: MAX_CHARACTER_ACTIVITIES,
    })
  } finally {
    homeLoading.value = false
  }
}

async function openMatchRoom(matchId: string) {
  await matchWindowService.open(matchId)
}

function openCreateMatch(modeId?: string) {
  if (!canCreateMatch.value) {
    navigate('/characters?create=1')
    return
  }
  if (modeId) arenaSession.setSelectedMode(modeId)
  navigate('/create-match')
}

function openCharacter(character: HomeCharacterCard) {
  if (!character.clickable) return
  navigate(`/character-detail/${character.id}`)
}

function openCharacterActivity(activity: HomeCharacterActivity) {
  if (!activity.clickable) return
  if (activity.target === 'match' && activity.matchId) {
    const match = recentMatches.value.find((item) => item.id === activity.matchId)
    if (match && (match.status === '进行中' || match.status === '已暂停')) {
      void openMatchRoom(activity.matchId)
      return
    }
    navigate(`/match-detail/${activity.matchId}`)
    return
  }
  navigate(`/character-detail/${activity.characterId}`)
}

function openMatch(match: HomeMatchRow) {
  if (match.status === '进行中' || match.status === '已暂停') {
    void openMatchRoom(match.id)
    return
  }
  navigate(`/match-detail/${match.id}`)
}

function tickTyping() {
  const line = typingLines[typingIndex.value]
  if (typingCursor.value <= line.length) {
    typedText.value = line.slice(0, typingCursor.value)
    typingCursor.value += 1
    return
  }

  window.clearInterval(typingTimer)
  typingTimer = window.setTimeout(() => {
    typingIndex.value = (typingIndex.value + 1) % typingLines.length
    typingCursor.value = 0
    typedText.value = ''
    typingTimer = window.setInterval(tickTyping, 52)
  }, 1500)
}

function clearBubbleTimers() {
  if (bubbleTimer) window.clearTimeout(bubbleTimer)
  if (bubbleHideTimer) window.clearTimeout(bubbleHideTimer)
  if (bubbleRevealTimer) window.clearTimeout(bubbleRevealTimer)
  if (bubbleTypingTimer) window.clearInterval(bubbleTypingTimer)
}

function scheduleCharacterBubble(delay = 2200 + Math.random() * 1800) {
  if (bubbleTimer) window.clearTimeout(bubbleTimer)
  bubbleTimer = window.setTimeout(startCharacterBubble, delay)
}

function startCharacterBubble() {
  if (bubbleHideTimer) window.clearTimeout(bubbleHideTimer)
  if (bubbleRevealTimer) window.clearTimeout(bubbleRevealTimer)
  if (bubbleTypingTimer) window.clearInterval(bubbleTypingTimer)
  if (!characters.value.length) {
    scheduleCharacterBubble(600)
    return
  }

  const count = characters.value.length
  const speakIndex = ((carouselIndex.value % count) + count) % count
  const character = characters.value[speakIndex]
  const nextText =
    Math.random() > 0.34
      ? character.speech
      : bubbleLines[Math.floor(Math.random() * bubbleLines.length)]
  speakingCharacterIndex.value = speakIndex
  activeBubbleIndex.value = null
  activeBubbleText.value = nextText
  activeBubbleTyped.value = ''

  bubbleRevealTimer = window.setTimeout(() => {
    activeBubbleIndex.value = speakIndex
    let cursor = 0
    bubbleTypingTimer = window.setInterval(() => {
      if (cursor <= nextText.length) {
        activeBubbleTyped.value = nextText.slice(0, cursor)
        cursor += 1
        return
      }

      if (bubbleTypingTimer) window.clearInterval(bubbleTypingTimer)
      bubbleHideTimer = window.setTimeout(() => {
        activeBubbleIndex.value = null
        activeBubbleText.value = ''
        activeBubbleTyped.value = ''
        speakingCharacterIndex.value = null
        scheduleCharacterBubble(3600 + Math.random() * 3600)
      }, 1200)
    }, 58)
  }, 680)
}

onMounted(() => {
  void loadDashboard()
  sloganTimer = window.setInterval(() => {
    sloganIndex.value = (sloganIndex.value + 1) % sloganLines.length
  }, 4200)
  typingTimer = window.setInterval(tickTyping, 52)
  scheduleCharacterBubble(1400)
  startCarousel()
})

onUnmounted(() => {
  if (sloganTimer) window.clearInterval(sloganTimer)
  if (typingTimer) window.clearInterval(typingTimer)
  if (carouselTimer) window.clearInterval(carouselTimer)
  clearBubbleTimers()
})
</script>

<template>
  <div class="home">
    <ArenaPageState :loading="homeLoading" skeleton="home" loading-label="正在准备首页..." @retry="loadDashboard">
      <main class="home-main arena-stagger">
      <section class="hero" aria-label="首页">
        <div class="hero-copy">
          <h1>
            <span class="slogan-lead">{{ activeSlogan.lead }}</span>
            <span class="slogan-highlight">{{ activeSlogan.highlight }}</span>
            <i>{{ activeSlogan.mark }}</i>
          </h1>
          <p class="hero-type" aria-live="polite">
            <span>{{ typedText }}</span>
            <span class="typing-caret"></span>
          </p>
          <div class="hero-actions">
            <button v-if="canCreateMatch" type="button" class="primary-action" @click="openCreateMatch()">
              <Sparkles :size="25" />
              <span>创建对局</span>
            </button>
            <button v-else type="button" class="primary-action" @click="navigate('/characters?create=1')">
              <Sparkles :size="25" />
              <span>先创建角色</span>
            </button>
            <button
              v-if="hasResumeMatch"
              type="button"
              class="secondary-action"
              @click="openMatchRoom(resumableMatchId)"
            >
              <Play :size="21" fill="currentColor" />
              <span>继续最近对局</span>
            </button>
          </div>
        </div>

        <div
          class="character-stage"
          :class="{ 'character-stage--paused': deckHovered }"
          aria-label="AI 角色"
          @mouseenter="deckHovered = true"
          @mouseleave="deckHovered = false"
        >
          <article
            v-for="(character, index) in characters"
            :key="character.id"
            class="character-card"
            :class="{
              'character-card--speaking': speakingCharacterIndex === index,
              'character-card--center': getCardRelativeIndex(index) === 0,
              'character-card--hovered': hoveredCardIndex === index,
            }"
            :style="{
              '--accent': character.accent,
              '--badge-bg': character.badge,
              cursor: character.clickable ? 'pointer' : undefined,
              ...getCardDeckStyle(index),
            }"
            @mouseenter="hoveredCardIndex = index"
            @mouseleave="hoveredCardIndex = null"
            @click="openCharacter(character)"
          >
            <Transition name="bubble-pop">
              <p
                v-if="activeBubbleIndex === index"
                :key="`${character.name}-${activeBubbleIndex}`"
                class="speech"
                :class="{
                  'speech--left': speechSide(index) === 'left',
                  'speech--right': speechSide(index) === 'right',
                }"
              >
                {{ activeBubbleTyped }}<span class="speech-caret"></span>
              </p>
            </Transition>
            <div class="portrait">
              <img :src="character.image" :alt="character.name" />
              <div class="character-card__caption">
                <strong class="character-card__name">{{ character.name }}</strong>
                <p v-if="character.subtitle" class="character-card__subtitle">{{ character.subtitle }}</p>
                <p v-if="character.bio" class="character-card__bio">{{ character.bio }}</p>
                <div v-if="character.tags.length" class="character-card__tags">
                  <span v-for="tag in character.tags" :key="tag">{{ tag }}</span>
                </div>
                <span class="character-card__stat">{{ character.matchLabel }}</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="content-grid">
        <div class="panel recent-panel">
          <header class="panel__header">
            <h2>最近对局</h2>
            <button type="button" @click="navigate('/match-records')">
              查看全部
              <ChevronRight :size="20" />
            </button>
          </header>

          <div v-if="!recentMatches.length" class="arena-page-state__panel arena-page-state__empty panel-slot-empty">
            <strong>还没有对局记录</strong>
            <span>创建一场新对局，让角色开始留下推理轨迹。</span>
          </div>
          <ul v-else class="simple-list match-list">
            <li v-for="match in visibleMatches" :key="match.id">
              <button type="button" class="simple-line" @click="openMatch(match)">
                <span class="simple-line__main">
                  <strong>{{ match.name }}</strong>
                  <span class="simple-line__muted">{{ match.mode }}</span>
                </span>
                <span class="simple-line__meta">
                  <b :class="{ 'is-active': match.status !== '已完成' }">{{ match.status }}</b>
                  <time>{{ match.date }}</time>
                </span>
              </button>
            </li>
          </ul>
        </div>

        <div class="panel activity-panel">
          <header class="panel__header">
            <h2>角色动态</h2>
            <button type="button" @click="navigate('/characters')">
              角色库
              <ChevronRight :size="20" />
            </button>
          </header>

          <div v-if="!visibleActivities.length" class="arena-page-state__panel arena-page-state__empty panel-slot-empty">
            <strong>还没有角色动态</strong>
            <span>角色参与对局、学习玩法、私聊养成或复盘成长后，动态会显示在这里。</span>
          </div>
          <CharacterActivityTicker
            v-else
            class="activity-panel__ticker"
            :items="visibleActivities"
            @select="openCharacterActivity"
          />
        </div>
      </section>
    </main>
    </ArenaPageState>
  </div>
</template>

<style scoped>
.home {
  --ink: #121b53;
  --muted: #59669a;
  --line: rgba(132, 142, 204, 0.2);
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 100%;
  height: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink);
  background: transparent;
  font-family:
    'Source Han Sans SC',
    'Source Han Sans CN',
    'Noto Sans SC',
    'Microsoft YaHei',
    system-ui,
    sans-serif;
}

.home img {
  display: block;
  max-width: 100%;
}

.home::before,
.home::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.home::before {
  background:
    radial-gradient(circle at 29% 7%, rgba(255, 255, 255, 0.9) 0 2px, transparent 3px),
    radial-gradient(circle at 87% 13%, rgba(255, 255, 255, 0.9) 0 3px, transparent 4px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.32));
  opacity: 0.68;
}

.home::after {
  background:
    radial-gradient(circle at 34% 23%, rgba(255, 255, 255, 0.56), transparent 16%),
    radial-gradient(circle at 79% 38%, rgba(141, 129, 255, 0.12), transparent 26%),
    linear-gradient(180deg, rgba(246, 247, 255, 0.18), rgba(214, 221, 255, 0.38));
}

button {
  font: inherit;
}

.home :deep(.arena-page-state),
.home :deep(.arena-page-state__frame),
.home :deep(.arena-page-state__revealed),
.home :deep(.arena-page-state__content) {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.home-main {
  --home-bottom-height: 340px;
  position: relative;
  z-index: 2;
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  padding: clamp(16px, 2vh, 24px) clamp(28px, 2.2vw, 36px) clamp(12px, 1.4vh, 18px);
  display: grid;
  grid-template-rows: minmax(0, 1fr) var(--home-bottom-height);
  gap: clamp(12px, 1.4vh, 16px);
  overflow: hidden;
  box-sizing: border-box;
}

.hero {
  display: grid;
  grid-template-columns: minmax(280px, 34%) minmax(0, 1fr);
  align-items: stretch;
  gap: clamp(10px, 1.2vw, 20px);
  min-height: 0;
  height: 100%;
  overflow: visible;
}

.hero-copy {
  position: relative;
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 0;
  padding:
    clamp(16px, 3vh, 36px)
    clamp(12px, 1.5vw, 24px)
    clamp(16px, 3vh, 32px)
    clamp(52px, 6vw, 96px);
}

.hero-copy h1 {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.22em 0.28em;
  width: min(100%, 520px);
  min-height: 54px;
  margin: 0;
  color: #10194e;
  font-size: clamp(30px, 2.6vw, 38px);
  font-weight: 700;
  line-height: 1.12;
  text-shadow: 0 8px 22px rgba(84, 87, 175, 0.08);
}

.slogan-lead {
  display: inline-block;
  overflow: hidden;
  text-overflow: clip;
}

.slogan-highlight {
  display: inline-block;
  overflow: hidden;
  text-overflow: clip;
  color: #6d5dfb;
  background: linear-gradient(90deg, #4b4fee, #a45bf4, #f072c8);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  font-weight: 760;
}

.hero-copy h1 i {
  color: #f4b36f;
  font-style: normal;
  font-size: 25px;
}

.hero-type {
  display: flex;
  align-items: center;
  width: min(480px, 100%);
  min-height: 34px;
  margin: clamp(14px, 2vh, 20px) 0 0;
  color: #526099;
  font-size: clamp(15px, 1.12vw, 18px);
  font-weight: 400;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.hero-type > span:first-child {
  display: inline-block;
  min-width: 0;
  max-width: none;
  overflow: visible;
  text-overflow: clip;
}

.typing-caret {
  flex: 0 0 auto;
  display: inline-block;
  width: 2px;
  height: 1.05em;
  margin-left: 4px;
  vertical-align: -0.12em;
  border-radius: 999px;
  background: linear-gradient(180deg, #6860ff, #f06fc4);
  animation: caretBlink 0.9s steps(2, end) infinite;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  min-height: 58px;
  margin-top: clamp(22px, 3vh, 32px);
}

.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: clamp(54px, 6.2vh, 62px);
  padding: 0 28px;
  border-radius: 999px;
  border: 1px solid rgba(123, 128, 209, 0.22);
  font-size: clamp(16px, 1.12vw, 19px);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.primary-action {
  min-width: 176px;
  color: white;
  background: linear-gradient(180deg, #7774ff 0%, #5757f2 100%);
  box-shadow: 0 16px 28px rgba(88, 80, 239, 0.28);
}

.secondary-action {
  min-width: 168px;
  color: #35417f;
  background: rgba(255, 255, 255, 0.62);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88);
}

.primary-action:hover,
.secondary-action:hover {
  transform: translateY(-2px);
}

.primary-action:hover {
  box-shadow: 0 20px 32px rgba(88, 80, 239, 0.36);
  background: linear-gradient(180deg, #817eff 0%, #5d5af6 100%);
}

.secondary-action:hover {
  border-color: rgba(101, 101, 232, 0.42);
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 14px 24px rgba(86, 91, 190, 0.12);
}

.character-stage {
  --deck-card-width: clamp(240px, 19vw, 300px);
  --deck-card-ratio: 0.76;
  --deck-spread: clamp(96px, 7.6vw, 128px);
  position: relative;
  align-self: stretch;
  justify-self: stretch;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: visible;
}

.character-stage::before {
  content: '';
  position: absolute;
  left: 50%;
  bottom: clamp(4px, 0.8vh, 12px);
  width: min(88%, 640px);
  height: 34px;
  margin-left: calc(min(88%, 640px) / -2);
  border-radius: 999px;
  background: radial-gradient(ellipse at center, rgba(113, 103, 255, 0.18), transparent 72%);
  filter: blur(10px);
  pointer-events: none;
}

.character-card {
  --accent: #7568ff;
  --badge-bg: #fff;
  position: absolute;
  left: 50%;
  bottom: clamp(8px, 1.4vh, 18px);
  display: block;
  width: var(--deck-card-width);
  height: min(calc(var(--deck-card-width) / var(--deck-card-ratio)), calc(100% - 12px));
  margin-left: calc(var(--deck-card-width) / -2);
  perspective: 900px;
  transform-origin: 50% 92%;
  transition:
    transform 0.72s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.52s ease,
    filter 0.42s ease,
    z-index 0s linear 0.08s;
  will-change: transform, opacity;
}

.character-card--center .portrait {
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.92),
    0 20px 34px rgba(90, 102, 174, 0.18),
    0 0 0 1px rgba(255, 255, 255, 0.42);
}

.character-card--hovered,
.character-card--speaking {
  filter: drop-shadow(0 24px 30px rgba(82, 91, 168, 0.24));
  transition:
    transform 0.55s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.38s ease,
    filter 0.32s ease,
    z-index 0s;
}

.character-card--center:not(.character-card--hovered):not(.character-card--speaking) {
  filter: drop-shadow(0 16px 24px rgba(82, 91, 168, 0.14));
}

.speech {
  position: absolute;
  top: 44%;
  z-index: 10;
  display: block;
  width: max-content;
  min-width: 76px;
  max-width: 232px;
  min-height: 36px;
  margin: 0;
  padding: 9px 13px 10px;
  white-space: pre-wrap;
  text-align: left;
  color: #69729f;
  font-size: clamp(11px, 0.76vw, 12px);
  font-weight: 450;
  line-height: 1.35;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(255, 255, 255, 0.8);
  border-radius: 14px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 14px 24px rgba(84, 93, 166, 0.13);
  backdrop-filter: blur(12px);
  transform: translateY(-50%);
}

.speech::after {
  content: '';
  position: absolute;
  top: 50%;
  width: 15px;
  height: 15px;
  background: rgba(255, 255, 255, 0.76);
  transform: translateY(-50%) rotate(45deg);
}

.speech--right {
  left: calc(100% - 6px);
}

.speech--right::after {
  left: -7px;
  border-left: 1px solid rgba(255, 255, 255, 0.8);
  border-bottom: 1px solid rgba(255, 255, 255, 0.8);
}

.speech--left {
  right: calc(100% - 6px);
}

.speech--left::after {
  right: -7px;
  border-right: 1px solid rgba(255, 255, 255, 0.8);
  border-top: 1px solid rgba(255, 255, 255, 0.8);
}

.speech-caret {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 3px;
  vertical-align: -0.15em;
  border-radius: 999px;
  background: #7066ff;
  animation: caretBlink 0.9s steps(2, end) infinite;
}

.bubble-pop-enter-active {
  transition: opacity 0.24s ease, transform 0.34s cubic-bezier(0.16, 1, 0.3, 1), filter 0.34s ease;
}

.bubble-pop-leave-active {
  transition: opacity 0.16s ease, transform 0.18s ease;
}

.bubble-pop-enter-from,
.bubble-pop-leave-to {
  opacity: 0;
  filter: blur(6px);
}

.bubble-pop-enter-from.speech--right,
.bubble-pop-leave-to.speech--right {
  transform: translate(-10px, -50%) scale(0.88);
}

.bubble-pop-enter-to.speech--right,
.bubble-pop-leave-from.speech--right {
  transform: translate(0, -50%) scale(1);
}

.bubble-pop-enter-from.speech--left,
.bubble-pop-leave-to.speech--left {
  transform: translate(10px, -50%) scale(0.88);
}

.bubble-pop-enter-to.speech--left,
.bubble-pop-leave-from.speech--left {
  transform: translate(0, -50%) scale(1);
}

.portrait {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.58);
  border-radius: 20px;
  background: radial-gradient(circle at 50% 18%, rgba(255, 255, 255, 0.95), transparent 44%), linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(217, 222, 255, 0.46));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92), 0 16px 24px rgba(90, 102, 174, 0.14);
}

.portrait::before {
  content: '';
  position: absolute;
  inset: -40% -80%;
  z-index: 2;
  pointer-events: none;
  background: linear-gradient(115deg, transparent 38%, rgba(255, 255, 255, 0.48) 50%, transparent 62%);
  transform: translateX(-38%) rotate(4deg);
  opacity: 0;
  transition: opacity 0.24s ease, transform 0.72s cubic-bezier(0.16, 1, 0.3, 1);
}

.portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 8%;
  transform: scale(1.04);
  transition: transform 0.24s ease;
  filter: saturate(1.04);
}

.character-card--hovered .portrait img,
.character-card:hover .portrait img {
  transform: scale(1.13);
}

.character-card--speaking .portrait img {
  transform: scale(1.16);
}

.character-card:hover .portrait::before {
  opacity: 1;
  transform: translateX(38%) rotate(4deg);
}

.character-card__caption {
  position: absolute;
  inset: auto 0 0;
  z-index: 3;
  display: grid;
  gap: 3px;
  padding: 28px 12px 12px;
  border-radius: 0 0 18px 18px;
  background: linear-gradient(
    180deg,
    rgba(18, 24, 58, 0) 0%,
    rgba(18, 24, 58, 0.42) 28%,
    rgba(18, 24, 58, 0.78) 100%
  );
  pointer-events: none;
}

.character-card__name {
  overflow: hidden;
  color: #fff;
  font-size: clamp(12px, 0.88vw, 14px);
  font-weight: 680;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 8px rgba(8, 12, 36, 0.45);
}

.character-card__subtitle {
  margin: 0;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.92);
  font-size: clamp(10px, 0.72vw, 11px);
  font-weight: 500;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 1px 6px rgba(8, 12, 36, 0.38);
}

.character-card__bio {
  margin: 0;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: rgba(236, 240, 255, 0.88);
  font-size: clamp(10px, 0.68vw, 11px);
  line-height: 1.35;
  text-shadow: 0 1px 5px rgba(8, 12, 36, 0.34);
}

.character-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.character-card__tags span {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: 2px 7px;
  overflow: hidden;
  color: #fff;
  font-size: 10px;
  font-weight: 520;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 72%, rgba(18, 24, 58, 0.72));
  box-shadow: 0 2px 8px rgba(8, 12, 36, 0.18);
}

.character-card__stat {
  color: rgba(220, 228, 255, 0.82);
  font-size: 10px;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(8, 12, 36, 0.32);
}

.character-card:not(.character-card--center):not(.character-card--hovered):not(.character-card--speaking) .character-card__bio,
.character-card:not(.character-card--center):not(.character-card--hovered):not(.character-card--speaking) .character-card__tags,
.character-card:not(.character-card--center):not(.character-card--hovered):not(.character-card--speaking) .character-card__stat {
  display: none;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(0, 1fr);
  gap: 16px;
  height: var(--home-bottom-height);
  min-height: var(--home-bottom-height);
  max-height: var(--home-bottom-height);
  overflow: hidden;
}

.panel {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  padding: 16px 18px 14px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.58);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.88),
    0 16px 36px rgba(91, 101, 174, 0.08);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 2px;
  flex: 0 0 auto;
}

.panel__header h2 {
  margin: 0;
  font-size: 16px;
  line-height: 1;
  font-weight: 640;
  color: #151e55;
}

.panel__header button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 0;
  background: transparent;
  color: #59649a;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
}

.panel__header button:hover {
  color: #4f4bf1;
  transform: translateX(2px);
}

.panel-slot-empty {
  height: 100%;
  min-height: 0;
  padding: 16px 12px;
  font-size: 13px;
}

.panel-slot-empty strong {
  font-size: 16px;
}

.panel-slot-empty span {
  max-width: 280px;
  line-height: 1.55;
}

.activity-panel__ticker {
  min-height: 0;
}

.simple-list {
  list-style: none;
  margin: 0;
  padding: 0;
  min-height: 0;
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.simple-list::-webkit-scrollbar {
  display: none;
}

.simple-list li {
  margin: 0;
}

.simple-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 42px;
  padding: 8px 2px;
  border: 0;
  border-bottom: 1px solid rgba(132, 142, 204, 0.12);
  border-radius: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: color 0.16s ease, background 0.16s ease;
}

.simple-list li:last-child .simple-line {
  border-bottom: 0;
}

.simple-line--static {
  cursor: default;
}

.simple-line:not(.simple-line--static):hover {
  background: rgba(255, 255, 255, 0.42);
}

.simple-line__main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.simple-line__main strong {
  overflow: hidden;
  color: #17205a;
  font-size: 14px;
  font-weight: 560;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simple-line__muted {
  overflow: hidden;
  flex: 1 1 auto;
  min-width: 0;
  color: #6973a1;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.simple-line__meta {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  flex: 0 0 auto;
}

.simple-line__meta b {
  color: #24b66a;
  font-size: 12px;
  font-weight: 560;
}

.simple-line__meta b.is-active {
  color: #f07836;
}

.simple-line time,
.simple-line > time {
  flex: 0 0 auto;
  color: #8a94bd;
  font-size: 12px;
  white-space: nowrap;
}

.simple-line--activity {
  grid-template-columns: 28px minmax(0, 1fr) auto;
  gap: 10px;
}

.simple-line__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

@keyframes caretBlink {
  0%,
  48% {
    opacity: 1;
  }
  49%,
  100% {
    opacity: 0;
  }
}

@media (max-width: 1320px) {
  .hero {
    grid-template-columns: minmax(260px, 36%) minmax(0, 1fr);
  }

  .hero-copy {
    padding-left: clamp(40px, 5vw, 72px);
  }
}

@media (max-width: 1120px) {
  .home-main {
    --home-bottom-height: 380px;
    grid-template-rows: minmax(0, 1fr) var(--home-bottom-height);
  }

  .hero {
    grid-template-columns: 1fr;
    grid-template-rows: auto minmax(0, 1fr);
  }

  .hero-copy {
    padding-bottom: 0;
    padding-left: clamp(24px, 4vw, 48px);
  }

  .character-stage {
    min-height: 280px;
  }
}
</style>
