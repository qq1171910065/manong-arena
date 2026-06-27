import { randomUUID } from '@renderer/utils/id'
import { arenaLog } from './logger'
import { ArenaError } from './errors'
import { gameModeService } from './character-service'
import { matchService } from './match-service'
import { modelCallService, cancelActiveSpeechStream } from './model-call-service'
import { registerSheriffCampaign } from './werewolf-sheriff'
import { completeVoteTallyMessage } from './werewolf-vote-tally'
import {
  collectNightLastWordsTargets,
  collectVoteLastWordsTargets,
  startLastWordsPhase,
} from '@shared/arena/werewolf-last-words'
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
import { advanceRoundtablePhase, checkRoundtableComplete, isRoundtableMode } from './roundtable-engine'
import type { Match, MatchMessage, MatchParticipant, MatchPublicEvent, MatchSnapshot } from '@shared/arena/types'

export type MatchStreamPatch = {
  messageId: string
  content: string
  thought?: string
  streamStatus: MatchMessage['streamStatus']
}

export type AdvanceStepOptions = {
  onDelta?: (match: Match) => void
  onStream?: (patch: MatchStreamPatch) => void
}

type PendingSpeechReview = {
  messageId: string
  participant: MatchParticipant
  promise: ReturnType<typeof modelCallService.reviewSpeech>
}

const pendingSpeechReviews = new Map<string, PendingSpeechReview[]>()

let activeAdvanceMatchId: string | null = null
let activeAdvanceToken = 0

function beginAdvance(matchId: string): number {
  activeAdvanceMatchId = matchId
  activeAdvanceToken += 1
  return activeAdvanceToken
}

function isAdvanceCancelled(matchId: string, token: number): boolean {
  return activeAdvanceMatchId !== matchId || activeAdvanceToken !== token
}

function endAdvance(matchId: string, token: number): void {
  if (activeAdvanceMatchId === matchId && activeAdvanceToken === token) {
    activeAdvanceMatchId = null
  }
}

function hasIncompleteLiveMessages(match: Match): boolean {
  return match.messages.some(
    (m) =>
      !m.confirmed &&
      (m.streamStatus === 'pending' ||
        m.streamStatus === 'streaming' ||
        (m.kind === 'vote' && m.streamStatus === 'streaming'))
  )
}

function rollbackInProgressStep(match: Match): Match {
  const incompleteSpeechSpeakerIds = new Set(
    match.messages
      .filter(
        (m) =>
          m.kind === 'speech' &&
          !m.confirmed &&
          (m.streamStatus === 'pending' || m.streamStatus === 'streaming')
      )
      .map((m) => m.participantId)
  )

  match.messages = match.messages.filter((m) => {
    if (m.kind === 'speech' && !m.confirmed && (m.streamStatus === 'pending' || m.streamStatus === 'streaming')) {
      return false
    }
    if (m.kind === 'vote' && !m.confirmed && m.streamStatus === 'streaming') {
      return false
    }
    return true
  })

  if (match.runtime.activeVoteMessageId) {
    const voteMsg = match.messages.find((m) => m.id === match.runtime.activeVoteMessageId)
    if (!voteMsg) match.runtime.activeVoteMessageId = undefined
  }

  if (match.runtime.stepAdvanceState === 'waiting' || incompleteSpeechSpeakerIds.size) {
    match.runtime.actedCharacterIds = match.runtime.actedCharacterIds.filter(
      (id) => !incompleteSpeechSpeakerIds.has(id) && id !== match.runtime.currentSpeakerId
    )
  }

  setSpeaking(match, null)
  match.runtime.modelCallStatus = null
  if (match.status === 'active') {
    match.runtime.stepAdvanceState = 'ready'
  }
  return match
}

async function abortInProgressStep(matchId: string): Promise<void> {
  activeAdvanceToken += 1
  activeAdvanceMatchId = null
  cancelActiveSpeechStream()
  flushPendingMatchDelta()
}

async function saveSnapshot(match: Match, label: string): Promise<MatchSnapshot> {
  const snapshot: MatchSnapshot = {
    id: randomUUID(),
    matchId: match.id,
    label,
    createdAt: new Date().toISOString(),
    state: JSON.parse(JSON.stringify(match.runtime)) as MatchSnapshot['state'],
  }
  await window.api.saveSnapshot(snapshot)
  return snapshot
}

function deferSnapshot(match: Match, label: string): void {
  const runtime = match.runtime
  const id = match.id
  window.setTimeout(() => {
    void saveSnapshot({ ...match, id, runtime } as Match, label).catch(() => undefined)
  }, 0)
}

const DELTA_MIN_INTERVAL_MS = 200
let deltaLastEmit = 0
let deltaTimer: ReturnType<typeof setTimeout> | undefined
let deltaPending: { match: Match; options: AdvanceStepOptions } | null = null

export function flushPendingMatchDelta(): void {
  if (deltaTimer !== undefined) {
    clearTimeout(deltaTimer)
    deltaTimer = undefined
  }
  if (!deltaPending?.options.onDelta) {
    deltaPending = null
    return
  }
  const { match, options } = deltaPending
  deltaPending = null
  deltaLastEmit = Date.now()
  options.onDelta(match)
}

function notifyDelta(match: Match, options?: AdvanceStepOptions, immediate = false): void {
  if (!options?.onDelta) return
  if (immediate) {
    if (deltaTimer !== undefined) {
      clearTimeout(deltaTimer)
      deltaTimer = undefined
    }
    deltaPending = null
    deltaLastEmit = Date.now()
    options.onDelta(match)
    return
  }
  deltaPending = { match, options }
  const now = Date.now()
  const elapsed = now - deltaLastEmit
  if (elapsed >= DELTA_MIN_INTERVAL_MS) {
    deltaLastEmit = now
    options.onDelta(match)
    return
  }
  if (deltaTimer === undefined) {
    deltaTimer = setTimeout(() => {
      deltaTimer = undefined
      flushPendingMatchDelta()
    }, DELTA_MIN_INTERVAL_MS - elapsed)
  }
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

function updateLiveVoteMessage(match: Match, options?: AdvanceStepOptions): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((m) => m.id === messageId)
  if (!message) return
  const votes = match.votes.filter((v) => v.round === match.runtime.currentRound && v.phaseId === match.runtime.currentPhaseId)
  const eligible = voteEligibleParticipants(match).length
  message.content = '已收到 ' + votes.length + '/' + eligible + ' 票'
  patchLiveVoteMessage(match, options)
}

function patchLiveVoteMessage(match: Match, options?: AdvanceStepOptions): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((m) => m.id === messageId)
  if (!message) return
  options?.onStream?.({
    messageId: message.id,
    content: message.content,
    streamStatus: message.streamStatus,
  })
}

function finalizeLiveVoteMessage(match: Match): void {
  const messageId = match.runtime.activeVoteMessageId
  if (!messageId) return
  const message = match.messages.find((m) => m.id === messageId)
  if (message) {
    message.streamStatus = 'done'
    message.confirmed = true
    if (!message.content.trim()) {
      message.content = '投票完成，正在唱票…'
    }
  }
}

function appendSetupMessage(match: Match): boolean {
  if (match.messages.some((message) => message.kind === 'judge' && message.phaseId === 'setup')) return false
  appendRoomMessage(match, '身份已经完成分配。本局只在公开频道展示阶段、发言、投票和规则允许公开的结算信息。', 'judge')
  match.messages[match.messages.length - 1].phaseId = 'setup'
  return true
}

function setSpeaking(match: Match, characterId: string | null): void {
  match.participants = match.participants.map((p) => ({ ...p, isSpeaking: characterId ? p.characterId === characterId : false }))
  match.runtime.currentSpeakerId = characterId
}

async function finishMatch(match: Match, summary: string, winnerCamp: string | null): Promise<Match> {
  return matchService.complete(match.id, summary, winnerCamp)
}

function queueSpeechReview(
  matchId: string,
  messageId: string,
  participant: MatchParticipant,
  match: Match,
  content: string,
  thought?: string
): void {
  const promise = modelCallService.reviewSpeech(match, participant, content, thought)
  const jobs = pendingSpeechReviews.get(matchId) || []
  jobs.push({ messageId, participant, promise })
  pendingSpeechReviews.set(matchId, jobs)
}

function applySpeechReviewResult(match: Match, messageId: string, participant: MatchParticipant, review: Awaited<ReturnType<typeof modelCallService.reviewSpeech>>): void {
  const msg = match.messages.find((m) => m.id === messageId)
  if (msg) {
    msg.content = review.content
    if (review.thought) msg.thought = review.thought
  }
  match.totalCostCents += review.costCents
  match.modelCalls.push(...review.callRecords)
  if (review.review.warning) {
    match.anomalies.push({
      id: randomUUID(),
      matchId: match.id,
      type: 'judge_warning',
      message: review.review.warning,
      createdAt: new Date().toISOString(),
      resolved: false,
      resolution: null,
      characterId: participant.characterId,
      severity: review.review.severity,
    })
    appendSystemEvent(match, '⚠️', participant.characterName + ' 收到裁判提醒：' + review.review.warning)
    appendRoomMessage(match, participant.characterName + '，' + review.review.warning, 'warning')
  }
}

async function flushSpeechReviews(matchId: string, options?: AdvanceStepOptions): Promise<Match> {
  const jobs = pendingSpeechReviews.get(matchId) || []
  pendingSpeechReviews.delete(matchId)
  if (!jobs.length) return matchService.get(matchId)

  let match = await matchService.get(matchId)
  match.runtime.waitingHint = '裁判正在汇总本阶段发言审阅…'
  match = await matchService.save(match)
  notifyDelta(match, options)

  for (const job of jobs) {
    try {
      const review = await job.promise
      applySpeechReviewResult(match, job.messageId, job.participant, review)
    } catch (error) {
      await arenaLog('warn', 'engine', '后台裁判审阅失败', error instanceof Error ? error.message : String(error), {
        matchId,
        characterId: job.participant.characterId,
      })
    }
  }
  match = await matchService.save(match)
  notifyDelta(match, options)
  return match
}

async function afterActorStep(match: Match, matchId: string, options?: AdvanceStepOptions): Promise<Match> {
  if (!isPhaseStepComplete(match)) {
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = match.runtime.currentPhaseId === 'last-words' ? match.runtime.waitingHint : '当前行动已完成，可以继续下一位。'
    match = await matchService.save(match)
    void deferSnapshot(match, '单步行动完成')
    return match
  }

  if (match.runtime.currentActionKind === 'speech') {
    match = await flushSpeechReviews(matchId, options)
  }

  const mode = gameModeService.get(match.gameModeId)
  if (!mode) return matchService.save(match)

  let deferPhaseAdvance = false

  if (match.runtime.currentActionKind === 'vote') {
    completeVoteTallyMessage(match)
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
      let eliminatedForLastWords: MatchParticipant | null = null
      if (targetId) {
        const idiot = resolveIdiotExile(match, targetId)
        if (idiot.prevented) {
          appendSystemEvent(match, '🃏', idiot.text || '白痴翻牌免死。')
          appendRoomMessage(match, idiot.text || '白痴翻牌免死。', 'judge')
          match.runtime.voteTargetId = targetId
        } else {
          const eliminated = eliminateParticipant(match, targetId)
          if (eliminated) {
            eliminatedForLastWords = eliminated
            const text = eliminated.characterName + ' 被投票放逐。'
            appendSystemEvent(match, '🗳️', text)
            appendRoomMessage(match, text, 'judge')
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
      const lastWordsIds = collectVoteLastWordsTargets(match, eliminatedForLastWords)
      if (lastWordsIds.length && !checkWinCondition(match, mode)) {
        startLastWordsPhase(match, lastWordsIds)
        appendRoomMessage(match, match.runtime.waitingHint || '请发表遗言。', 'judge')
        deferPhaseAdvance = true
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

  const roundtableDone = checkRoundtableComplete(match, mode)
  if (roundtableDone) {
    appendSystemEvent(match, '🎙️', roundtableDone.summary)
    appendRoomMessage(match, roundtableDone.summary, 'judge')
    match = await matchService.save(match)
    return finishMatch(match, roundtableDone.summary, null)
  }

  if (deferPhaseAdvance) {
    match.runtime.stepAdvanceState = 'ready'
    match = await matchService.save(match)
    void deferSnapshot(match, '遗言阶段')
    notifyDelta(match, options, true)
    return match
  }

  if (match.runtime.currentPhaseId === 'last-words') {
    match.runtime.pendingLastWordsIds = undefined
  }

  if (isRoundtableMode(mode)) advanceRoundtablePhase(match, mode)
  else advanceToNextPhase(match, mode)
  const phaseText = '进入' + match.runtime.currentPhaseName + '。'
  appendSystemEvent(match, '🔔', phaseText)
  appendRoomMessage(match, phaseText + (match.runtime.waitingHint ? '\n' + match.runtime.waitingHint : ''), 'judge')
  match.runtime.stepAdvanceState = 'ready'
  match.runtime.waitingHint = '阶段已切换，可以继续推进。'
  match = await matchService.save(match)
  void deferSnapshot(match, '阶段切换后')
  notifyDelta(match, options, true)
  await arenaLog('info', 'engine', '阶段切换成功', match.runtime.currentPhaseName, { matchId })
  return match
}

function recoverInterruptedStep(match: Match): Match {
  if (match.runtime.stepAdvanceState !== 'waiting' && !hasIncompleteLiveMessages(match)) return match
  rollbackInProgressStep(match)
  match.runtime.waitingHint = '上次未完成的步骤已回滚，可以继续推进。'
  return match
}

export const matchEngine = {
  async load(matchId: string): Promise<Match> {
    let match = await matchService.get(matchId)
    if (
      (match.runtime.stepAdvanceState === 'waiting' || hasIncompleteLiveMessages(match)) &&
      (match.status === 'active' || match.status === 'paused')
    ) {
      match = recoverInterruptedStep(structuredClone(match))
      return matchService.save(match)
    }
    return match
  },

  async abortAndRollback(matchId: string): Promise<Match> {
    await abortInProgressStep(matchId)
    let match = await matchService.get(matchId)
    if (match.runtime.stepAdvanceState === 'waiting' || hasIncompleteLiveMessages(match)) {
      match = rollbackInProgressStep(match)
      if (match.status === 'active') {
        match.runtime.stepAdvanceState = 'ready'
      } else if (match.status === 'paused') {
        match.runtime.stepAdvanceState = 'paused'
      }
      match.runtime.modelCallStatus = null
      match = await matchService.save(match)
    }
    return match
  },

  async pause(matchId: string, reason: string): Promise<Match> {
    await abortInProgressStep(matchId)
    let match = await matchService.get(matchId)
    match = rollbackInProgressStep(match)
    match.status = 'paused'
    match.runtime.stepAdvanceState = 'paused'
    match.runtime.waitingHint = reason
    match.runtime.modelCallStatus = null
    match.anomalies.push({
      id: randomUUID(),
      matchId,
      type: 'paused',
      message: reason,
      createdAt: new Date().toISOString(),
      resolved: false,
      resolution: null,
    })
    return matchService.save(match)
  },

  async advanceStep(matchId: string, options?: AdvanceStepOptions): Promise<Match> {
    let match = await matchService.get(matchId)
    if (match.status === 'completed' || match.status === 'archived') throw new ArenaError('VALIDATION', '对局已结束', 'engine')
    if (match.status === 'paused') throw new ArenaError('ENGINE_PAUSED', '对局已暂停，请在 ESC 菜单中继续对局。', 'engine')
    if (match.runtime.stepAdvanceState === 'waiting') throw new ArenaError('ENGINE_PAUSED', '当前步骤尚未完成', 'engine')

    const advanceToken = beginAdvance(matchId)
    const mode = gameModeService.get(match.gameModeId)
    if (!mode) throw new ArenaError('VALIDATION', '玩法不存在', 'engine')
    const setupAdded = appendSetupMessage(match)
    void deferSnapshot(match, '步骤开始前')
    match.runtime.stepAdvanceState = 'waiting'
    match.runtime.modelCallStatus = 'calling'
    match.runtime.waitingHint = '裁判正在处理当前阶段...'
    match = await matchService.save(match)
    if (setupAdded) notifyDelta(match, options, true)

    try {
      if (match.runtime.currentActionKind === 'night') {
        const result = resolveNightAction(match, mode)
        appendSystemEvent(match, result.icon, result.text)
        const publicBody = result.text + (result.publicDetails.length ? '\n' + result.publicDetails.join('\n') : '')
        const godViewContent = result.godDetails.length
          ? '夜间各角色行动如下：\n' + result.godDetails.join('\n')
          : undefined
        appendRoomMessage(match, publicBody, 'resource', 'judge', '裁判', { godViewContent })
        for (const detail of result.publicDetails) appendSystemEvent(match, '✦', detail)
        markActorDone(match, 'night-' + match.runtime.currentPhaseId + '-' + match.runtime.currentRound)
        match.runtime.modelCallStatus = 'success'
        setSpeaking(match, null)
        const lastWordsIds = collectNightLastWordsTargets(match, result.eliminated)
        if (lastWordsIds.length && !checkWinCondition(match, mode)) {
          startLastWordsPhase(match, lastWordsIds)
          appendRoomMessage(match, match.runtime.waitingHint || '请发表遗言。', 'judge')
          match.runtime.stepAdvanceState = 'ready'
          match = await matchService.save(match)
          notifyDelta(match, options)
          return match
        }
        match = await matchService.save(match)
        return afterActorStep(match, matchId, options)
      }

      if (match.runtime.currentActionKind === 'system' || match.runtime.currentActionKind === 'judge') {
        let text = resolveSystemPhase(match, mode)
        if (isRoundtableMode(mode) && match.runtime.currentPhaseId === 'opening') {
          const topic = match.runtime.roundtableState?.discussionTopic || '自由讨论'
          text = `主持人：欢迎参加圆桌讨论。今日议题——「${topic}」。请各位依次发表观点。`
        }
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
            for (const record of result.callRecords) match.modelCalls.push(record)
            markActorDone(match, result.participant.characterId)
            updateLiveVoteMessage(match, options)
            match = await matchService.save(match)
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
      notifyDelta(match, options, true)

      if (match.runtime.currentActionKind === 'speech') {
        const result = await modelCallService.performSpeechStream(match, actorId, (delta) => {
          if (isAdvanceCancelled(matchId, advanceToken)) return
          const msg = match.messages.find((m) => m.id === messageId)
          if (!msg) return
          msg.content = delta.content
          msg.thought = delta.thought
          msg.streamStatus = delta.streamStatus
          options?.onStream?.({
            messageId,
            content: delta.content,
            thought: delta.thought,
            streamStatus: delta.streamStatus,
          })
        })
        if (isAdvanceCancelled(matchId, advanceToken)) {
          throw new ArenaError('ENGINE_ABORTED', '步骤已取消', 'engine')
        }
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
        if (msg?.content && match.runtime.currentPhaseId !== 'last-words') {
          registerSheriffCampaign(match, actorId, msg.content)
        }
        queueSpeechReview(matchId, messageId, result.participant, match, result.content, result.thought)
        match = await matchService.save(match)
        notifyDelta(match, options, true)
      }

      markActorDone(match, actorId)
      setSpeaking(match, null)
      match.runtime.modelCallStatus = 'success'
      match = await matchService.save(match)
      notifyDelta(match, options, true)
      return afterActorStep(match, matchId, options)
    } catch (error) {
      match = await matchService.get(matchId)
      if (error instanceof ArenaError && error.code === 'ENGINE_ABORTED') {
        rollbackInProgressStep(match)
        match.runtime.modelCallStatus = null
        match.runtime.stepAdvanceState = match.status === 'paused' ? 'paused' : 'ready'
        await matchService.save(match)
        throw error
      }
      if (error instanceof ArenaError && error.code === 'ENGINE_PAUSED') {
        setSpeaking(match, null)
        match.runtime.modelCallStatus = null
        match.runtime.stepAdvanceState = 'paused'
        await matchService.save(match)
        throw error
      }
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
    } finally {
      endAdvance(matchId, advanceToken)
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
