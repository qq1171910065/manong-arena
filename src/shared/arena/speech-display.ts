import type { MatchParticipant, SpeechDisplayConfig, SpeechTermHighlight } from './types'

export type { SpeechDisplayConfig, SpeechTermHighlight } from './types'

export interface RenderMatchSpeechOptions {
  config?: SpeechDisplayConfig | null
  participants?: Pick<MatchParticipant, 'characterId' | 'characterName' | 'seatOrder'>[]
}

type SpeechParticipant = Pick<MatchParticipant, 'characterId' | 'characterName' | 'seatOrder'>

interface TextSpan {
  start: number
  end: number
}

interface HighlightSpan extends TextSpan {
  kind: 'mention' | 'term'
  label?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function overlaps(a: TextSpan, b: TextSpan): boolean {
  return a.start < b.end && b.start < a.end
}

function mergeHighlightSpans(spans: HighlightSpan[]): HighlightSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || b.end - a.end)
  const merged: HighlightSpan[] = []
  for (const span of sorted) {
    const prev = merged[merged.length - 1]
    if (!prev || !overlaps(prev, span)) {
      merged.push(span)
      continue
    }
    if (span.kind === 'mention' && prev.kind !== 'mention') {
      merged[merged.length - 1] = span
    }
  }
  return merged
}

function findMentionSpans(text: string, participants: SpeechParticipant[]): HighlightSpan[] {
  const spans: HighlightSpan[] = []
  for (const participant of participants) {
    const seat = participant.seatOrder
    const name = participant.characterName.trim()
    if (!name) continue

    const patterns: Array<{ re: RegExp; label: string }> = [
      {
        re: new RegExp(`@${seat}号${escapeRegExp(name)}`, 'gi'),
        label: `${seat}号${name}`,
      },
      {
        re: new RegExp(`@${seat}\\s*号`, 'gi'),
        label: `${seat}号${name}`,
      },
      {
        re: new RegExp(`@${escapeRegExp(name)}`, 'gi'),
        label: name,
      },
    ]

    for (const { re, label } of patterns) {
      re.lastIndex = 0
      let match = re.exec(text)
      while (match) {
        spans.push({
          kind: 'mention',
          start: match.index,
          end: match.index + match[0].length,
          label,
        })
        match = re.exec(text)
      }
    }
  }
  return mergeHighlightSpans(spans)
}

function findTermSpans(text: string, terms: SpeechTermHighlight[], blocked: HighlightSpan[]): HighlightSpan[] {
  const spans: HighlightSpan[] = []
  const sortedTerms = [...terms]
    .filter((item) => item.term.trim())
    .sort((a, b) => b.term.length - a.term.length)

  for (const term of sortedTerms) {
    const re = new RegExp(escapeRegExp(term.term.trim()), 'g')
    let match = re.exec(text)
    while (match) {
      const candidate: HighlightSpan = {
        kind: 'term',
        start: match.index,
        end: match.index + match[0].length,
        label: term.label?.trim() || term.term.trim(),
      }
      if (!blocked.some((span) => overlaps(span, candidate))) {
        spans.push(candidate)
      }
      match = re.exec(text)
    }
  }

  return mergeHighlightSpans(spans)
}

export function renderMatchSpeechHtml(text: string, options: RenderMatchSpeechOptions = {}): string {
  const source = text || ''
  if (!source) return ''

  const config = options.config
  const participants = options.participants || []
  const mentionSpans =
    config?.highlightMentions !== false && participants.length
      ? findMentionSpans(source, participants)
      : []
  const termSpans = config?.terms?.length ? findTermSpans(source, config.terms, mentionSpans) : []
  const spans = mergeHighlightSpans([...mentionSpans, ...termSpans]).sort((a, b) => a.start - b.start)

  if (!spans.length) {
    return escapeHtml(source)
  }

  let cursor = 0
  let html = ''
  for (const span of spans) {
    if (span.start < cursor) continue
    html += escapeHtml(source.slice(cursor, span.start))
    const chunk = source.slice(span.start, span.end)
    const title = span.label ? ` title="${escapeHtml(span.label)}"` : ''
    if (span.kind === 'mention') {
      html += `<span class="speech-mention"${title}>${escapeHtml(chunk)}</span>`
    } else {
      html += `<span class="speech-term"${title}>${escapeHtml(chunk)}</span>`
    }
    cursor = span.end
  }
  html += escapeHtml(source.slice(cursor))
  return html
}

export const DEFAULT_WEREWOLF_SPEECH_DISPLAY: SpeechDisplayConfig = {
  highlightMentions: true,
  terms: [
    { term: '警长', label: '拥有 1.5 票归票权的玩家' },
    { term: '警徽', label: '警长身份标记，可移交给其他玩家' },
    { term: '归票', label: '引导投票方向' },
    { term: '警上', label: '警长竞选阶段' },
    { term: '退水', label: '退出警长竞选' },
    { term: '预言家', label: '每晚可查验一名玩家阵营的神职' },
    { term: '查验', label: '预言家夜间技能' },
    { term: '女巫', label: '拥有解药与毒药的神职' },
    { term: '解药', label: '女巫可救当晚刀口' },
    { term: '毒药', label: '女巫可额外毒杀一名玩家' },
    { term: '刀口', label: '狼人夜晚袭击的目标' },
    { term: '守卫', label: '每晚守护一名玩家的神职' },
    { term: '猎人', label: '死亡时可开枪带走一名玩家' },
    { term: '白痴', label: '被投票放逐时可翻牌免死' },
    { term: '放逐', label: '白天投票出局' },
    { term: '跳身份', label: '公开声明自己的神职或阵营' },
    { term: '悍跳', label: '非真身份者冒充神职' },
    { term: '倒钩', label: '狼人伪装成好人并攻击队友' },
    { term: '狼坑', label: '疑似狼人席位集合' },
    { term: '票型', label: '投票分布与站边结果' },
    { term: '警徽流', label: '警长指定的后续查验或归票顺序' },
  ],
}

export const DEFAULT_ROUNDTABLE_SPEECH_DISPLAY: SpeechDisplayConfig = {
  highlightMentions: true,
  terms: [
    { term: '议题', label: '本场讨论的核心主题' },
    { term: '圆桌', label: '多角色轮流发言的讨论形式' },
    { term: '总结', label: '归纳当前讨论结论' },
  ],
}

export function resolveSpeechDisplayConfig(
  gameModeId: string,
  config?: SpeechDisplayConfig | null
): SpeechDisplayConfig | null {
  const fallback =
    gameModeId === 'werewolf'
      ? DEFAULT_WEREWOLF_SPEECH_DISPLAY
      : gameModeId === 'roundtable'
        ? DEFAULT_ROUNDTABLE_SPEECH_DISPLAY
        : null
  if (!config) return fallback
  return {
    highlightMentions: config.highlightMentions ?? fallback?.highlightMentions ?? true,
    terms: config.terms?.length ? config.terms : fallback?.terms || [],
  }
}

/** @deprecated Use resolveSpeechDisplayConfig */
export function speechDisplayForGameMode(gameModeId: string, override?: SpeechDisplayConfig | null): SpeechDisplayConfig | null {
  return resolveSpeechDisplayConfig(gameModeId, override)
}

export function parseSpeechTermsText(raw: string): SpeechTermHighlight[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [term, label] = line.split('|').map((part) => part.trim())
      return label ? { term, label } : { term }
    })
}

export function formatSpeechTermsText(terms: SpeechTermHighlight[] = []): string {
  return terms
    .map((item) => (item.label?.trim() ? `${item.term.trim()}|${item.label.trim()}` : item.term.trim()))
    .join('\n')
}
