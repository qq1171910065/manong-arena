import type { CharacterAttributeId } from '@shared/arena/character-growth'
import type { CollectionCategoryId } from '@shared/arena/builtin-collection'

export interface CollectionVisualTheme {
  gradient: string
  accent: string
  muted: string
  ring: string
}

const ACHIEVEMENT_GROUP_THEMES: Record<string, CollectionVisualTheme> = {
  养成: {
    gradient: 'linear-gradient(145deg, #ede9fe 0%, #ddd6fe 55%, #c4b5fd 100%)',
    accent: '#6d28d9',
    muted: '#8b5cf6',
    ring: 'rgba(109, 40, 217, 0.28)',
  },
  对局: {
    gradient: 'linear-gradient(145deg, #fef3c7 0%, #fde68a 55%, #fbbf24 100%)',
    accent: '#b45309',
    muted: '#d97706',
    ring: 'rgba(180, 83, 9, 0.28)',
  },
  互动: {
    gradient: 'linear-gradient(145deg, #ccfbf1 0%, #99f6e4 55%, #5eead4 100%)',
    accent: '#0f766e',
    muted: '#14b8a6',
    ring: 'rgba(15, 118, 110, 0.28)',
  },
}

const ATTRIBUTE_THEMES: Record<CharacterAttributeId, CollectionVisualTheme> = {
  precision: {
    gradient: 'linear-gradient(145deg, #fce7f3 0%, #fbcfe8 55%, #f9a8d4 100%)',
    accent: '#be185d',
    muted: '#ec4899',
    ring: 'rgba(190, 24, 93, 0.28)',
  },
  empathy: {
    gradient: 'linear-gradient(145deg, #ffe4e6 0%, #fecdd3 55%, #fda4af 100%)',
    accent: '#e11d48',
    muted: '#f43f5e',
    ring: 'rgba(225, 29, 72, 0.28)',
  },
  creativity: {
    gradient: 'linear-gradient(145deg, #ede9fe 0%, #ddd6fe 55%, #c4b5fd 100%)',
    accent: '#7c3aed',
    muted: '#8b5cf6',
    ring: 'rgba(124, 58, 237, 0.28)',
  },
  context: {
    gradient: 'linear-gradient(145deg, #dbeafe 0%, #bfdbfe 55%, #93c5fd 100%)',
    accent: '#1d4ed8',
    muted: '#3b82f6',
    ring: 'rgba(29, 78, 216, 0.28)',
  },
  depth: {
    gradient: 'linear-gradient(145deg, #ffedd5 0%, #fed7aa 55%, #fdba74 100%)',
    accent: '#c2410c',
    muted: '#f97316',
    ring: 'rgba(194, 65, 12, 0.28)',
  },
}

const PERSONALITY_KIND_THEMES: Record<'tag' | 'speech-style', CollectionVisualTheme> = {
  tag: {
    gradient: 'linear-gradient(145deg, #e0e7ff 0%, #c7d2fe 55%, #a5b4fc 100%)',
    accent: '#4338ca',
    muted: '#6366f1',
    ring: 'rgba(67, 56, 202, 0.28)',
  },
  'speech-style': {
    gradient: 'linear-gradient(145deg, #ecfccb 0%, #d9f99d 55%, #bef264 100%)',
    accent: '#4d7c0f',
    muted: '#84cc16',
    ring: 'rgba(77, 124, 15, 0.28)',
  },
}

const DEFAULT_THEME: CollectionVisualTheme = {
  gradient: 'linear-gradient(145deg, #eef2ff 0%, #e0e7ff 55%, #c7d2fe 100%)',
  accent: '#5b57f3',
  muted: '#7069ff',
  ring: 'rgba(91, 87, 243, 0.28)',
}

const ASSET_PACK_PALETTE_THEMES: Record<string, CollectionVisualTheme> = {
  violet: {
    gradient: 'linear-gradient(145deg, #ede9fe 0%, #ddd6fe 55%, #c4b5fd 100%)',
    accent: '#6d28d9',
    muted: '#8b5cf6',
    ring: 'rgba(109, 40, 217, 0.28)',
  },
  rose: {
    gradient: 'linear-gradient(145deg, #ffe4e6 0%, #fecdd3 55%, #fda4af 100%)',
    accent: '#e11d48',
    muted: '#f43f5e',
    ring: 'rgba(225, 29, 72, 0.28)',
  },
  sky: {
    gradient: 'linear-gradient(145deg, #e0f2fe 0%, #bae6fd 55%, #7dd3fc 100%)',
    accent: '#0369a1',
    muted: '#0ea5e9',
    ring: 'rgba(3, 105, 161, 0.28)',
  },
  amber: {
    gradient: 'linear-gradient(145deg, #fef3c7 0%, #fde68a 55%, #fbbf24 100%)',
    accent: '#b45309',
    muted: '#d97706',
    ring: 'rgba(180, 83, 9, 0.28)',
  },
  emerald: {
    gradient: 'linear-gradient(145deg, #d1fae5 0%, #a7f3d0 55%, #6ee7b7 100%)',
    accent: '#047857',
    muted: '#10b981',
    ring: 'rgba(4, 120, 87, 0.28)',
  },
}

export function achievementGroupTheme(group: string): CollectionVisualTheme {
  return ACHIEVEMENT_GROUP_THEMES[group] || DEFAULT_THEME
}

export function skillAttributeTheme(attributeId: CharacterAttributeId): CollectionVisualTheme {
  return ATTRIBUTE_THEMES[attributeId] || DEFAULT_THEME
}

export function personalityKindTheme(kind: 'tag' | 'speech-style'): CollectionVisualTheme {
  return PERSONALITY_KIND_THEMES[kind]
}

export function assetPackTheme(palette?: string, characterId?: string): CollectionVisualTheme {
  const key = (palette || '').toLowerCase()
  if (key && ASSET_PACK_PALETTE_THEMES[key]) return ASSET_PACK_PALETTE_THEMES[key]
  if (!characterId) return DEFAULT_THEME
  const hash = characterId.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const palettes = Object.values(ASSET_PACK_PALETTE_THEMES)
  return palettes[hash % palettes.length] || DEFAULT_THEME
}

export function collectionAssetLabel(category: CollectionCategoryId): string {
  switch (category) {
    case 'achievements':
      return '成就图标'
    case 'asset-packs':
      return '素材预览'
    case 'talents':
      return '天赋图标'
    case 'personalities':
      return '性格图标'
    default:
      return '收藏素材'
  }
}

export function resolveCollectionIconUrl(iconUrl?: string): string | null {
  const trimmed = iconUrl?.trim()
  return trimmed ? trimmed : null
}

export function assetPackInitials(label: string, characterId: string): string {
  const source = label.trim() || characterId
  const chars = [...source].filter((ch) => /\S/.test(ch))
  if (!chars.length) return '?'
  if (chars.length === 1) return chars[0]
  return `${chars[0]}${chars[1]}`
}
