import { applyAppearance, THEME_PRESETS } from '@renderer/composables/useTheme'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import type { ArenaSettings } from '@shared/arena/types'
import type { ThemeId } from '@shared/types'

type ToneKind = 'click' | 'success' | 'warn' | 'step'

const SCALE_MAP: Record<ArenaSettings['uiScale'], string> = {
  100: '1',
  125: '1.125',
  150: '1.25',
}

let currentSettings: ArenaSettings | null = null
let audioContext: AudioContext | null = null
let bgmGain: GainNode | null = null
let bgmOscillators: OscillatorNode[] = []
let unlocked = false
let systemSchemeMedia: MediaQueryList | null = null
let systemSchemeListener: ((event: MediaQueryListEvent) => void) | null = null

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

function stopBgm(): void {
  for (const oscillator of bgmOscillators) {
    try {
      oscillator.stop()
    } catch {
      // Already stopped.
    }
    oscillator.disconnect()
  }
  bgmOscillators = []
  bgmGain?.disconnect()
  bgmGain = null
}

function startBgm(settings: ArenaSettings): void {
  if (!settings.bgmEnabled || !unlocked) {
    stopBgm()
    return
  }

  const context = getAudioContext()
  if (!context || bgmOscillators.length) return

  bgmGain = context.createGain()
  bgmGain.gain.value = Math.max(0, Math.min(1, settings.bgmVolume / 100)) * 0.045
  bgmGain.connect(context.destination)

  const filter = context.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = 780
  filter.connect(bgmGain)

  for (const [index, frequency] of [261.63, 329.63, 392].entries()) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = index === 1 ? 'triangle' : 'sine'
    oscillator.frequency.value = frequency / (index === 2 ? 2 : 1)
    gain.gain.value = index === 1 ? 0.26 : 0.18
    oscillator.connect(gain)
    gain.connect(filter)
    oscillator.start()
    bgmOscillators.push(oscillator)
  }
}

function syncBgm(settings: ArenaSettings): void {
  if (!settings.bgmEnabled || !unlocked) {
    stopBgm()
    return
  }
  startBgm(settings)
  if (bgmGain) bgmGain.gain.value = Math.max(0, Math.min(1, settings.bgmVolume / 100)) * 0.045
}

export function unlockArenaAudio(): void {
  unlocked = true
  const context = getAudioContext()
  if (context?.state === 'suspended') void context.resume()
  if (currentSettings) syncBgm(currentSettings)
}

export function playArenaTone(kind: ToneKind = 'click'): void {
  const settings = currentSettings
  if (!settings?.sfxEnabled || !unlocked) return
  const context = getAudioContext()
  if (!context) return
  if (context.state === 'suspended') void context.resume()

  const gain = context.createGain()
  const oscillator = context.createOscillator()
  const volume = Math.max(0, Math.min(1, settings.sfxVolume / 100))
  const now = context.currentTime
  const frequencies: Record<ToneKind, number> = {
    click: 660,
    success: 880,
    warn: 220,
    step: 520,
  }

  oscillator.type = kind === 'warn' ? 'sawtooth' : 'sine'
  oscillator.frequency.setValueAtTime(frequencies[kind], now)
  if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(1174, now + 0.12)
  if (kind === 'step') oscillator.frequency.exponentialRampToValueAtTime(740, now + 0.09)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.09 * volume, now + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
  oscillator.connect(gain)
  gain.connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.18)
}

export function applyArenaSettingsEffects(settings: ArenaSettings): void {
  currentSettings = structuredClone(settings)
  if (typeof document !== 'undefined') {
    const root = document.documentElement
    const scale = SCALE_MAP[settings.uiScale] || '1'
    root.dataset.arenaScale = String(settings.uiScale)
    root.dataset.arenaMotion = settings.animationEnabled ? 'on' : 'off'
    root.dataset.arenaDensity = settings.compactLayout ? 'compact' : 'comfortable'
    root.dataset.arenaGlass = settings.glassEffect ? 'on' : 'off'
    root.style.setProperty('--arena-ui-scale', scale)
  }

  const defaultThemeId = getRuntimeConfig().themeId
  const themeId = resolveThemeId(settings)
  applyAppearance(themeId, settings.themeMode, defaultThemeId)
  syncSystemSchemeListener(settings)

  syncBgm(settings)
  window.dispatchEvent(new CustomEvent('arena:settings-change', { detail: structuredClone(settings) }))
}

export function getAppliedArenaSettings(): ArenaSettings | null {
  return currentSettings ? structuredClone(currentSettings) : null
}
