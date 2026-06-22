import { randomUUID } from '@renderer/utils/id'
import { arenaLog } from './logger'
import { ArenaError } from './errors'
import { gameModeService } from './character-service'
import { matchService } from './match-service'
import { modelCallService } from './model-call-service'
import {
  advanceToNextPhase,
  checkWinCondition,
  eliminateParticipant,
  getNextActorId,
  isPhaseStepComplete,
  markActorDone,
  resolveIdiotExile,
  resolveKnightDuel,
  resolveNightAction,
  resolveSheriffElection,
  resolveSystemPhase,
  tallyVotes,
  transferSheriffIfNeeded,
  triggerDeathSkill,
} from './phase-engine'
import type { Match, MatchMessage, MatchParticipant, MatchPublicEvent, MatchSnapshot } from '@shared/arena/types'

export type AdvanceStepOptions = {
  onDelta?: (match: Match) => void
}

async function saveSnapshot(match: Match, label: string): Promise<MatchSnapshot> {
  const snapshot: MatchSnapshot = {
    id: randomUUID(),
    matchId: match.id,
    label,
    createdAt: new Date().toISOString(),
    state: structuredClone(match.runtime),
  }
  await window.api.saveSnapshot(snapshot)
  return snapshot
}

function notifyDelta(match: Match, options?: AdvanceStepOptions): void {
  options?.onDelta?.(structuredClone(match))
}

function appendSystemEvent(match: Match, icon: string, text: string): MatchPublicEvent {
  const event: MatchPublicEvent = {
    id: randomUUID(),
    icon,
    text,
    createdAt: new Date().toISOString(),
    phaseId: match.runtime.currentPhaseId,
    round: match.runtime.currentRound,
  }
  match.events.unshift(event)
  return event
}

function appendRoomMessage(match: Match, content: string, kind: MatchMessage['kind'] = 'event', participantId = 'judge', participantName = '裁判', extra?: Partial<MatchMessage>) {
  match.messages.push({
    id: randomUUID(),
    kind,
    participantId,
    participantName,
    roleLabel: null,
    content,
    createdAt: new Date().toISOString(),
    round: match.runtime.currentRound,
    phaseId: match.runtime.currentPhaseId,
    confirmed: true,
    ...extra,
  })
}

function voteEligibleParticipants(match: Match): MatchParticipant[] {
  const noVote = new Set(match.runtime.currentPhaseId === 'sheriff-vote' ? [] : match.runtime.werewolfState?.revealedIdiotIds || [])
  return match.participants
    .filter((p) => p.alive === 'alive' && !noVote.has(p.characterId))
    .sort((a, b) => a.seatOrder - b.seatOrder)
}

function pendingVoteParticipants(match: Match): MatchParticipant[] {
  const done = new Set(match.runtime.actedCharacterIds)
  return voteEligibleParticipants(match).filter((p) => !done.has(p.characterId))
}

function ensureLiveVoteMessage(match: Match): MatchMessage {
  const existingId = match.runtime.activeVoteMessageId
  if (existingId) {
    const found = match.messages.find((m) => m.id === existingId)
    if (found) return found
  }
  const message: MatchMessage = {
    id: randomUUID(),
    kind: 'vote',
    participantId: 'judge',
    participantName: '投票',
    roleLabel: null,
    content: match.runtime.currentPhaseId === 'sheriff-vote' ? '警长投票进行中…' : '放逐投票进行中…',
    streamStatus: 'streaming',
    createdAt: new Date().toISOString(),
    round: match.runtime.currentRound,
    phaseId: match.runtime.currentPhaseId,
    confirmed: false,
  }
  match.messages.push(message)
  match.runtime.activeVoteMessageId = message.id
  return message
}

function updateLiveVoteMessage(match: Match): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((m) => m.id === messageId)
  if (!message) return
  const votes = match.votes.filter((v) => v.round === match.runtime.currentRound && v.phaseId === match.runtime.currentPhaseId)
  const eligible = voteEligibleParticipants(match).length
  message.content = '已收到 ' + votes.length + '/' + eligible + ' 票'
}

function finalizeLiveVoteMessage(match: Match): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((m) => m.id === messageId)
  if (message) {
    message.streamStatus = 'done'
    message.confirmed = true
    message.content = '投票完成，正在唱票…'
  }
  match.runtime.activeVoteMessageId = null
}

function appendSetupMessage(match: Match): void {
  if (match.messages.some((message) => message.kind === 'judge' && message.phaseId === 'setup')) return
  appendRoomMessage(match, '身份已经完成分配。本局只在公开频道展示阶段、发言、投票和规则允许公开的结算信息。', 'judge')
  match.messages[match.messages.length - 1].phaseId = 'setup'
}

function setSpeaking(match: Match, characterId: string | null): void {
  match.participants = match.participants.map((p) => ({ ...p, isSpeaking: characterId ? p.characterId === characterId : false }))
  match.runtime.currentSpeakerId = characterId
}

async function finishMatch(match: Match, summary: string, winnerCamp: string | null): Promise<Match> {
  return matchService.complete(match.id, summary, winnerCamp)
}

async function afterActorStep(match: Match, matchId: string, options?: AdvanceStepOptions): Promise<Match> {
  if (!isPhaseStepComplete(match)) {
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '当前行动已完成，可以继续下一位。'
    match = await matchService.save(match)
    await saveSnapshot(match, '单步行动完成')
    return match
  }

  const mode = gameModeService.get(match.gameModeId)
  if (!mode) return matchService.save(match)

  if (match.runtime.currentActionKind === 'vote') {
    if (match.runtime.currentPhaseId === 'sheriff-vote') {
      const result = resolveSheriffElection(match)
      appendSystemEvent(match, result.icon, result.text)
      appendRoomMessage(match, result.text, 'judge')
      match.runtime.voteTargetId = match.runtime.werewolfState?.sheriffId || match.runtime.sheriffId || null
    } else {
      const knightEvents = resolveKnightDuel(match)
      for (const item of knightEvents) {
        appendSystemEvent(match, '⚔️', item)
        appendRoomMessage(match, item, 'resource')
      }
      const { targetId, tied } = tallyVotes(match)
      if (targetId) {
        const idiot = resolveIdiotExile(match, targetId)
        if (idiot.prevented) {
          appendSystemEvent(match, '🃏', idiot.text || '白痴翻牌免死。')
          appendRoomMessage(match, idiot.text || '白痴翻牌免死。', 'judge')
          match.runtime.voteTargetId = targetId
        } else {
          const eliminated = eliminateParticipant(match, targetId)
          if (eliminated) {
            const text = eliminated.characterName + ' 被投票放逐。'
            appendSystemEvent(match, '🗳️', text)
            appendRoomMessage(match, text, 'vote', eliminated.characterId, eliminated.characterName)
            match.runtime.voteTargetId = targetId
            const deathEvents = triggerDeathSkill(match, eliminated, 'vote')
            for (const item of deathEvents) {
              appendSystemEvent(match, '💥', item)
              appendRoomMessage(match, item, 'resource')
            }
            const sheriffText = transferSheriffIfNeeded(match, eliminated)
            if (sheriffText) {
              appendSystemEvent(match, '⭐', sheriffText)
              appendRoomMessage(match, sheriffText, 'judge')
            }
          }
        }
      } else {
        const text = tied ? '本轮投票平票，无人出局。' : '本轮投票无人出局。'
        appendSystemEvent(match, '🗳️', text)
        appendRoomMessage(match, text, 'judge')
      }
    }
  }

  const win = checkWinCondition(match, mode)
  if (win) {
    appendSystemEvent(match, '🏆', win.summary)
    appendRoomMessage(match, win.summary, 'judge')
    match = await matchService.save(match)
    return finishMatch(match, win.summary, win.winnerCamp)
  }

  advanceToNextPhase(match, mode)
  const phaseText = '进入' + match.runtime.currentPhaseName + '。'
  appendSystemEvent(match, '🔔', phaseText)
  appendRoomMessage(match, phaseText + (match.runtime.waitingHint ? '\n' + match.runtime.waitingHint : ''), 'judge')
  match.runtime.stepAdvanceState = 'ready'
  match.runtime.waitingHint = '阶段已切换，可以继续推进。'
  match = await matchService.save(match)
  await saveSnapshot(match, '阶段切换后')
  notifyDelta(match, options)
  await arenaLog('info', 'engine', '阶段切换成功', match.runtime.currentPhaseName, { matchId })
  return match
}

export const matchEngine = {
  async load(matchId: string): Promise<Match> {
    return matchService.get(matchId)
  },

  async advanceStep(matchId: string, options?: AdvanceStepOptions): Promise<Match> {
    let match = await matchService.get(matchId)
    if (match.status === 'completed' || match.status === 'archived') throw new ArenaError('VALIDATION', '对局已结束', 'engine')
    if (match.status === 'paused') throw new ArenaError('ENGINE_PAUSED', '对局已暂停，请在 ESC 菜单中继续对局。', 'engine')
    if (match.runtime.stepAdvanceState === 'waiting') throw new ArenaError('ENGINE_PAUSED', '当前步骤尚未完成', 'engine')

    const mode = gameModeService.get(match.gameModeId)
    if (!mode) throw new ArenaError('VALIDATION', '玩法不存在', 'engine')
    appendSetupMessage(match)
    await saveSnapshot(match, '步骤开始前')
    match.runtime.stepAdvanceState = 'waiting'
    match.runtime.modelCallStatus = 'calling'
    match.runtime.waitingHint = '裁判正在处理当前阶段...'
    match = await matchService.save(match)

    try {
      if (match.runtime.currentActionKind === 'night') {
        const result = resolveNightAction(match, mode)
        appendSystemEvent(match, result.icon, result.text)
        appendRoomMessage(match, result.text + (result.details.length ? '\n' + result.details.join('\n') : ''), 'resource')
        for (const detail of result.details) appendSystemEvent(match, '✦', detail)
        markActorDone(match, 'night-' + match.runtime.currentPhaseId + '-' + match.runtime.currentRound)
        match.runtime.modelCallStatus = 'success'
        setSpeaking(match, null)
        match = await matchService.save(match)
        return afterActorStep(match, matchId, options)
      }

      if (match.runtime.currentActionKind === 'system' || match.runtime.currentActionKind === 'judge') {
        const text = resolveSystemPhase(match, mode)
        appendSystemEvent(match, '⚖️', text)
        appendRoomMessage(match, text, 'judge')
        markActorDone(match, 'judge-' + match.runtime.currentPhaseId + '-' + match.runtime.currentRound)
        match.runtime.modelCallStatus = 'success'
        setSpeaking(match, null)
        match = await matchService.save(match)
        return afterActorStep(match, matchId, options)
      }

      if (match.runtime.currentActionKind === 'vote') {
        const voters = pendingVoteParticipants(match)
        if (!voters.length) {
          match.runtime.modelCallStatus = 'success'
          return afterActorStep(match, matchId, options)
        }
        ensureLiveVoteMessage(match)
        appendSystemEvent(match, '🗳️', '投票开启，' + voters.length + ' 名玩家提交选择。')
        match = await matchService.save(match)
        notifyDelta(match, options)

        const voteBase = structuredClone(match)
        await Promise.all(
          voters.map(async (voter) => {
            const result = await modelCallService.performVote(structuredClone(voteBase), voter.characterId)
            match.votes.push(result.vote)
            match.totalCostCents += result.costCents
            match.modelCalls.push(result.callRecord)
            markActorDone(match, result.participant.characterId)
            updateLiveVoteMessage(match)
            match = await matchService.save(match)
            notifyDelta(match, options)
          })
        )
        finalizeLiveVoteMessage(match)
        match.runtime.modelCallStatus = 'success'
        setSpeaking(match, null)
        match = await matchService.save(match)
        notifyDelta(match, options)
        return afterActorStep(match, matchId, options)
      }

      const actorId = getNextActorId(match)
      if (!actorId) {
        match.runtime.modelCallStatus = 'success'
        return afterActorStep(match, matchId, options)
      }

      setSpeaking(match, actorId)
      const speaker = match.participants.find((p) => p.characterId === actorId)
      if (!speaker) throw new ArenaError('NOT_FOUND', '发言角色不存在', 'engine')

      const messageId = randomUUID()
      const placeholder: MatchMessage = {
        id: messageId,
        kind: 'speech',
        participantId: actorId,
        participantName: speaker.characterName,
        roleLabel: modelCallService.publicRoleLabel(match, speaker),
        content: '',
        thought: '',
        streamStatus: 'pending',
        createdAt: new Date().toISOString(),
        round: match.runtime.currentRound,
        phaseId: match.runtime.currentPhaseId,
        confirmed: false,
      }
      match.messages.push(placeholder)
      match = await matchService.save(match)
      notifyDelta(match, options)

      if (match.runtime.currentActionKind === 'speech') {
        const result = await modelCallService.performSpeechStream(match, actorId, (delta) => {
          const msg = match.messages.find((m) => m.id === messageId)
          if (!msg) return
          msg.content = delta.content
          msg.thought = delta.thought
          msg.streamStatus = delta.streamStatus
          notifyDelta(match, options)
        })
        match = result.match

        const msg = match.messages.find((m) => m.id === messageId)
        if (msg) {
          msg.content = result.content
          msg.thought = result.thought
          msg.streamStatus = 'done'
          msg.roleLabel = modelCallService.publicRoleLabel(match, result.participant)
          msg.confirmed = true
        }

        match.totalCostCents += result.costCents
        match.modelCalls.push(result.callRecord)
        match = await matchService.save(match)
        notifyDelta(match, options)

        const review = await modelCallService.reviewSpeech(match, result.participant, result.content, result.thought)
        if (msg) {
          msg.content = review.content
          if (review.thought) msg.thought = review.thought
        }
        for (const record of review.callRecords) match.modelCalls.push(record)
        match.totalCostCents += review.costCents
        if (review.review.warning) {
          match.anomalies.push({
            id: randomUUID(),
            matchId,
            type: 'judge_warning',
            message: review.review.warning,
            createdAt: new Date().toISOString(),
            resolved: false,
            resolution: null,
            characterId: result.participant.characterId,
            severity: review.review.severity,
          })
          appendSystemEvent(match, '⚠️', result.participant.characterName + ' 收到裁判提醒：' + review.review.warning)
          appendRoomMessage(match, result.participant.characterName + '，' + review.review.warning, 'warning')
        } else {
          appendSystemEvent(match, '✓', result.participant.characterName + ' 发言通过裁判审阅。')
        }
      }

      markActorDone(match, actorId)
      setSpeaking(match, null)
      match.runtime.modelCallStatus = 'success'
      match = await matchService.save(match)
      notifyDelta(match, options)
      return afterActorStep(match, matchId, options)
    } catch (error) {
      match = await matchService.get(matchId)
      match.runtime.modelCallStatus = 'failed'
      match.runtime.stepAdvanceState = 'paused'
      match.status = 'paused'
      match.runtime.waitingHint = error instanceof ArenaError ? error.message : '模型调用失败，对局已暂停。'
      match.anomalies.push({
        id: randomUUID(),
        matchId,
        type: 'model_failed',
        message: match.runtime.waitingHint,
        createdAt: new Date().toISOString(),
        resolved: false,
        resolution: null,
      })
      setSpeaking(match, null)
      await matchService.save(match)
      throw error
    }
  },

  async recoverFromSnapshot(matchId: string): Promise<Match> {
    const snapshot = await window.api.getLatestSnapshot(matchId)
    if (!snapshot) throw new ArenaError('NOT_FOUND', '没有可恢复快照', 'engine')
    const match = await matchService.get(matchId)
    match.runtime = structuredClone(snapshot.state)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '已从最近稳定快照恢复。'
    match.status = 'active'
    appendSystemEvent(match, '🔧', '已回到最近稳定步骤。')
    return matchService.save(match)
  },

  async resume(matchId: string): Promise<Match> {
    const match = await matchService.get(matchId)
    if (match.status !== 'paused' && match.status !== 'aborted') return match
    match.status = 'active'
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '对局已恢复，可以继续推进。'
    return matchService.save(match)
  },
}
