import type { Match, MatchVoteRecord } from '@shared/arena/types'

function voteAbstainLabel(vote: MatchVoteRecord): string {
  if (!vote.abstain) return vote.targetName || '未知'
  if (vote.abstainReason === 'explicit') return '主动弃权'
  if (vote.abstainReason === 'parse_failed') return '未识别票(计弃权)'
  return '弃权'
}

function voteSummaryForPhase(match: Match): Array<{ name: string; count: number; voters: string[] }> {
  const phaseId = match.runtime.currentPhaseId
  const round = match.runtime.currentRound
  const votes = match.votes.filter((vote) => vote.round === round && vote.phaseId === phaseId)
  const sheriffId = match.runtime.werewolfState?.sheriffId || match.runtime.sheriffId || null
  const map = new Map<string, { name: string; count: number; voters: string[] }>()
  for (const vote of votes) {
    const key = vote.abstain || !vote.targetId ? `abstain:${vote.abstainReason || 'unknown'}` : vote.targetId
    const item = map.get(key) || { name: voteAbstainLabel(vote), count: 0, voters: [] }
    const weight = vote.voterId === sheriffId ? 1.5 : 1
    item.count += weight
    item.voters.push(vote.voterName + (weight > 1 ? '×1.5' : ''))
    map.set(key, item)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}

function formatVoteCount(count: number): string {
  return Number.isInteger(count) ? String(count) : count.toFixed(1)
}

export function formatVoteTallyMessage(match: Match): string {
  const phaseId = match.runtime.currentPhaseId
  const title = phaseId === 'sheriff-vote' ? '警长投票唱票结果' : '放逐投票唱票结果'
  const summary = voteSummaryForPhase(match)
  if (!summary.length) return title + '：暂无有效票型。'
  const lines = summary.map((item) => `${item.name} ${formatVoteCount(item.count)}票（${item.voters.join('、')}）`)
  return title + '：\n' + lines.join('\n')
}

export function completeVoteTallyMessage(match: Match): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((item) => item.id === messageId)
  if (!message) return
  message.content = formatVoteTallyMessage(match)
  message.streamStatus = 'done'
  message.confirmed = true
  match.runtime.activeVoteMessageId = null
}
