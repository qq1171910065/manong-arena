import { applyAppearance, THEME_PRESETS } from '@renderer/composables/useTheme'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { DEFAULT_ARENA_MODEL_ID } from '@shared/arena/constants'
import { cloneJson } from '@shared/clone-json'
import type { ArenaSettings } from '@shared/arena/types'
import type { ThemeId } from '@shared/types'

type ToneKind = 'click' | 'success' | 'warn' | 'step'

const SCALE_MAP: Record<ArenaSettings['uiScale'], string> = {
  100: '1',
  125: '1.125',
  150: '1.25',
}

const SFX_FILES: Record<ToneKind, string> = {
  click: 'sfx-click.ogg',
  success: 'sfx-success.ogg',
  warn: 'sfx-warn.ogg',
  step: 'sfx-step.ogg',
}

function arenaAudioUrl(file: string): string {
  const base = import.meta.env.BASE_URL || './'
  return `${base}audio/${file}`
}

let currentSettings: ArenaSettings | null = null
let audioContext: AudioContext | null = null
let bgmAudio: HTMLAudioElement | null = null
let sfxBuffers = new Map<ToneKind, AudioBuffer>()
let sfxLoadPromise: Promise<void> | null = null
let activeTtsSource: AudioBufferSourceNode | null = null
let activeTtsGain: GainNode | null = null
let unlocked = false
let hostWindowKind: 'main' | 'match-room' | 'login' = 'main'
let hostWindowVisible = true
let systemSchemeMedia: MediaQueryList | null = null
let systemSchemeListener: ((event: MediaQueryListEvent) => void) | null = null
let visibilityListenerBound = false

function syncHostWindowVisible(): void {
  if (typeof document === 'undefined') return
  hostWindowVisible = document.visibilityState !== 'hidden'
}

function onHostVisibilityChange(): void {
  syncHostWindowVisible()
  if (currentSettings) syncBgm(currentSettings)
}

function ensureHostVisibilityListener(): void {
  if (visibilityListenerBound || typeof document === 'undefined') return
  visibilityListenerBound = true
  syncHostWindowVisible()
  document.addEventListener('visibilitychange', onHostVisibilityChange)
}

function shouldPlayBgm(settings: ArenaSettings): boolean {
  if (!settings.bgmEnabled || !unlocked) return false
  if (hostWindowKind === 'login') return false
  if (hostWindowKind === 'main' && !hostWindowVisible) return false
  return true
}

export function setArenaAudioHostWindow(kind: 'main' | 'match-room' | 'login'): void {
  hostWindowKind = kind
  ensureHostVisibilityListener()
  if (currentSettings) syncBgm(currentSettings)
}

function syncSystemSchemeListener(settings: ArenaSettings): void {
  if (typeof window === 'undefined') return

  if (settings.themeMode !== 'system') {
    if (systemSchemeMedia && systemSchemeListener) {
      systemSchemeMedia.removeEventListener('change', systemSchemeListener)
    }
    systemSchemeMedia = null
    systemSchemeListener = null
    return
  }

  systemSchemeMedia ||= window.matchMedia('(prefers-color-scheme: dark)')
  if (!systemSchemeListener) {
    systemSchemeListener = () => {
      if (currentSettings?.themeMode !== 'system') return
      const defaultThemeId = getRuntimeConfig().themeId
      applyAppearance(resolveThemeId(currentSettings), 'system', defaultThemeId)
    }
    systemSchemeMedia.addEventListener('change', systemSchemeListener)
  }
}

function resolveThemeId(settings: ArenaSettings): ThemeId {
  const fallback = getRuntimeConfig().themeId
  return settings.themeId in THEME_PRESETS ? settings.themeId : fallback
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioCtor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioCtor) return null
  audioContext ||= new AudioCtor()
  return audioContext
}

function getBgmAudio(): HTMLAudioElement {
  if (!bgmAudio) {
    bgmAudio = new Audio(arenaAudioUrl('bgm-loop.ogg'))
    bgmAudio.loop = true
    bgmAudio.preload = 'auto'
  }
  return bgmAudio
}

function stopBgm(): void {
  if (!bgmAudio) return
  bgmAudio.pause()
  bgmAudio.currentTime = 0
}

function startBgm(settings: ArenaSettings): void {
  if (!shouldPlayBgm(settings)) {
    stopBgm()
    return
  }

  const audio = getBgmAudio()
  audio.volume = Math.max(0, Math.min(1, settings.bgmVolume / 100)) * 0.42
  if (audio.paused) {
    void audio.play().catch(() => {
      // Autoplay may be blocked until the next user gesture.
    })
  }
}

function syncBgm(settings: ArenaSettings): void {
  if (!shouldPlayBgm(settings)) {
    stopBgm()
    return
  }
  const audio = getBgmAudio()
  audio.volume = Math.max(0, Math.min(1, settings.bgmVolume / 100)) * 0.42
  startBgm(settings)
}

async function ensureSfxLoaded(): Promise<void> {
  if (sfxLoadPromise) return sfxLoadPromise
  sfxLoadPromise = (async () => {
    const context = getAudioContext()
    if (!context) return
    await Promise.all(
      (Object.entries(SFX_FILES) as Array<[ToneKind, string]>).map(async ([kind, file]) => {
        if (sfxBuffers.has(kind)) return
        try {
          const response = await fetch(arenaAudioUrl(file))
          if (!response.ok) return
          const raw = await response.arrayBuffer()
          const buffer = await context.decodeAudioData(raw.slice(0))
          sfxBuffers.set(kind, buffer)
        } catch {
          // Ignore failed decode; fall back to silent playback.
        }
      })
    )
  })()
  return sfxLoadPromise
}

function preloadArenaAudioAssets(): void {
  void ensureSfxLoaded()
  getBgmAudio().load()
}

export function unlockArenaAudio(): void {
  unlocked = true
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume()
  preloadArenaAudioAssets()
  if (currentSettings) syncBgm(currentSettings)
}

export function stopArenaTtsPlayback(): void {
  if (activeTtsSource) {
    try {
      activeTtsSource.stop()
    } catch {
      // Already stopped.
    }
    activeTtsSource.disconnect()
    activeTtsSource = null
  }
  activeTtsGain?.disconnect()
  activeTtsGain = null
}

export async function playArenaAudioBuffer(
  buffer: ArrayBuffer,
  volume: number,
  playbackRate = 1
): Promise<void> {
  unlockArenaAudio()
  const context = getAudioContext()
  if (!context) throw new Error('当前环境不支持音频播放')
  if (context.state === 'suspended') await context.resume()

  stopArenaTtsPlayback()

  const copy = buffer.slice(0)
  let audioBuffer: AudioBuffer
  try {
    audioBuffer = await context.decodeAudioData(copy)
  } catch {
    throw new Error('无法解码语音数据，请确认网关 TTS 返回有效音频')
  }

  const gainValue = Math.max(0, Math.min(1, volume))
  const rate = Math.max(0.85, Math.min(1.35, playbackRate))

  return new Promise((resolve, reject) => {
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = audioBuffer
    source.playbackRate.value = rate
    gain.gain.value = gainValue
    source.connect(gain)
    gain.connect(context.destination)
    activeTtsSource = source
    activeTtsGain = gain

    const cleanup = () => {
      if (activeTtsSource === source) {
        activeTtsSource = null
        activeTtsGain = null
      }
    }

    source.onended = () => {
      cleanup()
      resolve()
    }

    try {
      source.start(0)
    } catch (err) {
      cleanup()
      reject(err instanceof Error ? err : new Error('音频播放启动失败'))
    }
  })
}

export function playArenaTone(kind: ToneKind = 'click'): void {
  const settings = currentSettings
  if (!settings?.sfxEnabled || !unlocked) return

  void ensureSfxLoaded().then(() => {
    const context = getAudioContext()
    if (!context) return
    if (context.state === 'suspended') void context.resume()

    const buffer = sfxBuffers.get(kind)
    if (!buffer) return

    const volume = Math.max(0, Math.min(1, settings.sfxVolume / 100))
    const source = context.createBufferSource()
    const gain = context.createGain()
    source.buffer = buffer
    gain.gain.value = volume * 0.9
    source.connect(gain)
    gain.connect(context.destination)
    source.start(0)
  })
}

export function notifyArenaSettingsChange(settings: ArenaSettings): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('arena:settings-change', { detail: cloneJson(settings) }))
}

export function applyArenaSettingsEffects(settings: ArenaSettings): void {
  const plain = cloneJson(settings)
  currentSettings = plain
  ensureHostVisibilityListener()
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const scale = SCALE_MAP[plain.uiScale] || '1'
    root.dataset.arenaScale = String(plain.uiScale)
    root.dataset.arenaMotion = plain.animationEnabled ? 'on' : 'off'
    root.dataset.arenaDensity = plain.compactLayout ? 'compact' : 'comfortable'
    root.dataset.arenaGlass = plain.glassEffect ? 'on' : 'off'
    root.style.setProperty('--arena-ui-scale', scale)
  }

  const defaultThemeId = getRuntimeConfig().themeId
  const themeId = resolveThemeId(plain)
  applyAppearance(themeId, plain.themeMode, defaultThemeId)
  syncSystemSchemeListener(plain)

  preloadArenaAudioAssets()
  syncBgm(plain)
}

export function getAppliedArenaSettings(): ArenaSettings | null {
  return currentSettings ? cloneJson(currentSettings) : null
}

export function getFallbackModelId(): string {
  return currentSettings?.defaultModelId?.trim() || DEFAULT_ARENA_MODEL_ID
}
