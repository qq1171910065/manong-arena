import type { Character, HumanInputKind, Match, MatchParticipant, SpeechTermHighlight } from '@shared/arena/types'
import { modelCallService } from './model-call-service'
import { resolveSheriffVoteTargets } from './werewolf-sheriff'

/** 狼人杀常见发言套话 — 供真人接管时快速插入 */
export const WEREWOLF_CLICHE_PHRASES = [
  '我先整理一下场上信息。',
  '建议大家先听完发言再站边。',
  '我这轮更倾向先观察票型。',
  '如果有神职信息，可以适当给好人指个方向。',
  '我先不急着归票，听听后面的发言。',
  '上一轮票型我觉得值得复盘一下。',
  '我这边有一个疑点想跟大家对齐。',
  '先别急着互踩，把逻辑链捋清楚更重要。',
]

export function formatHumanIdentity(participant: MatchParticipant) {
  const roleName = participant.roleName || '未知身份'
  const campLabel =
    participant.roleCamp === 'wolf' ? '狼人阵营' : participant.roleCamp === 'good' ? '好人阵营' : '未知阵营'
  return { roleName, campLabel, label: `${roleName} · ${campLabel}` }
}

export function buildMentionToken(participant: MatchParticipant): string {
  return `@${participant.seatOrder}号${participant.characterName}`
}

export function mentionCandidates(
  match: Match,
  selfId: string | null | undefined,
  query = ''
): MatchParticipant[] {
  const q = query.trim().toLowerCase()
  return match.participants
    .filter((p) => p.alive === 'alive' && p.characterId !== selfId)
    .filter((p) => {
      if (!q) return true
      return String(p.seatOrder).includes(q) || p.characterName.toLowerCase().includes(q)
    })
    .slice(0, 8)
}

export function buildHumanVoteTargets(match: Match, voterId: string | null | undefined): MatchParticipant[] {
  if (match.runtime.currentPhaseId === 'sheriff-vote') {
    return resolveSheriffVoteTargets(match)
  }

  if (!voterId) return []

  const noVote = new Set(match.runtime.werewolfState?.revealedIdiotIds || [])
  return match.participants
    .filter((p) => p.alive === 'alive' && p.characterId !== voterId && !noVote.has(p.characterId))
    .sort((a, b) => a.seatOrder - b.seatOrder)
}

export function canHumanVoteAbstain(match: Match, targets: MatchParticipant[]): boolean {
  if (match.runtime.currentPhaseId === 'sheriff-vote') return targets.length === 0
  return true
}

export function buildQuickPhrases(
  character: Character | null | undefined,
  terms: SpeechTermHighlight[] = []
): string[] {
  const fromChar = character?.commonPhrases?.filter(Boolean) ?? []
  const fromTerms = terms.map((t) => t.term.trim()).filter(Boolean)
  const merged = [...fromChar, ...fromTerms, ...WEREWOLF_CLICHE_PHRASES]
  return [...new Set(merged)].slice(0, 16)
}

export async function polishHumanDraft(
  match: Match,
  participant: MatchParticipant,
  character: Character | null | undefined,
  draft: string,
  kind: HumanInputKind
) {
  return modelCallService.polishHumanDraft(match, participant, character, draft, kind)
}

export async function suggestHumanSpeechHints(
  match: Match,
  participant: MatchParticipant,
  character: Character | null | undefined
) {
  return modelCallService.suggestHumanSpeechHints(match, participant, character)
}
