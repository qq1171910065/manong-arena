<script setup lang="ts">
import { CloudDownload, FolderOpen, Loader2, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { NAlert } from '@renderer/ui'
import {
  runStarterInit,
  STARTER_INIT_STEPS,
  STARTER_INIT_TOTAL,
  StarterAssetFetchError,
  type StarterInitProgress,
} from '@renderer/services/arena/starter-init-service'
import {
  importStarterAssetsFromZip,
  skipStarterAssetsWithBundled,
} from '@renderer/services/arena/starter-assets-step'
import { isRemoteAssetDownloadAvailable, isUserAssetPackInstalled } from '@renderer/services/arena/asset-pack-service'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'

const emit = defineEmits<{
  complete: []
}>()

defineProps<{
  appName: string
}>()

type InitPhase = {
  id: 'assets' | 'initData'
  label: string
  startIndex: number
  count: number
}

const RING_CIRCUMFERENCE = 2 * Math.PI * 18

const INIT_PHASES: InitPhase[] = (() => {
  const phases: InitPhase[] = []
  let start = 0
  for (const kind of ['assets', 'initData'] as const) {
    const count = STARTER_INIT_STEPS.filter((step) => step.kind === kind).length
    if (!count) continue
    phases.push({
      id: kind,
      label: kind === 'assets' ? '初始素材' : '初始化数据',
      startIndex: start,
      count,
    })
    start += count
  }
  return phases
})()

type ViewMode = 'choose-assets' | 'running'

const viewMode = ref<ViewMode>('choose-assets')
const assetsCheckDone = ref(false)
const remoteDownloadAvailable = ref(false)

const progress = ref<StarterInitProgress>({
  index: 0,
  total: STARTER_INIT_TOTAL,
  label: '',
  percent: 0,
  step: null,
})
const running = ref(false)
const error = ref('')
const assetFetchFailed = ref(false)
const assetFetchMessage = ref('')
const assetActionBusy = ref(false)
const assetImportError = ref('')

const loginBgStyle = {
  '--arena-login-bg': `url(${arenaHomeAssets.bgClean})`,
}

const assetChoiceDescription = computed(() => {
  if (remoteDownloadAvailable.value) {
    return '角色立绘与玩法封面需单独安装。请选择从远程下载完整素材包，或从本地选择 zip 压缩包导入。'
  }
  return '角色立绘与玩法封面需单独安装。请从本地选择 zip 压缩包导入，或跳过并使用内置默认素材。'
})

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
  return '正在导入内置角色与玩法数据'
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

  return '正在导入 16 个内置 AI 角色与全部默认玩法…'
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

function isStarterAssetError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false
  return /找不到素材包|初始素材|素材包|素材下载|素材准备/.test(error.message)
}

async function startInit(fromIndex = 0, skipAssets = false) {
  viewMode.value = 'running'
  running.value = true
  error.value = ''
  assetFetchFailed.value = false
  assetFetchMessage.value = ''
  try {
    await runStarterInit((next) => {
      progress.value = next
    }, { startIndex: fromIndex, skipAssets })
    emit('complete')
  } catch (e) {
    if (e instanceof StarterAssetFetchError || isStarterAssetError(e)) {
      assetFetchFailed.value = true
      assetFetchMessage.value = e instanceof Error ? e.message : '初始素材准备失败'
      running.value = false
      return
    }
    error.value = e instanceof Error ? e.message : '初始化失败，请重试'
    running.value = false
  }
}

async function skipOnlineAssets() {
  viewMode.value = 'running'
  assetActionBusy.value = true
  error.value = ''
  try {
    const assetsStep = STARTER_INIT_STEPS[0]
    await skipStarterAssetsWithBundled((next) => {
      progress.value = next
    }, 0, assetsStep.label)
    await startInit(1, true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '跳过失败，请重试'
    running.value = false
  } finally {
    assetActionBusy.value = false
  }
}

async function importAssetsZip(
  options: { returnToChoiceOnCancel?: boolean; deferRunningView?: boolean } = {}
) {
  if (!options.deferRunningView) {
    viewMode.value = 'running'
    running.value = true
  }
  assetActionBusy.value = true
  error.value = ''
  assetImportError.value = ''
  assetFetchFailed.value = false
  assetFetchMessage.value = ''
  try {
    const assetsStep = STARTER_INIT_STEPS[0]
    await importStarterAssetsFromZip((next) => {
      progress.value = next
    }, 0, assetsStep.label)
    viewMode.value = 'running'
    running.value = true
    await startInit(1, true)
  } catch (e) {
    if (e instanceof StarterAssetFetchError && e.message === '已取消导入素材包') {
      if (options.returnToChoiceOnCancel) {
        viewMode.value = 'choose-assets'
        running.value = false
        return
      }
      assetFetchFailed.value = true
      assetFetchMessage.value = e.message
      running.value = false
      return
    }
    const message = e instanceof Error ? e.message : '导入失败，请重试'
    if (options.returnToChoiceOnCancel || options.deferRunningView) {
      viewMode.value = 'choose-assets'
      running.value = false
      assetImportError.value = message
      return
    }
    if (e instanceof StarterAssetFetchError) {
      assetFetchFailed.value = true
      assetFetchMessage.value = message
    } else {
      error.value = message
    }
    running.value = false
  } finally {
    assetActionBusy.value = false
  }
}

async function chooseRemoteDownload() {
  viewMode.value = 'running'
  await startInit(0, false)
}

async function chooseLocalZip() {
  await importAssetsZip({ returnToChoiceOnCancel: true, deferRunningView: true })
}

async function retryOnlineAssets() {
  await startInit(0, false)
}

function backToAssetChoice() {
  assetFetchFailed.value = false
  assetFetchMessage.value = ''
  assetImportError.value = ''
  error.value = ''
  running.value = false
  viewMode.value = 'choose-assets'
}

onMounted(async () => {
  remoteDownloadAvailable.value = await isRemoteAssetDownloadAvailable().catch(() => false)
  const installed = await isUserAssetPackInstalled().catch(() => false)
  assetsCheckDone.value = true
  if (installed) {
    viewMode.value = 'running'
    void startInit()
    return
  }
  viewMode.value = 'choose-assets'
})
</script>

<template>
  <div class="arena-starter-init" :style="loginBgStyle">
    <header class="arena-starter-init__nav">
      <img class="arena-starter-init__brand" :src="arenaHomeAssets.brandLockup" :alt="appName" />
    </header>

    <main class="arena-starter-init__body">
      <div class="arena-starter-init__card">
        <div class="arena-starter-init__icon" :class="{ 'is-running': running && viewMode === 'running' }">
          <Sparkles v-if="viewMode === 'choose-assets' || (!running && error)" :size="28" />
          <Loader2 v-else :size="28" class="spin" />
        </div>

        <p class="arena-starter-init__eyebrow">FIRST SETUP</p>
        <h1 class="arena-starter-init__title">
          {{ viewMode === 'choose-assets' ? '准备初始素材' : '正在准备你的竞技空间' }}
        </h1>
        <p class="arena-starter-init__desc">
          {{
            viewMode === 'choose-assets'
              ? assetChoiceDescription
              : '首次进入将初始化角色与玩法，完成后即可进入大厅。'
          }}
        </p>

        <div v-if="!assetsCheckDone" class="arena-starter-init__checking" role="status">
          <Loader2 :size="18" class="spin" />
          <span>正在检查本地素材…</span>
        </div>

        <div v-else-if="viewMode === 'choose-assets'" class="arena-starter-init__asset-choice">
          <NAlert
            v-if="assetImportError"
            type="error"
            :bordered="false"
            class="arena-starter-init__asset-choice-error"
          >
            {{ assetImportError }}
          </NAlert>
          <button
            v-if="remoteDownloadAvailable"
            type="button"
            class="arena-starter-init__asset-option"
            :disabled="assetActionBusy"
            @click="chooseRemoteDownload"
          >
            <span class="arena-starter-init__asset-option-icon">
              <CloudDownload :size="22" />
            </span>
            <span class="arena-starter-init__asset-option-body">
              <strong>从远程下载</strong>
              <span>自动下载完整素材包（推荐）</span>
            </span>
          </button>
          <button
            type="button"
            class="arena-starter-init__asset-option"
            :disabled="assetActionBusy"
            @click="chooseLocalZip"
          >
            <span class="arena-starter-init__asset-option-icon">
              <FolderOpen :size="22" />
            </span>
            <span class="arena-starter-init__asset-option-body">
              <strong>选择本地 zip</strong>
              <span>导入 zip（需含 character-packs 与 game-mode-packs）</span>
            </span>
          </button>
          <p v-if="assetActionBusy" class="arena-starter-init__asset-choice-busy" role="status">
            <Loader2 :size="16" class="spin" />
            <span>正在打开文件选择器…</span>
          </p>
          <button
            type="button"
            class="arena-starter-init__asset-skip"
            :disabled="assetActionBusy"
            @click="skipOnlineAssets"
          >
            跳过，使用内置默认素材
          </button>
        </div>

        <template v-else>
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

        <NAlert v-if="assetFetchFailed" type="warning" :bordered="false" class="arena-starter-init__error">
          <p class="arena-starter-init__asset-alert-title">未能获取线上完整素材包</p>
          <p class="arena-starter-init__asset-alert-desc">{{ assetFetchMessage }}</p>
          <p class="arena-starter-init__asset-alert-desc">
            你可以跳过并使用内置默认素材（纯色占位），或从本地选择 zip 导入完整素材包。
          </p>
          <div class="arena-starter-init__asset-actions">
            <button type="button" class="arena-starter-init__retry" :disabled="assetActionBusy" @click="skipOnlineAssets">
              跳过，使用默认素材
            </button>
            <button type="button" class="arena-starter-init__retry" :disabled="assetActionBusy" @click="() => importAssetsZip()">
              导入本地 zip
            </button>
            <button
              v-if="remoteDownloadAvailable"
              type="button"
              class="arena-starter-init__retry"
              :disabled="assetActionBusy"
              @click="retryOnlineAssets"
            >
              重试下载
            </button>
            <button type="button" class="arena-starter-init__retry" :disabled="assetActionBusy" @click="backToAssetChoice">
              重新选择
            </button>
          </div>
        </NAlert>

        <NAlert v-else-if="error" type="error" :bordered="false" class="arena-starter-init__error">
          {{ error }}
          <button type="button" class="arena-starter-init__retry" @click="startInit()">重试</button>
        </NAlert>
        </template>
      </div>
    </main>
  </div>
</template>

<style scoped src="./starter-init.css"></style>
