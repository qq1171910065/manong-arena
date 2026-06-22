import type { ThemeId } from '@shared/types'

export const THEME_PRESETS: Record<
  ThemeId,
  { label: string; description: string; primary: string; background: string; darkClass?: string }
> = {
  'enterprise-light': {
    label: '企业办公（浅色）',
    description: 'Entelli 默认企业风格，适合办公与生产力工具',
    primary: '#7C3AED',
    background: '#F8F5FF',
  },
  'enterprise-dark': {
    label: '企业办公（暗色）',
    description: '暗色企业风格，适合长时间使用的专业工具',
    primary: '#A78BFA',
    background: '#0F172A',
    darkClass: 'theme-dark theme-enterprise-dark',
  },
  'creative-vivid': {
    label: '创作 vivid',
    description: '更大圆角与紫色主色，适合媒体/创作类工具',
    primary: '#8B5CF6',
    background: '#FAF5FF',
  },
  'minimal-mono': {
    label: '极简 mono',
    description: '低饱和紧凑控件，适合轻量实用工具',
    primary: '#18181B',
    background: '#FFFFFF',
  },
  'ocean-teal': {
    label: '海洋青',
    description: '清新青绿主色，适合数据与效率类工具',
    primary: '#0D9488',
    background: '#F0FDFA',
  },
  'rose-warm': {
    label: '暖玫瑰',
    description: '温暖玫瑰红，适合内容与社区类工具',
    primary: '#E11D48',
    background: '#FFF1F2',
  },
  'forest-calm': {
    label: '护眼森林',
    description: '低刺激绿色系，适合长时间阅读与编辑',
    primary: '#16A34A',
    background: '#F0FDF4',
  },
  'high-contrast': {
    label: '高对比',
    description: '强对比黑白黄，适合无障碍与演示场景',
    primary: '#FACC15',
    background: '#FFFFFF',
  },
}

const STORAGE_KEY = 'mntools-theme-id'
const SCHEME_KEY = 'mntools-color-scheme'

export function getStoredThemeId(defaultId: ThemeId): ThemeId {
  const raw = localStorage.getItem(STORAGE_KEY) as ThemeId | null
  if (raw && raw in THEME_PRESETS) return raw
  return defaultId
}

export function setStoredThemeId(id: ThemeId): void {
  localStorage.setItem(STORAGE_KEY, id)
}

export function applyAppearance(
  themeId: ThemeId,
  scheme: 'light' | 'dark' | 'system',
  defaultId: ThemeId
): void {
  const root = document.documentElement
  const preset = THEME_PRESETS[themeId] ?? THEME_PRESETS[defaultId]

  setStoredThemeId(themeId)
  localStorage.setItem(SCHEME_KEY, scheme)
  root.dataset.themeId = themeId

  root.classList.remove('theme-dark', 'theme-enterprise-dark')

  const isDark =
    scheme === 'dark' ||
    (scheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  if (isDark) {
    root.classList.add('theme-dark')
    if (preset.darkClass) {
      for (const cls of preset.darkClass.split(/\s+/)) {
        if (cls && cls !== 'theme-dark') root.classList.add(cls)
      }
    }
  }

  window.dispatchEvent(new CustomEvent('mntools:theme-change', { detail: { themeId } }))
}

export function applyTheme(themeId: ThemeId, defaultId: ThemeId): void {
  applyAppearance(themeId, getColorScheme(), defaultId)
}

export function setColorScheme(scheme: 'light' | 'dark' | 'system'): void {
  const root = document.documentElement
  const themeId = (root.dataset.themeId as ThemeId) || getStoredThemeId('enterprise-light')
  applyAppearance(themeId, scheme, themeId)
}

export function getColorScheme(): 'light' | 'dark' | 'system' {
  return (localStorage.getItem(SCHEME_KEY) as 'light' | 'dark' | 'system') || 'system'
}
