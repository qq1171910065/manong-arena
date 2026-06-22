import { ref, type Ref } from 'vue'

const STORAGE_KEY = 'mntools-shortcut-settings'

export type ShortcutActionId = 'goSettings' | 'focusSearch' | 'toggleSidebar'

export interface ShortcutCatalogItem {
  id: ShortcutActionId
  label: string
  description: string
  defaultAccelerator: string
  defaultEnabled: boolean
}

export interface ShortcutBinding {
  enabled: boolean
  accelerator: string
}

export type ShortcutSettings = Record<ShortcutActionId, ShortcutBinding>

export const SHORTCUT_CATALOG: ShortcutCatalogItem[] = [
  {
    id: 'toggleSidebar',
    label: '收起/展开侧栏',
    description: '切换左侧导航栏宽度',
    defaultAccelerator: 'CommandOrControl+B',
    defaultEnabled: true,
  },
  {
    id: 'goSettings',
    label: '打开设置',
    description: '快速进入设置页',
    defaultAccelerator: 'CommandOrControl+,',
    defaultEnabled: true,
  },
  {
    id: 'focusSearch',
    label: '搜索导航',
    description: '聚焦左侧导航搜索框',
    defaultAccelerator: 'CommandOrControl+K',
    defaultEnabled: true,
  },
]

function buildDefaults(): ShortcutSettings {
  return SHORTCUT_CATALOG.reduce((acc, item) => {
    acc[item.id] = {
      enabled: item.defaultEnabled,
      accelerator: item.defaultAccelerator,
    }
    return acc
  }, {} as ShortcutSettings)
}

const DEFAULTS = buildDefaults()
const settingsState = ref<ShortcutSettings>(readFromStorage())

function readFromStorage(): ShortcutSettings {
  const base = buildDefaults()
  if (typeof localStorage === 'undefined') return base
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return base
    const parsed = JSON.parse(raw) as Partial<ShortcutSettings>
    for (const item of SHORTCUT_CATALOG) {
      const saved = parsed[item.id]
      if (saved) {
        base[item.id] = {
          enabled: saved.enabled ?? item.defaultEnabled,
          accelerator: saved.accelerator || item.defaultAccelerator,
        }
      }
    }
    return base
  } catch {
    return base
  }
}

export function getShortcutDefaults(): ShortcutSettings {
  return buildDefaults()
}

export function getShortcutBinding(id: ShortcutActionId): ShortcutBinding {
  return { ...settingsState.value[id] }
}

export function saveShortcutSettings(partial: Partial<ShortcutSettings>): ShortcutSettings {
  const next = { ...settingsState.value }
  for (const item of SHORTCUT_CATALOG) {
    if (partial[item.id]) {
      next[item.id] = { ...next[item.id], ...partial[item.id] }
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  settingsState.value = next
  return next
}

export function resetShortcutSettings(): ShortcutSettings {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULTS))
  settingsState.value = buildDefaults()
  return settingsState.value
}

export function useShortcutSettings(): {
  settings: Ref<ShortcutSettings>
  catalog: ShortcutCatalogItem[]
  save: (partial: Partial<ShortcutSettings>) => ShortcutSettings
  reset: () => ShortcutSettings
  reload: () => void
} {
  return {
    settings: settingsState,
    catalog: SHORTCUT_CATALOG,
    save: saveShortcutSettings,
    reset: resetShortcutSettings,
    reload() {
      settingsState.value = readFromStorage()
    },
  }
}
