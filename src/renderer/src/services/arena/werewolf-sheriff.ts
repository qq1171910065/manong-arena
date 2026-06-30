import type { Match, MatchMessage, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'
import { ensureWerewolfState } from './phase-engine'

export type SheriffCampaignIntent = 'campaign' | 'withdraw' | 'unknown'

/** 从警上发言解析是否竞选警长 */
export function parseSheriffCampaignIntent(speech: string): SheriffCampaignIntent {
  const text = speech.trim()
  if (/不竞选|放弃竞选|退水|不上警|不参与竞选|不抢警徽|不当警长|放弃警长|不参选|不警|不拿警徽/.test(text)) return 'withdraw'
  if (
    /竞选警长|决定竞选|我要竞选|参与竞选|上警|拿警徽|争警长|参选警长|参选|当警长|竞选|跳预|跳预言家|真预|我是预|警徽流|我来带|我来归票|归票跟我|拿警|警长我来|做警长/.test(
      text
    )
  ) {
    return 'campaign'
  }
  return 'unknown'
}

function sheriffSpeechMessages(match: Match): MatchMessage[] {
  return match.messages.filter((m) => {
    if (m.kind !== 'speech' || !m.confirmed) return false
    if (m.phaseId === 'sheriff-speech') return true
    // 兼容旧数据：首轮警上发言可能未写入 phaseId
    return match.runtime.currentRound <= 1 && m.round === 1 && !m.phaseId
  })
}

export function getSheriffCandidateIds(match: Match): string[] {
  return match.runtime.werewolfState?.sheriffCandidates || []
}

export function getSheriffCandidateParticipants(match: Match): MatchParticipant[] {
  const ids = new Set(getSheriffCandidateIds(match))
  return match.participants
    .filter((p) => p.alive === 'alive' && ids.has(p.characterId))
    .sort((a, b) => a.seatOrder - b.seatOrder)
}

/** 从警上发言补全尚未登记的竞选者（警上发言默认视为上警，除非明确退水） */
export function inferSheriffCandidateIdsFromSpeech(match: Match): string[] {
  const candidates = new Set<string>()
  const withdrawn = new Set<string>()
  for (const msg of sheriffSpeechMessages(match)) {
    const intent = parseSheriffCampaignIntent(msg.content)
    if (intent === 'withdraw') {
      withdrawn.add(msg.participantId)
      continue
    }
    candidates.add(msg.participantId)
  }
  for (const id of withdrawn) candidates.delete(id)
  return [...candidates].filter((id) =>
    match.participants.some((p) => p.characterId === id && p.alive === 'alive')
  )
}

/** 进入警长投票前，合并登记与发言推断的竞选名单 */
export function finalizeSheriffCandidates(match: Match): void {
  const state = ensureWerewolfState(match)
  if (!state.sheriffCandidates) state.sheriffCandidates = []
  const merged = new Set([...state.sheriffCandidates, ...inferSheriffCandidateIdsFromSpeech(match)])
  state.sheriffCandidates = [...merged].filter((id) =>
    match.participants.some((p) => p.characterId === id && p.alive === 'alive')
  )
}

/** 警长投票可选目标：仅限警上竞选者（含投自己） */
export function resolveSheriffVoteTargets(match: Match): MatchParticipant[] {
  if (match.runtime.currentPhaseId === 'sheriff-vote') finalizeSheriffCandidates(match)
  return getSheriffCandidateParticipants(match)
}

export function isSheriffCandidate(match: Match, participantId: string): boolean {
  return getSheriffCandidateIds(match).includes(participantId)
}

/** 警上发言结束后登记竞选状态 */
export function registerSheriffCampaign(match: Match, participantId: string, speech: string): void {
  if (match.runtime.currentPhaseId !== 'sheriff-speech') return
  const state = ensureWerewolfState(match)
  if (!state.sheriffCandidates) state.sheriffCandidates = []

  const intent = parseSheriffCampaignIntent(speech)
  if (intent === 'withdraw') {
    state.sheriffCandidates = state.sheriffCandidates.filter((id) => id !== participantId)
    return
  }
  // 警上发言默认视为参与竞选（含跳身份、报警徽流等），除非明确退水
  if (!state.sheriffCandidates.includes(participantId)) {
    state.sheriffCandidates.push(participantId)
  }
}

/** 警长投票解析失败时的补票：综合警上发言倾向 */
export function fallbackSheriffVoteTarget(
  match: Match,
  _voterId: string
): { targetId: string; targetName: string } | null {
  const candidates = resolveSheriffVoteTargets(match)
  if (!candidates.length) return null

  const positive = /信任|支持|认可|同意|投给|选他|选她|预言家面|好人面|逻辑|清晰|站边|警徽/
  const negative = /退水|不对|质疑|狼|假|不信|踩|查杀/
  const scores = new Map<string, number>()
  for (const c of candidates) scores.set(c.characterId, 0)

  for (const msg of match.messages.filter((m) => m.kind === 'speech' && m.confirmed)) {
    if (msg.phaseId !== 'sheriff-speech' && msg.phaseId !== 'sheriff-vote') continue
    for (const c of candidates) {
      if (!msg.content.includes(c.characterName) && !msg.content.includes(`${c.seatOrder}号`)) continue
      const delta = negative.test(msg.content) ? -2 : positive.test(msg.content) ? 2 : 1
      scores.set(c.characterId, (scores.get(c.characterId) || 0) + delta)
    }
  }

  let best = candidates[0]
  let bestScore = -Infinity
  for (const c of candidates) {
    const score = scores.get(c.characterId) ?? 0
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return { targetId: best.characterId, targetName: best.characterName }
}

/**
 * 警长投票不允许在「有竞选者」时大量弃权：
 * - 竞选者默认投自己
 * - 非竞选者从竞选者中补选
 */
export function normalizeSheriffVote(vote: MatchVoteRecord, match: Match, voterId: string): MatchVoteRecord {
  if (match.runtime.currentPhaseId !== 'sheriff-vote') return vote

  const candidates = resolveSheriffVoteTargets(match)
  if (!candidates.length) return vote

  const candidateIds = new Set(candidates.map((c) => c.characterId))
  if (!vote.abstain && vote.targetId && candidateIds.has(vote.targetId)) {
    return vote
  }

  const voter = match.participants.find((p) => p.characterId === voterId)
  if (candidateIds.has(voterId) && voter) {
    return {
      ...vote,
      abstain: false,
      abstainReason: null,
      targetId: voterId,
      targetName: voter.characterName,
    }
  }

  const fallback = fallbackSheriffVoteTarget(match, voterId)
  if (fallback) {
    return {
      ...vote,
      abstain: false,
      abstainReason: null,
      targetId: fallback.targetId,
      targetName: fallback.targetName,
    }
  }

  const first = candidates[0]
  return {
    ...vote,
    abstain: false,
    abstainReason: null,
    targetId: first.characterId,
    targetName: first.characterName,
  }
}
