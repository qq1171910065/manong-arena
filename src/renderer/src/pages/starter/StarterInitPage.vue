<script setup lang="ts">
import { Loader2, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { NAlert } from '@renderer/ui'
import {
  runStarterInit,
  STARTER_INIT_STEPS,
  STARTER_INIT_TOTAL,
  type StarterInitProgress,
} from '@renderer/services/arena/starter-init-service'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'

const emit = defineEmits<{
  complete: []
}>()

defineProps<{
  appName: string
}>()

type InitPhase = {
  id: 'assets' | 'character' | 'gameMode'
  label: string
  startIndex: number
  count: number
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 18

const INIT_PHASES: InitPhase[] = (() => {
  const phases: InitPhase[] = []
  let start = 0
  for (const kind of ['assets', 'character', 'gameMode'] as const) {
    const count = STARTER_INIT_STEPS.filter((step) => step.kind === kind).length
    if (!count) continue
    phases.push({
      id: kind,
      label: kind === 'assets' ? '初始素材' : kind === 'character' ? 'AI 角色' : '默认玩法',
      startIndex: start,
      count,
    })
    start += count
  }
  return phases
})()

const progress = ref<StarterInitProgress>({
  index: 0,
  total: STARTER_INIT_TOTAL,
  label: '',
  percent: 0,
  step: null,
})
const running = ref(true)
const error = ref('')

const loginBgStyle = {
  '--arena-login-bg': `url(${arenaHomeAssets.bgClean})`,
}

function findPhase(id: InitPhase['id']): InitPhase {
  return INIT_PHASES.find((phase) => phase.id === id) || INIT_PHASES[0]
}

const progressHint = computed(() => {
  if (progress.value.label === '完成' || progress.value.percent >= 100) {
    return '初始化完成'
  }
  const step = progress.value.step
  if (!step) return '正在启动初始化…'
  if (step.kind === 'assets') return '正在导入初始素材包'
  if (step.kind === 'gameMode') return '正在导入默认玩法'
  return '正在导入内置 AI 角色'
})

const progressDetail = computed(() => {
  if (progress.value.label === '完成' || progress.value.percent >= 100) {
    return '角色、玩法与视觉素材已就绪，即将进入大厅…'
  }

  const step = progress.value.step
  if (!step) return '正在检查本地环境与素材缓存…'

  if (step.kind === 'assets') {
    if (progress.value.assetPhase === 'download') {
      return `正在下载角色立绘与玩法素材（${Math.max(progress.value.percent, 1)}%）…`
    }
    if (progress.value.assetPhase === 'verify') return '正在校验素材包完整性（SHA256）…'
    if (progress.value.assetPhase === 'extract') return '正在解压素材到本地目录…'
    return '正在准备 character-packs 与 game-mode-packs…'
  }

  if (step.kind === 'character') {
    const phase = findPhase('character')
    const localIndex = Math.max(1, progress.value.index - phase.startIndex + 1)
    return `正在创建角色 ${localIndex}/${phase.count}：${step.label}`
  }

  const phase = findPhase('gameMode')
  const localIndex = Math.max(1, progress.value.index - phase.startIndex + 1)
  return `正在安装玩法 ${localIndex}/${phase.count}：${step.label}`
})

function phaseStatus(phase: InitPhase): 'pending' | 'active' | 'done' {
  const { index, percent } = progress.value
  const end = phase.startIndex + phase.count - 1
  if (percent >= 100 || index > end) return 'done'
  if (index >= phase.startIndex && index <= end) return 'active'
  return 'pending'
}

function phaseRingPercent(phase: InitPhase): number {
  const { index, percent } = progress.value
  const end = phase.startIndex + phase.count - 1
  if (percent >= 100 || index > end) return 100
  if (index < phase.startIndex) return 0

  if (phase.id === 'assets' && index === phase.startIndex) {
    const basePct = (phase.startIndex / STARTER_INIT_TOTAL) * 100
    const spanPct = (phase.count / STARTER_INIT_TOTAL) * 100
    if (spanPct <= 0) return 0
    return Math.min(99, Math.max(4, Math.round(((percent - basePct) / spanPct) * 100)))
  }

  const doneInPhase = index - phase.startIndex
  return Math.min(99, Math.round(((doneInPhase + 0.45) / phase.count) * 100))
}

function phaseShowCheck(phase: InitPhase): boolean {
  if (phaseStatus(phase) === 'pending') return false
  return phaseRingPercent(phase) >= 100
}

function connectorFilled(phaseIndex: number): boolean {
  const phase = INIT_PHASES[phaseIndex]
  if (!phase) return false
  return phaseShowCheck(phase)
}

function ringDashOffset(ringPercent: number): number {
  return RING_CIRCUMFERENCE * (1 - ringPercent / 100)
}

async function startInit() {
  running.value = true
  error.value = ''
  try {
    await runStarterInit((next) => {
      progress.value = next
    })
    emit('complete')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '初始化失败，请重试'
    running.value = false
  }
}

onMounted(() => {
  void startInit()
})
</script>

<template>
  <div class="arena-starter-init" :style="loginBgStyle">
    <header class="arena-starter-init__nav">
      <img class="arena-starter-init__brand" :src="arenaHomeAssets.brandLockup" :alt="appName" />
    </header>

    <main class="arena-starter-init__body">
      <div class="arena-starter-init__card">
        <div class="arena-starter-init__icon" :class="{ 'is-running': running }">
          <Sparkles v-if="!running && error" :size="28" />
          <Loader2 v-else :size="28" class="spin" />
        </div>

        <p class="arena-starter-init__eyebrow">FIRST SETUP</p>
        <h1 class="arena-starter-init__title">正在准备你的竞技空间</h1>
        <p class="arena-starter-init__desc">首次进入将下载素材并初始化角色与玩法，完成后即可进入大厅。</p>

        <div
          class="arena-starter-init__progress"
          role="progressbar"
          :aria-valuenow="progress.percent"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div class="arena-starter-init__progress-track">
            <div class="arena-starter-init__progress-fill" :style="{ width: `${progress.percent}%` }" />
          </div>
          <div class="arena-starter-init__progress-meta">
            <span class="arena-starter-init__progress-label">{{ progressHint }}</span>
            <span class="arena-starter-init__progress-percent">{{ progress.percent }}%</span>
          </div>
          <p class="arena-starter-init__progress-detail">{{ progressDetail }}</p>
        </div>

        <div class="arena-starter-init__phase-bar" aria-label="初始化步骤">
          <template v-for="(phase, phaseIndex) in INIT_PHASES" :key="phase.id">
            <div
              class="arena-starter-init__phase"
              :class="[`is-${phaseStatus(phase)}`, `is-${phase.id}`, { 'is-checked': phaseShowCheck(phase) }]"
            >
              <div
                class="arena-starter-init__phase-ring"
                :aria-label="`${phase.label} ${phaseRingPercent(phase)}%`"
              >
                <svg viewBox="0 0 44 44" aria-hidden="true">
                  <circle class="arena-starter-init__ring-track" cx="22" cy="22" r="18" />
                  <circle
                    class="arena-starter-init__ring-fill"
                    cx="22"
                    cy="22"
                    r="18"
                    :style="{ strokeDashoffset: ringDashOffset(phaseRingPercent(phase)) }"
                  />
                </svg>
                <span class="arena-starter-init__phase-core">
                  <svg
                    v-if="phaseShowCheck(phase)"
                    class="arena-starter-init__phase-check"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      class="arena-starter-init__phase-check-path"
                      d="M7 12.5 L10.5 16 L17 9.5"
                      pathLength="1"
                    />
                  </svg>
                  <Loader2
                    v-else-if="phaseStatus(phase) === 'active'"
                    :size="16"
                    class="spin arena-starter-init__phase-loader"
                    stroke-width="2.5"
                  />
                  <span v-else class="arena-starter-init__phase-index">{{ phaseIndex + 1 }}</span>
                </span>
              </div>
              <span class="arena-starter-init__phase-label">{{ phase.label }}</span>
            </div>
            <div
              v-if="phaseIndex < INIT_PHASES.length - 1"
              class="arena-starter-init__phase-connector"
              :class="{ 'is-filled': connectorFilled(phaseIndex) }"
              aria-hidden="true"
            />
          </template>
        </div>

        <NAlert v-if="error" type="error" :bordered="false" class="arena-starter-init__error">
          {{ error }}
          <button type="button" class="arena-starter-init__retry" @click="startInit">重试</button>
        </NAlert>
      </div>
    </main>
  </div>
</template>

<style scoped src="./starter-init.css"></style>
