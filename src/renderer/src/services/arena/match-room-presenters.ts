import { characterExpressionByRef } from '@renderer/data/arena-visual-assets'
import { ttsService } from './tts-service'
import type { CharacterExpressionId } from '@shared/arena/character-visuals'
import type { Character, MatchMessage, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'

export type SpeechEmotion = {
  icon: string
  label: string
  energy: string
  certainty: string
  tags: string[]
  className: string
}

export function speechDisplayText(msg: MatchMessage): string {
  return msg.kind === 'speech' ? ttsService.stripDisplayText(msg.content) : msg.content
}

export function thoughtText(msg: MatchMessage | null): string {
  return ((msg as MatchMessage & { thought?: string } | null)?.thought || '').trim()
}

export function isSpeechStreaming(msg: MatchMessage): boolean {
  return msg.kind === 'speech' && (msg.streamStatus === 'pending' || msg.streamStatus === 'streaming')
}

export function isSpeechThinking(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && !speechDisplayText(msg).trim()
}

export function isSpeechLive(msg: MatchMessage): boolean {
  return isSpeechStreaming(msg) && Boolean(speechDisplayText(msg).trim())
}

export function isVoteTallyMessage(msg: MatchMessage): boolean {
  return msg.kind === 'vote' && msg.participantId === 'judge'
}

export function isVoteLive(msg: MatchMessage): boolean {
  return isVoteTallyMessage(msg) && msg.streamStatus === 'streaming'
}

export function isVoteDone(msg: MatchMessage): boolean {
  return isVoteTallyMessage(msg) && msg.streamStatus === 'done'
}

export function emotionForSpeechText(text: string): SpeechEmotion {
  const suspicion = (text.match(/怀疑|可疑|不对|狼人|狼坑|冲票|倒钩|划水|问题/g) || []).length
  const support = (text.match(/同意|相信|好人|支持|认可|站边|保下/g) || []).length
  const push = (text.match(/归票|必须|建议|投|推进|听发言|集中/g) || []).length
  const hedge = (text.match(/可能|也许|暂时|倾向|观察|不确定|先听/g) || []).length
  const info = (text.match(/查验|守护|解药|毒药|昨夜|票型|警徽流|身份/g) || []).length
  const intensity = suspicion + support + push + info
  const label =
    suspicion >= Math.max(support, push, info) && suspicion > 0
      ? '风险追踪'
      : push >= Math.max(support, info) && push > 0
        ? '节奏推进'
        : support >= Math.max(info, 1)
          ? '阵营站边'
          : info > 0
            ? '信息整理'
            : hedge > 0
              ? '谨慎试探'
              : '冷静推理'
  const icon =
    label === '风险追踪'
      ? '!'
      : label === '节奏推进'
        ? '◆'
        : label === '阵营站边'
          ? '✓'
          : label === '信息整理'
            ? '◇'
            : label === '谨慎试探'
              ? '?'
              : '·'
  const energy = intensity >= 4 ? '强表达' : intensity >= 2 ? '中表达' : '轻表达'
  const certainty = hedge >= 2 ? '低确定' : /一定|明确|必须|就是|确认/.test(text) ? '高确定' : '中确定'
  const tags = [
    energy,
    certainty,
    suspicion > 0 ? '疑点+' + suspicion : '',
    support > 0 ? '信任+' + support : '',
    push > 0 ? '推进+' + push : '',
    info > 0 ? '信息+' + info : '',
  ]
    .filter(Boolean)
    .slice(0, 4)
  return { icon, label, energy, certainty, tags, className: 'emotion-' + label }
}

export function emotionForMessage(msg: MatchMessage): SpeechEmotion | null {
  if (msg.kind !== 'speech') return null
  return emotionForSpeechText(speechDisplayText(msg) + ' ' + thoughtText(msg))
}

export function resolveSpeechExpressionId(msg: MatchMessage | null): CharacterExpressionId {
  if (!msg) return 'neutral'
  if (msg.kind !== 'speech') return 'neutral'
  if (isSpeechThinking(msg)) return 'thinking'
  if (isSpeechStreaming(msg)) return thoughtText(msg) ? 'thinking' : 'neutral'
  const emotion = emotionForMessage(msg)
  switch (emotion?.label) {
    case '风险追踪':
      return 'angry'
    case '节奏推进':
    case '阵营站边':
      return 'confident'
    case '谨慎试探':
      return 'sad'
    case '信息整理':
      return 'neutral'
    case '冷静推理':
      return 'happy'
    default:
      return 'neutral'
  }
}

/** 估算公开发言展示时长（毫秒），用于沉浸圆桌头像进度环 */
export function estimateSpeechDurationMs(text: string, isHumanPlayer = false): number {
  if (isHumanPlayer) return 86400000
  const chars = text.replace(/\s/g, '').length
  return Math.min(60000, Math.max(8000, chars * 200 + 1500))
}

export function pickLiveSpeechMessage(
  messages: MatchMessage[],
  activeSpeakerId: string | null
): MatchMessage | null {
  if (!activeSpeakerId) return null
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.kind !== 'speech' || msg.participantId !== activeSpeakerId) continue
    if (msg.streamStatus === 'pending' || msg.streamStatus === 'streaming' || msg.streamStatus === 'done') {
      return msg
    }
  }
  return null
}

export function pickFocusMessage(messages: MatchMessage[], activeSpeakerId: string | null): MatchMessage | null {
  if (!messages.length) return null
  const reversed = [...messages].reverse()
  if (activeSpeakerId) {
    const live = reversed.find(
      (item) =>
        item.kind === 'speech' &&
        item.participantId === activeSpeakerId &&
        (item.streamStatus === 'streaming' || item.streamStatus === 'pending')
    )
    if (live) return live
    const recentDone = reversed.find(
      (item) =>
        item.kind === 'speech' &&
        item.participantId === activeSpeakerId &&
        (item.streamStatus === 'done' || item.streamStatus === 'failed')
    )
    if (recentDone) return recentDone
  }
  const eventKinds = new Set(['judge', 'vote', 'warning', 'system', 'event', 'resource'])
  const event = reversed.find((item) => eventKinds.has(item.kind))
  if (event) return event
  return reversed.find((item) => item.kind === 'speech') || reversed[0] || null
}

export function focusStageKind(msg: MatchMessage | null): 'speech' | 'judge' | 'vote' | 'event' | 'idle' {
  if (!msg) return 'idle'
  if (msg.kind === 'speech') return 'speech'
  if (msg.kind === 'vote') return 'vote'
  if (msg.kind === 'judge' || msg.kind === 'warning' || msg.kind === 'system') return 'judge'
  return 'event'
}

export function participantExpressionUrl(
  character: Character | null | undefined,
  participant: MatchParticipant | null | undefined,
  expressionId: CharacterExpressionId
): string {
  if (!character && !participant) {
    return characterExpressionByRef('', { expressionId })
  }
  const ref = character?.expressionUrls?.[expressionId]
  return characterExpressionByRef(ref || '', {
    name: participant?.characterName || character?.name,
    index: participant?.seatOrder || 0,
    modelId: participant?.modelId || character?.modelId,
    expressionId,
    characterId: participant?.characterId || character?.id,
  })
}

export function voteAbstainLabel(vote: MatchVoteRecord): string {
  if (!vote.abstain) return vote.targetName || '未知'
  if (vote.abstainReason === 'explicit') return '主动弃权'
  if (vote.abstainReason === 'parse_failed') return '未识别票(计弃权)'
  return '弃权'
}

export function isPlayerSelfSeat(
  participant: MatchParticipant,
  selfPlayerId: string | null | undefined,
  viewMode: 'god' | 'player'
): boolean {
  return viewMode === 'player' && Boolean(selfPlayerId && participant.characterId === selfPlayerId)
}

export function visibleRoleNameForParticipant(
  participant: MatchParticipant,
  viewMode: 'god' | 'player',
  guessedRoles: Record<string, string>,
  selfPlayerId?: string | null
): string {
  if (viewMode === 'god' || participant.revealed || participant.alive === 'eliminated') {
    return participant.roleName || '未知'
  }
  if (isPlayerSelfSeat(participant, selfPlayerId, viewMode)) {
    return participant.roleName || '未知'
  }
  return guessedRoles[participant.characterId]
    ? '疑似' + guessedRoles[participant.characterId]
    : '未公开'
}

export function participantCampClass(
  participant: MatchParticipant,
  viewMode: 'god' | 'player',
  guessedRoles: Record<string, string>,
  selfPlayerId?: string | null
): string {
  if (
    viewMode === 'player' &&
    !participant.revealed &&
    participant.alive !== 'eliminated' &&
    !isPlayerSelfSeat(participant, selfPlayerId, viewMode)
  ) {
    return guessedRoles[participant.characterId] ? 'camp-guess' : 'camp-hidden'
  }
  if (participant.roleId === 'villager') return 'camp-villager'
  return participant.roleCamp === 'wolf'
    ? 'camp-wolf'
    : participant.roleCamp === 'good'
      ? 'camp-good'
      : 'camp-neutral'
}

export function voteSummaryForMessage(msg: MatchMessage, votes: MatchVoteRecord[], sheriffId: string | null) {
  const scoped = votes.filter((vote) => vote.round === msg.round && vote.phaseId === msg.phaseId)
  const map = new Map<string, { name: string; count: number; voters: string[] }>()
  for (const vote of scoped) {
    const key = vote.abstain || !vote.targetId ? `abstain:${vote.abstainReason || 'unknown'}` : vote.targetId
    const item = map.get(key) || { name: voteAbstainLabel(vote), count: 0, voters: [] }
    const weight = vote.voterId === sheriffId ? 1.5 : 1
    item.count += weight
    item.voters.push(vote.voterName + (weight > 1 ? '×1.5' : ''))
    map.set(key, item)
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
}
