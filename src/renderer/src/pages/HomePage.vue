<script setup lang="ts">
import { ChevronRight, Play, Sparkles, Users } from 'lucide-vue-next'
import ArenaPageState from '@renderer/components/arena/ArenaPageState.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { navigate } from '../router'
import {
  arenaSession,
  dashboardService,
  mapCharactersForHome,
  mapMatchesForHome,
  mapModesForHome,
  matchWindowService,
} from '@renderer/services/arena'
import type { HomeCharacterCard, HomeMatchRow, HomeModeCard } from '@renderer/services/arena/home-mapper'

const characters = ref<HomeCharacterCard[]>([])
const recentMatches = ref<HomeMatchRow[]>([])
const gameModes = ref<HomeModeCard[]>([])

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
const canCreateMatch = ref(true)
const resumableMatchId = ref('')
const homeLoading = ref(true)

let sloganTimer: number | undefined
let typingTimer: number | undefined
let bubbleTimer: number | undefined
let bubbleHideTimer: number | undefined
let bubbleRevealTimer: number | undefined
let bubbleTypingTimer: number | undefined

const activeSlogan = computed(() => sloganLines[sloganIndex.value])
const hasResumeMatch = computed(() => Boolean(resumableMatchId.value))
const matchListClass = computed(() => ({
  'match-list--single': recentMatches.value.length === 1,
  'match-list--compact': recentMatches.value.length >= 3,
}))

async function loadDashboard() {
  homeLoading.value = true
  try {
    const dashboard = await dashboardService.load()
    characters.value = mapCharactersForHome(dashboard.characters)
    recentMatches.value = mapMatchesForHome(dashboard.recentMatches, dashboard.characters)
    gameModes.value = mapModesForHome(dashboard.gameModes)
    resumableMatchId.value = dashboard.resumableMatch?.id || ''
    canCreateMatch.value = dashboard.characters.length > 0
  } catch {
    characters.value = mapCharactersForHome([])
    gameModes.value = mapModesForHome([])
  } finally {
    homeLoading.value = false
  }
}

async function openMatchRoom(matchId: string) {
  await matchWindowService.open(matchId)
}

function openCreateMatch(modeId?: string) {
  if (!canCreateMatch.value) {
    navigate('/character-edit/new')
    return
  }
  if (modeId) arenaSession.setSelectedMode(modeId)
  navigate('/create-match')
}

function openCharacter(character: HomeCharacterCard) {
  if (!character.clickable) return
  navigate(`/character-detail/${character.id}`)
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
  if (!characters.value.length) return

  const nextIndex = Math.floor(Math.random() * characters.value.length)
  const nextText =
    Math.random() > 0.34
      ? characters.value[nextIndex].speech
      : bubbleLines[Math.floor(Math.random() * bubbleLines.length)]
  speakingCharacterIndex.value = nextIndex
  activeBubbleIndex.value = null
  activeBubbleText.value = nextText
  activeBubbleTyped.value = ''

  bubbleRevealTimer = window.setTimeout(() => {
    activeBubbleIndex.value = nextIndex
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
})

onUnmounted(() => {
  if (sloganTimer) window.clearInterval(sloganTimer)
  if (typingTimer) window.clearInterval(typingTimer)
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
            <button v-else type="button" class="primary-action" @click="navigate('/character-edit/new')">
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

        <div class="character-stage" aria-label="模型角色">
          <article
            v-for="(character, index) in characters"
            :key="character.id"
            class="character-card"
            :class="{ 'character-card--speaking': speakingCharacterIndex === index }"
            :style="{ '--accent': character.accent, '--badge-bg': character.badge, cursor: character.clickable ? 'pointer' : undefined }"
            @click="openCharacter(character)"
          >
            <Transition name="bubble-pop">
              <p
                v-if="activeBubbleIndex === index"
                :key="`${character.name}-${activeBubbleIndex}`"
                class="speech"
                :class="{
                  'speech--left': index >= 3,
                  'speech--right': index < 3,
                }"
              >
                {{ activeBubbleTyped }}<span class="speech-caret"></span>
              </p>
            </Transition>
            <div class="portrait">
              <img :src="character.image" :alt="character.name" />
            </div>
            <strong>{{ character.name }}</strong>
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

          <div v-if="!recentMatches.length" class="match-list-empty">
            <strong>还没有对局记录</strong>
            <span>创建一场新对局，让角色开始留下推理轨迹。</span>
            <button type="button" @click="openCreateMatch()">创建对局</button>
          </div>
          <div v-else class="match-list" :class="matchListClass">
            <article
              v-for="match in recentMatches"
              :key="match.id"
              class="match-row"
              @click="openMatch(match)"
            >
              <div class="match-emblem">
                <img :src="match.emblem" alt="" />
              </div>
              <div class="match-body">
                <div class="match-top">
                  <div class="match-title">
                    <strong>{{ match.name }}</strong>
                    <span :class="`tag tag--${match.tone}`">{{ match.mode }}</span>
                  </div>
                  <time>{{ match.date }}</time>
                </div>
                <div class="match-meta">
                  <div class="mini-avatars">
                    <img v-for="avatar in match.avatars" :key="avatar" :src="avatar" alt="" />
                  </div>
                  <span>{{ match.players }}</span>
                  <b :class="{ 'is-paused': match.status !== '已完成' }">{{ match.status }}</b>
                </div>
              </div>
            </article>
          </div>
        </div>

        <div class="panel modes-panel">
          <header class="panel__header">
            <h2>常用玩法场景</h2>
            <button type="button" @click="navigate('/game-modes')">
              更多场景
              <ChevronRight :size="20" />
            </button>
          </header>

          <div class="mode-grid">
            <article v-for="mode in gameModes" :key="mode.id" class="mode-card" @click="openCreateMatch(mode.id)">
              <img :src="mode.image" :alt="mode.name" />
              <div class="mode-card__body">
                <h3>{{ mode.name }}</h3>
                <p>{{ mode.desc }}</p>
                <span>
                  <Users :size="18" />
                  {{ mode.players }}
                </span>
              </div>
            </article>
          </div>
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
  height: 100%;
  min-width: 0;
  min-height: 0;
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

.home-main {
  position: relative;
  z-index: 2;
  height: 100%;
  padding: clamp(20px, 2.5vh, 28px) clamp(30px, 2.2vw, 38px) clamp(12px, 1.5vh, 16px);
  display: grid;
  grid-template-rows: minmax(320px, 0.92fr) minmax(0, 1fr);
  gap: clamp(12px, 1.5vh, 16px);
}

.hero {
  display: grid;
  grid-template-columns: minmax(390px, 0.58fr) minmax(0, 1.42fr);
  align-items: end;
  gap: 16px;
  min-height: clamp(318px, 36vh, 354px);
  height: 100%;
}

.hero-copy {
  position: relative;
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 290px;
  padding: clamp(22px, 4vh, 42px) 0 clamp(26px, 4.2vh, 44px) clamp(20px, 2.1vw, 34px);
}

.hero-copy h1 {
  display: grid;
  grid-template-columns: 178px 154px 28px;
  align-items: baseline;
  gap: 8px;
  width: 386px;
  min-height: 54px;
  margin: 0;
  color: #10194e;
  font-size: clamp(28px, 2.28vw, 36px);
  font-weight: 700;
  line-height: 1.08;
  white-space: nowrap;
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
  width: min(430px, 100%);
  min-height: 34px;
  margin: 18px 0 0;
  color: #526099;
  font-size: clamp(15px, 1.12vw, 18px);
  font-weight: 400;
  letter-spacing: 0;
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
  display: grid;
  grid-template-columns: 192px 182px;
  align-items: center;
  gap: 12px;
  min-height: 70px;
  margin-top: clamp(28px, 3.5vh, 36px);
}

.primary-action,
.secondary-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: clamp(58px, 7vh, 68px);
  border-radius: 999px;
  border: 1px solid rgba(123, 128, 209, 0.22);
  font-size: clamp(16px, 1.18vw, 20px);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, border-color 0.2s ease;
}

.primary-action {
  width: 192px;
  color: white;
  background: linear-gradient(180deg, #7774ff 0%, #5757f2 100%);
  box-shadow: 0 16px 28px rgba(88, 80, 239, 0.28);
}

.secondary-action {
  width: 182px;
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
  display: grid;
  grid-template-columns: repeat(6, minmax(126px, 1fr));
  align-items: end;
  gap: 8px;
  padding-bottom: 12px;
  overflow: visible;
}

.character-card {
  --accent: #7568ff;
  --badge-bg: #fff;
  position: relative;
  display: block;
  min-width: 0;
  height: clamp(238px, 28vh, 278px);
  perspective: 900px;
  transform-origin: 50% 86%;
  transition: transform 0.62s cubic-bezier(0.16, 1, 0.3, 1), filter 0.42s ease, z-index 0s linear;
}

.character-card:hover {
  transform: translateY(-8px) scale(1.045) rotateX(2deg);
  filter: drop-shadow(0 18px 24px rgba(82, 91, 168, 0.18));
}

.character-card--speaking {
  z-index: 6;
  transform: translateY(-17px) scale(1.16);
  filter: drop-shadow(0 24px 30px rgba(82, 91, 168, 0.22));
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
  height: 114%;
  object-fit: cover;
  object-position: center 10%;
  transform: scale(1.06);
  transition: transform 0.24s ease;
  filter: saturate(1.04);
}

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

.character-card strong {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  z-index: 3;
  display: grid;
  place-items: center;
  height: 31px;
  color: var(--accent);
  font-size: clamp(11px, 0.82vw, 13px);
  font-weight: 560;
  opacity: 0.78;
  border: 1px solid color-mix(in srgb, var(--accent) 32%, white);
  border-radius: 12px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.22)), var(--badge-bg);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.88), 0 10px 18px rgba(84, 93, 166, 0.12);
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(500px, 0.62fr) minmax(0, 1fr);
  gap: 18px;
  min-height: 0;
}

.panel {
  min-height: 0;
  height: 100%;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  overflow: hidden;
  padding: clamp(16px, 2.2vh, 22px) clamp(18px, 1.5vw, 24px);
  border: 1px solid rgba(255, 255, 255, 0.72);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.85), 0 20px 44px rgba(91, 101, 174, 0.1);
  backdrop-filter: blur(20px);
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel__header h2 {
  margin: 0;
  font-size: 21px;
  line-height: 1;
  font-weight: 680;
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

.match-list {
  display: grid;
  gap: 12px;
  min-height: 0;
  align-content: start;
  overflow: hidden;
}

.match-list--single {
  grid-template-rows: max-content max-content;
  align-content: start;
}

.match-list--single::after {
  content: '继续最近一场，或者从右侧选择一个玩法开新局。';
  display: grid;
  place-items: center;
  min-height: 64px;
  padding: 12px 14px;
  border: 1px dashed rgba(115, 110, 240, 0.22);
  border-radius: 16px;
  color: rgba(82, 96, 153, 0.72);
  font-size: 13px;
  background: rgba(255, 255, 255, 0.38);
}

.match-list--compact {
  gap: 10px;
}

.match-list-empty {
  display: grid;
  align-content: center;
  justify-items: start;
  gap: 10px;
  height: 100%;
  padding: 12px;
  color: var(--muted);
  font-size: 14px;
}

.match-list-empty strong {
  color: #17205a;
  font-size: 17px;
}

.match-list-empty button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  color: #fff;
  background: linear-gradient(180deg, #7774ff, #5b57f3);
  cursor: pointer;
}

.match-row {
  display: grid;
  grid-template-columns: 60px minmax(0, 1fr);
  gap: 14px;
  align-items: center;
  align-self: start;
  min-height: 86px;
  padding: 12px 13px;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.62);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
}

.match-list--single .match-row {
  min-height: 94px;
}

.match-list--compact .match-row {
  min-height: 78px;
  padding-block: 10px;
}

.match-row:hover {
  transform: translateX(2px);
  border-color: rgba(103, 98, 240, 0.32);
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 10px 18px rgba(79, 88, 161, 0.08);
}

.match-emblem {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  overflow: hidden;
  background: #1a2758;
  box-shadow: inset 0 0 0 3px rgba(255, 255, 255, 0.18), 0 10px 16px rgba(36, 42, 91, 0.14);
}

.match-emblem img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.match-body {
  min-width: 0;
}

.match-top,
.match-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.match-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.match-title strong {
  overflow: hidden;
  color: #17205a;
  font-size: 16px;
  font-weight: 620;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag {
  flex: 0 0 auto;
  padding: 4px 9px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.tag--classic {
  color: #7060f4;
  background: #eee9ff;
}

.tag--advanced,
.tag--fun {
  color: #ec7c2e;
  background: #fff0df;
}

.match-top time {
  flex: 0 0 auto;
  color: #6973a1;
  font-size: 12px;
  font-weight: 500;
}

.match-meta {
  justify-content: flex-start;
  margin-top: 13px;
  color: #6973a1;
  font-size: 13px;
}

.match-meta b {
  margin-left: auto;
  color: #24b66a;
  font-size: 13px;
  font-weight: 560;
}

.match-meta b.is-paused {
  color: #f07836;
}

.mini-avatars {
  display: flex;
  align-items: center;
}

.mini-avatars img {
  width: 23px;
  height: 23px;
  margin-left: -5px;
  border: 2px solid #fff;
  border-radius: 50%;
  object-fit: cover;
  background: #fff;
}

.mini-avatars img:first-child {
  margin-left: 0;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(135px, 1fr));
  gap: 12px;
  min-height: 0;
}

.mode-card {
  overflow: hidden;
  min-width: 0;
  position: relative;
  border: 1px solid rgba(130, 142, 207, 0.2);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.mode-card::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 0 0 rgba(113, 103, 255, 0);
  transition: box-shadow 0.22s ease;
}

.mode-card:hover {
  transform: translateY(-5px) scale(1.01);
  box-shadow: 0 18px 34px rgba(85, 95, 165, 0.18);
  border-color: rgba(103, 98, 240, 0.28);
}

.mode-card:hover::after {
  box-shadow: inset 0 0 0 2px rgba(113, 103, 255, 0.18);
}

.mode-card:hover h3,
.mode-card:hover span {
  color: #4f4bf1;
}

.mode-card img {
  display: block;
  width: 100%;
  height: min(56%, 184px);
  flex: 0 0 auto;
  object-fit: cover;
  transition: transform 0.25s ease;
}

.mode-card:hover img {
  transform: scale(1.045);
}

.mode-card__body {
  flex: 1;
  min-height: 100px;
  padding: clamp(12px, 1.6vh, 16px) 16px clamp(10px, 1.4vh, 14px);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.68));
}

.mode-card h3 {
  margin: 0;
  color: #17205a;
  font-size: 19px;
  font-weight: 700;
}

.mode-card p {
  margin: 8px 0 15px;
  color: #6973a1;
  font-size: 13px;
}

.mode-card span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #6973a1;
  font-size: 13px;
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
    grid-template-columns: 430px 1fr;
  }

  .character-stage {
    gap: 6px;
  }

  .mode-card img {
    height: 170px;
  }
}

@media (max-width: 1120px) {
  .hero,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .character-stage {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .mode-grid {
    grid-template-columns: repeat(2, minmax(180px, 1fr));
  }
}
</style>
