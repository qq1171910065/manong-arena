import type { Character, GameMode, Match } from '@shared/arena/types'
import { formatTimeLabel, matchStatusLabel } from '@renderer/utils/id'
import {
  characterAvatarByName,
  characterPortraitByName,
  matchImageByModeId,
  modeImageById,
} from '@renderer/data/arena-visual-assets'

const FALLBACK_CHARACTERS = [
  { name: '豆包', modelId: 'doubao', speech: '我觉得这里有一点点不对劲。', accent: '#f472b6' },
  { name: 'GPT', modelId: 'gpt-4o', speech: '让我分析一下线索。', accent: '#60a5fa' },
  { name: 'Claude', modelId: 'claude-3-5-sonnet', speech: '保持冷静，我们先看局势。', accent: '#f59e0b' },
  { name: 'DeepSeek', modelId: 'deepseek-chat', speech: '这里有个矛盾点。', accent: '#818cf8' },
  { name: 'Kimi', modelId: 'kimi', speech: '我来帮大家梳理一下。', accent: '#c084fc' },
  { name: 'Gemini', modelId: 'gemini-pro', speech: '真相总会浮出水面。', accent: '#d82b75' },
]

function badgeGradient(color: string): string {
  return `linear-gradient(180deg, ${color}33 0%, ${color}22 100%)`
}

export interface HomeCharacterCard {
  id: string
  name: string
  image: string
  speech: string
  accent: string
  badge: string
  clickable: boolean
}

export interface HomeMatchRow {
  id: string
  name: string
  mode: string
  date: string
  players: string
  status: string
  tone: 'classic' | 'advanced' | 'fun'
  emblem: string
  avatars: string[]
}

export interface HomeModeCard {
  id: string
  name: string
  desc: string
  players: string
  image: string
}

function toneForMode(modeId: string): HomeMatchRow['tone'] {
  if (modeId === 'avalon') return 'advanced'
  if (modeId === 'undercover' || modeId === 'custom') return 'fun'
  return 'classic'
}

function statusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'active') return '进行中'
  if (status === 'paused') return '已暂停'
  return matchStatusLabel(status as never)
}

export function mapCharactersForHome(characters: Character[]): HomeCharacterCard[] {
  const mapped = characters.slice(0, 6).map((c, index) => ({
    id: c.id,
    name: c.name,
    image: characterPortraitByName(c.name, index, c.modelId, c.portraitUrl),
    speech: c.commonPhrases[0] || c.subtitle || `${c.name}已就位。`,
    accent: c.accentColor,
    badge: badgeGradient(c.accentColor),
    clickable: true,
  }))

  return mapped.length
    ? mapped
    : FALLBACK_CHARACTERS.map((c, i) => ({
        id: String(i),
        name: c.name,
        image: characterPortraitByName(c.name, i, c.modelId),
        speech: c.speech,
        accent: c.accent,
        badge: badgeGradient(c.accent),
        clickable: false,
      }))
}

export function mapMatchesForHome(matches: Match[], characters: Character[]): HomeMatchRow[] {
  const avatarByCharacterId = new Map(
    characters.map((c, index) => [
      c.id,
      characterAvatarByName(c.name, index, c.modelId, c.avatarUrl),
    ])
  )

  return matches.slice(0, 3).map((m) => ({
    id: m.id,
    name: m.title,
    mode: m.gameModeName,
    date: formatTimeLabel(m.updatedAt),
    players: `${m.participants.length}人局`,
    status: statusLabel(m.status),
    tone: toneForMode(m.gameModeId),
    emblem: matchImageByModeId(m.gameModeId),
    avatars: m.participants
      .slice(0, 6)
      .map((p, index) => avatarByCharacterId.get(p.characterId) || characterAvatarByName(p.characterName, index, p.modelId, p.avatarUrl)),
  }))
}

export function mapModesForHome(modes: GameMode[]): HomeModeCard[] {
  return modes.map((m) => ({
    id: m.id,
    name: m.name,
    desc: m.subtitle,
    players: `${m.minPlayers}-${m.maxPlayers}人`,
    image: modeImageById(m.id),
  }))
}
