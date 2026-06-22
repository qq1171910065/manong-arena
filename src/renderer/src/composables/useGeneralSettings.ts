import { ref, type Ref } from 'vue'

const STORAGE_KEY = 'mntools-general-settings'

export type UiDensity = 'comfortable' | 'compact'
export type CloseBehavior = 'ask' | 'tray' | 'quit'
export type FontScale = 'sm' | 'md' | 'lg'

export interface GeneralSettings {
  confirmBeforeExit: boolean
  showDemoBadge: boolean
  enableDesktopNotifications: boolean
  enableShortcuts: boolean
  alwaysOnTop: boolean
  launchAtStartup: boolean
  windowOpacity: number
  uiDensity: UiDensity
  fontScale: FontScale
  sidebarDefaultCollapsed: boolean
  closeBehavior: CloseBehavior
}

export const GENERAL_SETTINGS_DEFAULTS: GeneralSettings = {
  confirmBeforeExit: true,
  showDemoBadge: true,
  enableDesktopNotifications: true,
  enableShortcuts: true,
  alwaysOnTop: false,
  launchAtStartup: false,
  windowOpacity: 100,
  uiDensity: 'comfortable',
  fontScale: 'md',
  sidebarDefaultCollapsed: false,
  closeBehavior: 'ask',
}

const DEFAULTS: GeneralSettings = { ...GENERAL_SETTINGS_DEFAULTS }

const settingsState = ref<GeneralSettings>(readFromStorage())

function normalizeSettings(raw: Partial<GeneralSettings>): GeneralSettings {
  const parsed = { ...DEFAULTS, ...raw }
  parsed.windowOpacity = Math.min(100, Math.max(70, Number(parsed.windowOpacity) || DEFAULTS.windowOpacity))
  if (parsed.uiDensity !== 'compact') parsed.uiDensity = 'comfortable'
  if (!['sm', 'md', 'lg'].includes(parsed.fontScale)) parsed.fontScale = DEFAULTS.fontScale
  if (!['ask', 'tray', 'quit'].includes(parsed.closeBehavior)) {
    parsed.closeBehavior = DEFAULTS.closeBehavior
  }
  return parsed
}

function readFromStorage(): GeneralSettings {
  if (typeof localStorage === 'undefined') return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const json = JSON.parse(raw) as Partial<GeneralSettings> & { confirmBeforeClose?: boolean }
    if (json.confirmBeforeClose && json.closeBehavior == null) {
      json.closeBehavior = 'ask'
    }
    return normalizeSettings(json)
  } catch {
    return { ...DEFAULTS }
  }
}

function applySideEffects(settings: GeneralSettings): void {
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.uiDensity = settings.uiDensity
    document.documentElement.dataset.fontScale = settings.fontScale
  }
  if (typeof window.api.setWindowOpacity === 'function') {
    void window.api.setWindowOpacity(settings.windowOpacity / 100)
  }
  if (typeof window.api.setAlwaysOnTop === 'function') {
    void window.api.setAlwaysOnTop(settings.alwaysOnTop)
  }
  if (typeof window.api.setTrayHideOnClose === 'function') {
    void window.api.setTrayHideOnClose(settings.closeBehavior === 'tray')
  }
}

export function getGeneralSettings(): GeneralSettings {
  return { ...settingsState.value }
}

export function saveGeneralSettings(partial: Partial<GeneralSettings>): GeneralSettings {
  const next = normalizeSettings({ ...settingsState.value, ...partial })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  settingsState.value = next
  applySideEffects(next)
  return next
}

export function applyGeneralSettingsEffects(): void {
  applySideEffects(settingsState.value)
}

export function resetGeneralSettings(): GeneralSettings {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS))
  settingsState.value = { ...DEFAULTS }
  applySideEffects(settingsState.value)
  return settingsState.value
}

export function useGeneralSettings(): {
  settings: Ref<GeneralSettings>
  save: (partial: Partial<GeneralSettings>) => GeneralSettings
  reset: () => GeneralSettings
  reload: () => void
} {
  return {
    settings: settingsState,
    save: saveGeneralSettings,
    reset: resetGeneralSettings,
    reload() {
      settingsState.value = readFromStorage()
      applySideEffects(settingsState.value)
    },
  }
}

applySideEffects(settingsState.value)
