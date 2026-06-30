import type {
  BehaviorChangeRecord,
  Character,
  CharacterGrowthRecord,
  Match,
} from '@shared/arena/types'
import type { CharacterGrowthSnapshot } from '@shared/arena/character-growth'
import {
  formatLessonFromSnapshot,
  isGrowthLogSnapshot,
  sanitizeGrowthSummary,
} from '@shared/arena/growth-display'
import { characterDisplayName } from '@shared/arena/character-display-names'
import { formatTimeLabel, matchStatusLabel } from '@renderer/utils/id'
import {
  characterAvatarByName,
  characterPortraitByName,
  matchImageByModeId,
} from '@renderer/data/arena-visual-assets'

const FALLBACK_CHARACTERS = [
  {
    name: characterDisplayName('doubao'),
    modelId: 'doubao',
    subtitle: '大小姐气场 · 直觉型推理',
    bio: '说话轻快带点傲娇，擅长从细节里抓可疑点。',
    tags: ['敏锐观察', '剧情推理'],
    speechStyle: '活泼',
    speech: '我觉得这里有一点点不对劲喔。',
    accent: '#f472b6',
  },
  {
    name: characterDisplayName('gpt-4o'),
    modelId: 'gpt-4o',
    subtitle: '查老师 · 结构化分析',
    bio: '习惯先梳理信息再下结论，发言条理清晰。',
    tags: ['逻辑推理', '策略思维'],
    speechStyle: '理性',
    speech: '让我分析一下线索。',
    accent: '#60a5fa',
  },
  {
    name: characterDisplayName('claude-3-5-sonnet'),
    modelId: 'claude-3-5-sonnet',
    subtitle: '小克 · 平衡型玩家',
    bio: '语气平和，擅长缓和紧张局势并引导讨论。',
    tags: ['冷静沉着', '团队协作'],
    speechStyle: '温柔',
    speech: '保持冷静，我们先看局势。',
    accent: '#f59e0b',
  },
  {
    name: characterDisplayName('deepseek-chat'),
    modelId: 'deepseek-chat',
    subtitle: '深鲸 · 矛盾点捕捉',
    bio: '发言不多，但总能指出逻辑漏洞和投票动机。',
    tags: ['逻辑推理', '细节控'],
    speechStyle: '简洁',
    speech: '这里有个矛盾点。',
    accent: '#818cf8',
  },
  {
    name: characterDisplayName('kimi'),
    modelId: 'kimi',
    subtitle: '001号客服 · 信息整理',
    bio: '擅长帮大家梳理冗长发言里的重点。',
    tags: ['信息整合', '团队协作'],
    speechStyle: '清晰',
    speech: '我来帮大家梳理一下。',
    accent: '#c084fc',
  },
  {
    name: characterDisplayName('gemini-pro'),
    modelId: 'gemini-pro',
    subtitle: '哈基米 · 创意表达',
    bio: '表达富有画面感，偶尔用比喻帮大家理解局势。',
    tags: ['创意表达', '快速反应'],
    speechStyle: '幽默',
    speech: '真相总会浮出水面。',
    accent: '#d82b75',
  },
]

function badgeGradient(color: string): string {
  return `linear-gradient(180deg, ${color}33 0%, ${color}22 100%)`
}

export interface HomeCharacterCard {
  id: string
  name: string
  subtitle: string
  bio: string
  tags: string[]
  speechStyle: string
  matchLabel: string
  image: string
  speech: string
  accent: string
  badge: string
  clickable: boolean
}

function bioExcerpt(bio: string, max = 32): string {
  const trimmed = bio.trim()
  if (!trimmed) return ''
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed
}

function matchLabel(stats: Character['stats']): string {
  if (stats.matchCount <= 0) return '尚未参战'
  return `${stats.matchCount} 场对局`
}

function mapHomeCharacterCard(
  input: {
    id: string
    name: string
    modelId: string
    subtitle?: string
    bio?: string
    tags?: string[]
    speechStyle?: string
    commonPhrases?: string[]
    accentColor?: string
    accent?: string
    portraitUrl?: string
    stats?: Character['stats']
  },
  index: number,
  clickable: boolean
): HomeCharacterCard {
  const accent = input.accentColor || input.accent || '#7568ff'
  const bio = input.bio || ''
  const tags = input.tags || []
  return {
    id: input.id,
    name: input.name,
    subtitle: input.subtitle || '',
    bio: bioExcerpt(bio),
    tags: tags.slice(0, 3),
    speechStyle: input.speechStyle || '',
    matchLabel: matchLabel(input.stats || { matchCount: 0, winCount: 0, avgCostCents: 0, lastMatchAt: null }),
    image: characterPortraitByName(input.name, index, input.modelId, input.portraitUrl, input.id),
    speech: input.commonPhrases?.[0] || input.subtitle || `${input.name}已就位。`,
    accent,
    badge: badgeGradient(accent),
    clickable,
  }
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

export interface HomeCharacterActivity {
  id: string
  characterId: string
  characterName: string
  avatar: string
  accent: string
  kind:
    | 'create'
    | 'update'
    | 'learn'
    | 'exam'
    | 'chat'
    | 'behavior'
    | 'relearn'
    | 'post_match'
    | 'review'
    | 'match'
    | 'growth'
  kindLabel: string
  title: string
  detail?: string
  time: string
  timeLabel: string
  clickable: boolean
  target: 'character' | 'match'
  matchId?: string
}

function activityKindLabel(kind: HomeCharacterActivity['kind']): string {
  switch (kind) {
    case 'create':
      return '新建'
    case 'update':
      return '档案'
    case 'learn':
      return '学习'
    case 'relearn':
      return '复习'
    case 'post_match':
      return '复盘'
    case 'exam':
      return '考试'
    case 'chat':
      return '私聊'
    case 'behavior':
      return '准则'
    case 'review':
      return '复盘'
    case 'match':
      return '对局'
    case 'growth':
      return '成长'
    default:
      return '动态'
  }
}

function growthSnapshotTitle(snapshot: CharacterGrowthSnapshot): string {
  if (snapshot.levelDelta && snapshot.levelDelta > 0) {
    return `升到了 Lv.${snapshot.level}`
  }
  switch (snapshot.source) {
    case 'match':
      return '在对局中历练'
    case 'chat':
      return '私聊互动带来成长'
    case 'review':
      return '复盘后有所领悟'
    case 'initial':
      return '建档完成'
    case 'migration':
      return '成长数据已同步'
    default:
      return '有了新的成长记录'
  }
}

function matchActivityTitle(match: Match, won: boolean): string {
  if (match.status === 'completed') {
    return won ? `在「${match.title}」中获胜` : `完成了「${match.title}」`
  }
  if (match.status === 'active') return `正在「${match.title}」中对局`
  if (match.status === 'paused') return `暂停了「${match.title}」`
  return `参与了「${match.title}」`
}

function learningLogTitle(source: 'initial' | 'relearn' | 'post_match', scenarioName: string): string {
  if (source === 'relearn') return `再次学习「${scenarioName}」`
  if (source === 'post_match') return `复盘后深化「${scenarioName}」理解`
  return `深化「${scenarioName}」理解`
}

function learningLogKind(source: 'initial' | 'relearn' | 'post_match'): HomeCharacterActivity['kind'] {
  if (source === 'relearn') return 'relearn'
  if (source === 'post_match') return 'post_match'
  return 'learn'
}

function pushActivity(
  bucket: HomeCharacterActivity[],
  item: Omit<HomeCharacterActivity, 'kindLabel' | 'timeLabel'> & { kind: HomeCharacterActivity['kind'] }
) {
  bucket.push({
    ...item,
    kindLabel: activityKindLabel(item.kind),
    timeLabel: formatTimeLabel(item.time),
  })
}

function characterVisuals(character: Character, index: number) {
  return {
    avatar: characterAvatarByName(character.name, index, character.modelId, character.avatarUrl, character.id),
    accent: character.accentColor,
  }
}

export function mapCharacterActivityFeed(input: {
  characters: Character[]
  behaviorChanges: BehaviorChangeRecord[]
  growthRecords: CharacterGrowthRecord[]
  growthSnapshots?: CharacterGrowthSnapshot[]
  recentMatches?: Match[]
  limit?: number
}): HomeCharacterActivity[] {
  const limit = input.limit ?? 50
  const rows: HomeCharacterActivity[] = []
  const characterById = new Map(input.characters.map((c, index) => [c.id, { character: c, index }]))

  for (const match of input.recentMatches || []) {
    const time = match.endedAt || match.updatedAt
    for (const participant of match.participants) {
      const meta = characterById.get(participant.characterId)
      if (!meta) continue
      const visuals = characterVisuals(meta.character, meta.index)
      const won = Boolean(match.winnerCamp && participant.roleCamp && participant.roleCamp === match.winnerCamp)
      pushActivity(rows, {
        id: `match-${match.id}-${participant.characterId}`,
        characterId: participant.characterId,
        characterName: meta.character.name,
        avatar: visuals.avatar,
        accent: visuals.accent,
        kind: 'match',
        title: matchActivityTitle(match, won),
        detail: match.gameModeName,
        time,
        clickable: true,
        target: 'match',
        matchId: match.id,
      })
    }
  }

  for (const character of input.characters) {
    const meta = characterById.get(character.id)
    const index = meta?.index ?? 0
    const visuals = characterVisuals(character, index)

    pushActivity(rows, {
      id: `create-${character.id}`,
      characterId: character.id,
      characterName: character.name,
      avatar: visuals.avatar,
      accent: visuals.accent,
      kind: 'create',
      title: '加入了角色库',
      detail: character.subtitle || '角色档案已创建',
      time: character.createdAt,
      clickable: true,
      target: 'character',
    })

    const createdAtMs = new Date(character.createdAt).getTime()
    const updatedAtMs = new Date(character.updatedAt).getTime()
    if (!Number.isNaN(createdAtMs) && !Number.isNaN(updatedAtMs) && updatedAtMs - createdAtMs > 60_000) {
      pushActivity(rows, {
        id: `update-${character.id}-${character.updatedAt}`,
        characterId: character.id,
        characterName: character.name,
        avatar: visuals.avatar,
        accent: visuals.accent,
        kind: 'update',
        title: '更新了角色档案',
        detail: character.bio ? character.bio.slice(0, 48) : character.subtitle || undefined,
        time: character.updatedAt,
        clickable: true,
        target: 'character',
      })
    }

    for (const skill of character.gameSkills) {
      const scenarioName = skill.scenarioName || skill.scenarioId
      if (skill.learnedAt) {
        pushActivity(rows, {
          id: `learn-${character.id}-${skill.scenarioId}-${skill.learnedAt}`,
          characterId: character.id,
          characterName: character.name,
          avatar: visuals.avatar,
          accent: visuals.accent,
          kind: 'learn',
          title: `学习了「${scenarioName}」`,
          detail: skill.initialUnderstanding || skill.mentalModel || undefined,
          time: skill.learnedAt,
          clickable: true,
          target: 'character',
        })
      }
      if (skill.examPassed && skill.examPassedAt) {
        pushActivity(rows, {
          id: `exam-${character.id}-${skill.scenarioId}-${skill.examPassedAt}`,
          characterId: character.id,
          characterName: character.name,
          avatar: visuals.avatar,
          accent: visuals.accent,
          kind: 'exam',
          title: `通过了「${scenarioName}」考试`,
          detail: skill.examBypassed ? '已免考通过' : '玩法理解已达标',
          time: skill.examPassedAt,
          clickable: true,
          target: 'character',
        })
      }
      for (const entry of skill.learningLog || []) {
        pushActivity(rows, {
          id: entry.id,
          characterId: character.id,
          characterName: character.name,
          avatar: visuals.avatar,
          accent: visuals.accent,
          kind: learningLogKind(entry.source),
          title: learningLogTitle(entry.source, scenarioName),
          detail: entry.summary || entry.understanding,
          time: entry.createdAt,
          clickable: true,
          target: 'character',
        })
      }
    }
  }

  for (const snapshot of input.growthSnapshots || []) {
    if (!isGrowthLogSnapshot(snapshot)) continue
    const meta = characterById.get(snapshot.characterId)
    if (!meta) continue
    const visuals = characterVisuals(meta.character, meta.index)
    const detail = formatLessonFromSnapshot(snapshot)
    pushActivity(rows, {
      id: `growth-${snapshot.id}`,
      characterId: snapshot.characterId,
      characterName: meta.character.name,
      avatar: visuals.avatar,
      accent: visuals.accent,
      kind: 'growth',
      title: growthSnapshotTitle(snapshot),
      detail,
      time: snapshot.createdAt,
      clickable: true,
      target: snapshot.matchId ? 'match' : 'character',
      matchId: snapshot.matchId,
    })
  }

  for (const record of input.growthRecords) {
    const summary = sanitizeGrowthSummary(record.summary)
    if (!summary) continue
    const meta = characterById.get(record.characterId)
    if (!meta) continue
    const visuals = characterVisuals(meta.character, meta.index)
    pushActivity(rows, {
      id: `growth-record-${record.id}`,
      characterId: record.characterId,
      characterName: meta.character.name,
      avatar: visuals.avatar,
      accent: visuals.accent,
      kind: record.source === 'chat' ? 'chat' : 'review',
      title: record.source === 'chat' ? '在私聊中完成了养成' : '赛后复盘有了新领悟',
      detail: summary,
      time: record.createdAt,
      clickable: true,
      target: record.matchId ? 'match' : 'character',
      matchId: record.matchId,
    })
  }

  for (const record of input.behaviorChanges) {
    const summary = sanitizeGrowthSummary(record.summary)
    if (!summary) continue
    const meta = characterById.get(record.characterId)
    if (!meta) continue
    const visuals = characterVisuals(meta.character, meta.index)
    const title =
      record.trigger === 'chat'
        ? '通过私聊调整了行为准则'
        : record.trigger === 'post_game_review'
          ? '赛后复盘调整了行为准则'
          : '更新了行为准则'
    pushActivity(rows, {
      id: `behavior-${record.id}`,
      characterId: record.characterId,
      characterName: meta.character.name,
      avatar: visuals.avatar,
      accent: visuals.accent,
      kind: record.trigger === 'post_game_review' ? 'review' : 'behavior',
      title,
      detail: summary,
      time: record.createdAt,
      clickable: true,
      target: 'character',
    })
  }

  if (!rows.length) {
    return FALLBACK_CHARACTERS.map((c, i) => ({
      id: `fallback-${i}`,
      characterId: String(i),
      characterName: c.name,
      avatar: characterAvatarByName(c.name, i, c.modelId),
      accent: c.accent,
      kind: 'update' as const,
      kindLabel: '示例',
      title: '已在大厅就位',
      detail: c.speech,
      time: new Date(Date.now() - i * 3_600_000).toISOString(),
      timeLabel: i === 0 ? '刚刚' : `${i} 小时前`,
      clickable: false,
      target: 'character' as const,
    }))
  }

  return rows
    .sort((a, b) => b.time.localeCompare(a.time))
    .slice(0, limit)
}

export function mapMatchesForHome(matches: Match[], characters: Character[]): HomeMatchRow[] {
  const avatarByCharacterId = new Map(
    characters.map((c, index) => [
      c.id,
      characterAvatarByName(c.name, index, c.modelId, c.avatarUrl),
    ])
  )

  return matches.slice(0, 10).map((m) => ({
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
  const mapped = characters.slice(0, 6).map((c, index) => mapHomeCharacterCard(c, index, true))

  return mapped.length
    ? mapped
    : FALLBACK_CHARACTERS.map((c, i) =>
        mapHomeCharacterCard(
          {
            id: String(i),
            name: c.name,
            modelId: c.modelId,
            subtitle: c.subtitle,
            bio: c.bio,
            tags: c.tags,
            speechStyle: c.speechStyle,
            commonPhrases: [c.speech],
            accent: c.accent,
          },
          i,
          false
        )
      )
}
