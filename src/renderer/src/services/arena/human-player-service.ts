import { randomUUID } from '@renderer/utils/id'
import { ArenaError } from './errors'
import { getUserProfileCharacterId } from './user-profile-service'
import { matchService } from './match-service'
import { normalizeSheriffVote, registerSheriffCampaign, resolveSheriffVoteTargets } from './werewolf-sheriff'
import {
  appendAiWolfDiscussion,
  appendAiWolfKillVotes,
  computeNightKnifeTarget,
  ensureWerewolfState,
  finalizeWolfKillTarget,
  listGuardProtectCandidates,
  listSeerCheckCandidates,
  markActorDone,
  resetGuardNightFlow,
  resetSeerNightFlow,
  resetWolfNightFlow,
  resetWitchNightFlow,
} from './phase-engine'
import { isDiscussionGameModeId } from '@shared/arena/discussion-mode'
import type { HumanInputKind, Match, MatchParticipant, MatchVoteRecord } from '@shared/arena/types'

function setSpeaking(match: Match, characterId: string | null): void {
  match.participants = match.participants.map((p) => ({
    ...p,
    isSpeaking: characterId ? p.characterId === characterId : false,
  }))
  match.runtime.currentSpeakerId = characterId
}

function syncParticipantControl(match: Match, characterId: string | null, controlledBy: 'ai' | 'user'): void {
  match.participants = match.participants.map((p) =>
    p.characterId === characterId ? { ...p, controlledBy } : p
  )
}

function clearHumanInput(match: Match): void {
  match.runtime.humanInputKind = null
  match.runtime.humanInputMessageId = null
}

export function isHumanActionPending(match: Match): boolean {
  return Boolean(match.runtime.humanInputKind)
}

export function isUserProfileInMatch(match: Match, profileId: string | null): boolean {
  if (!profileId) return false
  return match.participants.some((p) => p.characterId === profileId)
}

export function canTakeOverMatch(match: Match, profileId: string | null): boolean {
  if (!profileId || !isUserProfileInMatch(match, profileId)) return false
  if (isDiscussionGameModeId(match.gameModeId)) return false
  if (match.runtime.humanTakeoverLocked) return false
  if (match.status !== 'active' && match.status !== 'paused') return false
  const participant = match.participants.find((p) => p.characterId === profileId)
  if (!participant || participant.alive !== 'alive') return false
  if (match.runtime.humanControlledId === profileId) return false
  return true
}

export function isHumanControlledMatch(match: Match, profileId: string | null): boolean {
  return Boolean(profileId && match.runtime.humanControlledId === profileId)
}

export function canViewWolfTeamChannel(match: Match, profileId: string | null, viewMode: 'god' | 'player'): boolean {
  if (viewMode === 'god') return true
  const humanId = match.runtime.humanControlledId
  if (!humanId) return false
  const self = match.participants.find((p) => p.characterId === humanId)
  return self?.roleCamp === 'wolf' && self.alive === 'alive'
}

export function wolfTeamMessagesForMatch(match: Match, profileId: string | null, viewMode: 'god' | 'player') {
  if (!canViewWolfTeamChannel(match, profileId, viewMode)) return []
  return (match.runtime.werewolfState?.wolfTeamMessages || []).filter(
    (item) => item.round === match.runtime.currentRound
  )
}

export function lockTakeoverOnGodView(match: Match): Match {
  if (match.runtime.humanTakeoverLocked) return match
  match.runtime.humanTakeoverLocked = true
  if (match.runtime.humanControlledId) {
    const profileId = match.runtime.humanControlledId
    match.runtime.humanControlledId = null
    syncParticipantControl(match, profileId, 'ai')
    const pendingId = match.runtime.humanInputMessageId
    if (pendingId) {
      match.messages = match.messages.filter((m) => m.id !== pendingId)
    }
    clearHumanInput(match)
    setSpeaking(match, null)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '已切换上帝视角，真人接管已解除。'
  }
  return match
}

function resolveHumanSpeechMessage(match: Match, messageId: string, actorId: string): Match['messages'][number] | null {
  let msg = match.messages.find((m) => m.id === messageId)
  const speaker = match.participants.find((p) => p.characterId === actorId)
  if (!msg) {
    msg = match.messages.find(
      (m) =>
        m.kind === 'speech' &&
        m.participantId === actorId &&
        m.isHumanPlayer &&
        !m.confirmed
    )
    if (msg && msg.id !== messageId) {
      match.runtime.humanInputMessageId = msg.id
    }
  }
  if (!msg && speaker) {
    msg = {
      id: messageId,
      kind: 'speech',
      participantId: actorId,
      participantName: speaker.characterName,
      roleLabel: null,
      content: '',
      streamStatus: 'streaming',
      isHumanPlayer: true,
      createdAt: new Date().toISOString(),
      round: match.runtime.currentRound,
      phaseId: match.runtime.currentPhaseId,
      confirmed: false,
    }
    match.messages.push(msg)
  }
  return msg || null
}

export const humanPlayerService = {
  async takeOver(matchId: string): Promise<Match> {
    const profileId = await getUserProfileCharacterId()
    if (!profileId) throw new ArenaError('VALIDATION', '尚未创建 AI 分身', 'match')

    let match = await matchService.get(matchId)
    if (!canTakeOverMatch(match, profileId)) {
      if (match.runtime.humanTakeoverLocked) {
        throw new ArenaError('VALIDATION', '本局已开启上帝视角，无法再次真人接管', 'match')
      }
      throw new ArenaError('VALIDATION', '当前无法接管该角色', 'match')
    }

    match.runtime.humanControlledId = profileId
    match.runtime.userProfileCharacterId = profileId
    syncParticipantControl(match, profileId, 'user')
    match.runtime.waitingHint = '你已接管 AI 分身，需要操作时会在消息区出现输入面板。'
    return matchService.save(match)
  },

  async release(matchId: string): Promise<Match> {
    const profileId = await getUserProfileCharacterId()
    let match = await matchService.get(matchId)
    if (!profileId || match.runtime.humanControlledId !== profileId) return match

    const pendingId = match.runtime.humanInputMessageId
    if (pendingId) {
      match.messages = match.messages.filter((m) => m.id !== pendingId)
    }
    clearHumanInput(match)
    setSpeaking(match, null)
    match.runtime.stepAdvanceState = 'ready'

    match.runtime.humanControlledId = null
    syncParticipantControl(match, profileId, 'ai')
    match.runtime.waitingHint = '已交还给 AI 分身，将继续自动推进。'
    return matchService.save(match)
  },

  async updateDraft(matchId: string, content: string): Promise<Match> {
    let match = await matchService.get(matchId)
    if (match.runtime.humanInputKind !== 'speech') {
      throw new ArenaError('VALIDATION', '当前不在真人发言阶段', 'match')
    }
    const messageId = match.runtime.humanInputMessageId
    const actorId = match.runtime.humanControlledId
    if (!messageId || !actorId) throw new ArenaError('VALIDATION', '当前不在真人发言阶段', 'match')

    const msg = resolveHumanSpeechMessage(match, messageId, actorId)
    if (!msg) throw new ArenaError('NOT_FOUND', '发言消息不存在', 'match')

    msg.content = content
    msg.streamStatus = 'streaming'
    msg.isHumanPlayer = true
    return matchService.save(match)
  },

  async submitSpeech(matchId: string, content: string): Promise<Match> {
    const trimmed = content.trim()
    if (!trimmed) throw new ArenaError('VALIDATION', '发言内容不能为空', 'match')

    let match = await matchService.get(matchId)
    const messageId = match.runtime.humanInputMessageId
    const actorId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'speech' || !messageId || !actorId) {
      throw new ArenaError('VALIDATION', '当前不在真人发言阶段', 'match')
    }

    let msg = resolveHumanSpeechMessage(match, messageId, actorId)
    const speaker = match.participants.find((p) => p.characterId === actorId)
    if (!msg || !speaker) throw new ArenaError('NOT_FOUND', '发言消息不存在', 'match')

    msg.content = trimmed
    msg.streamStatus = 'done'
    msg.confirmed = true
    msg.isHumanPlayer = true
    if (match.runtime.currentPhaseId === 'sheriff-speech') {
      registerSheriffCampaign(match, actorId, trimmed)
    }
    clearHumanInput(match)
    markActorDone(match, actorId)
    setSpeaking(match, null)
    match.runtime.modelCallStatus = 'success'
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '真人发言已提交，可继续推进。'
    return matchService.save(match)
  },

  async submitVote(matchId: string, targetId: string | null, abstain = false): Promise<Match> {
    let match = await matchService.get(matchId)
    const voterId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'vote' || !voterId) {
      throw new ArenaError('VALIDATION', '当前不在真人投票阶段', 'match')
    }

    const voter = match.participants.find((p) => p.characterId === voterId)
    if (!voter) throw new ArenaError('NOT_FOUND', '投票角色不存在', 'match')

    if (match.runtime.currentPhaseId === 'sheriff-vote') {
      const candidateIds = new Set(resolveSheriffVoteTargets(match).map((p) => p.characterId))
      if (candidateIds.size && (!targetId || !candidateIds.has(targetId))) {
        throw new ArenaError('VALIDATION', '警长投票只能投给警上竞选者', 'match')
      }
      if (candidateIds.size && abstain) {
        throw new ArenaError('VALIDATION', '有竞选者时必须从竞选者中选择警长', 'match')
      }
    }

    const target = targetId ? match.participants.find((p) => p.characterId === targetId) : null
    let vote: MatchVoteRecord = {
      id: randomUUID(),
      voterId,
      voterName: voter.characterName,
      targetId: abstain ? null : target?.characterId || null,
      targetName: abstain ? null : target?.characterName || null,
      abstain,
      abstainReason: abstain ? 'explicit' : null,
      round: match.runtime.currentRound,
      phaseId: match.runtime.currentPhaseId,
      createdAt: new Date().toISOString(),
    }
    vote = normalizeSheriffVote(vote, match, voterId)
    match.votes.push(vote)
    markActorDone(match, voterId)
    clearHumanInput(match)
    match.runtime.modelCallStatus = 'success'
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '真人投票已提交，可继续推进。'
    return matchService.save(match)
  },

  async submitWolfChat(matchId: string, content: string): Promise<Match> {
    const trimmed = content.trim()
    if (!trimmed) throw new ArenaError('VALIDATION', '沟通内容不能为空', 'match')

    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'wolf_chat' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在狼队沟通阶段', 'match')
    }

    const wolf = match.participants.find((p) => p.characterId === humanId)
    if (!wolf || wolf.roleCamp !== 'wolf') {
      throw new ArenaError('VALIDATION', '仅狼队成员可发言', 'match')
    }

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    state.wolfTeamMessages = [
      ...(state.wolfTeamMessages || []),
      {
        id: randomUUID(),
        participantId: wolf.characterId,
        participantName: wolf.characterName,
        content: trimmed,
        round,
        createdAt: new Date().toISOString(),
      },
    ]
    state.wolfNightStep = 'kill_vote'
    clearHumanInput(match)
    appendAiWolfKillVotes(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '狼队沟通完成，请选择刀口目标。'
    if (!state.wolfKillVotes?.some((item) => item.round === round && item.voterId === humanId)) {
      match.runtime.humanInputKind = 'wolf_kill'
    } else {
      finalizeWolfKillTarget(match)
    }
    return matchService.save(match)
  },

  async submitWolfKill(matchId: string, targetId: string): Promise<Match> {
    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'wolf_kill' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在狼队刀人投票阶段', 'match')
    }

    const target = match.participants.find((p) => p.characterId === targetId && p.alive === 'alive')
    if (!target || target.roleCamp === 'wolf') {
      throw new ArenaError('VALIDATION', '请选择有效的刀口目标', 'match')
    }

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    state.wolfKillVotes = [
      ...(state.wolfKillVotes || []).filter((item) => !(item.round === round && item.voterId === humanId)),
      {
        voterId: humanId,
        targetId: target.characterId,
        round,
        createdAt: new Date().toISOString(),
      },
    ]
    finalizeWolfKillTarget(match)
    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '狼队已确认刀口，可继续推进夜晚结算。'
    return matchService.save(match)
  },

  createHumanSpeechPlaceholder(match: Match, speaker: MatchParticipant): string {
    const messageId = randomUUID()
    match.messages.push({
      id: messageId,
      kind: 'speech',
      participantId: speaker.characterId,
      participantName: speaker.characterName,
      roleLabel: null,
      content: '',
      streamStatus: 'streaming',
      isHumanPlayer: true,
      createdAt: new Date().toISOString(),
      round: match.runtime.currentRound,
      phaseId: match.runtime.currentPhaseId,
      confirmed: false,
    })
    match.runtime.humanInputMessageId = messageId
    match.runtime.humanInputKind = 'speech'
    return messageId
  },

  prepareHumanWolfNight(match: Match): Match | null {
    const humanId = match.runtime.humanControlledId
    if (!humanId) return null
    const human = match.participants.find((p) => p.characterId === humanId)
    if (!human || human.roleCamp !== 'wolf' || human.alive !== 'alive') return null

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    if (state.wolfNightRound !== round) {
      resetWolfNightFlow(match, round)
    }
    if (state.wolfNightStep === 'done') return null

    if (state.wolfNightStep === 'discussion') {
      appendAiWolfDiscussion(match)
      const hasHumanMsg = (state.wolfTeamMessages || []).some(
        (item) => item.round === round && item.participantId === humanId
      )
      if (!hasHumanMsg) {
        match.runtime.humanInputKind = 'wolf_chat'
        match.runtime.stepAdvanceState = 'ready'
        match.runtime.waitingHint = '狼队私密沟通：在消息区输入你的意见。'
        return match
      }
      state.wolfNightStep = 'kill_vote'
    }

    if (state.wolfNightStep === 'kill_vote') {
      appendAiWolfKillVotes(match)
      const hasHumanVote = (state.wolfKillVotes || []).some(
        (item) => item.round === round && item.voterId === humanId
      )
      if (!hasHumanVote) {
        match.runtime.humanInputKind = 'wolf_kill'
        match.runtime.stepAdvanceState = 'ready'
        match.runtime.waitingHint = '狼队队内投票：选择今晚刀口目标。'
        return match
      }
      finalizeWolfKillTarget(match)
    }

    return null
  },

  prepareHumanGuardNight(match: Match): Match | null {
    const humanId = match.runtime.humanControlledId
    if (!humanId) return null
    const human = match.participants.find((p) => p.characterId === humanId)
    if (!human || human.roleId !== 'guard' || human.alive !== 'alive') return null

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    if (state.guardNightRound !== round) {
      resetGuardNightFlow(match, round)
    }
    if (state.guardDecided) return null

    const candidates = listGuardProtectCandidates(match, humanId)
    if (!candidates.length) {
      state.guardDecided = true
      state.guardHumanTargetId = null
      return null
    }

    match.runtime.humanInputKind = 'guard_protect'
    match.runtime.stepAdvanceState = 'ready'
    const lastId = state.guardedLastNightId
    const last = lastId ? match.participants.find((p) => p.characterId === lastId) : null
    match.runtime.waitingHint = last
      ? `选择守护目标（不可连续两晚守 ${last.seatOrder}号${last.characterName}）。`
      : '选择今晚守护目标。'
    return match
  },

  prepareHumanSeerNight(match: Match): Match | null {
    const humanId = match.runtime.humanControlledId
    if (!humanId) return null
    const human = match.participants.find((p) => p.characterId === humanId)
    if (!human || human.roleId !== 'seer' || human.alive !== 'alive') return null

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    if (state.seerNightRound !== round) {
      resetSeerNightFlow(match, round)
    }
    if (state.seerDecided) return null

    const candidates = listSeerCheckCandidates(match, humanId)
    if (!candidates.length) {
      state.seerDecided = true
      state.seerHumanTargetId = null
      return null
    }

    match.runtime.humanInputKind = 'seer_check'
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '选择今晚查验目标（结果仅你可见）。'
    return match
  },

  prepareHumanWitchNight(match: Match): Match | null {
    const humanId = match.runtime.humanControlledId
    if (!humanId) return null
    const human = match.participants.find((p) => p.characterId === humanId)
    if (!human || human.roleId !== 'witch' || human.alive !== 'alive') return null

    const state = ensureWerewolfState(match)
    const round = match.runtime.currentRound
    if (state.witchNightRound !== round) {
      resetWitchNightFlow(match, round)
    }
    if (state.witchNightStep === 'done') return null

    if (!state.pendingKnifeTargetId) {
      const knife = computeNightKnifeTarget(match)
      state.pendingKnifeTargetId = knife?.characterId ?? null
    }

    if (state.witchNightStep === 'antidote') {
      if (state.antidoteUsed) {
        state.witchAntidoteDecided = true
        state.witchUseAntidote = false
        state.witchNightStep = 'poison'
      } else if (!state.witchAntidoteDecided) {
        if (!state.pendingKnifeTargetId) {
          state.witchAntidoteDecided = true
          state.witchUseAntidote = false
          state.witchNightStep = 'poison'
        } else {
          const knife = match.participants.find((p) => p.characterId === state.pendingKnifeTargetId)
          match.runtime.humanInputKind = 'witch_antidote'
          match.runtime.stepAdvanceState = 'ready'
          match.runtime.waitingHint = knife
            ? `今晚刀口是 ${knife.seatOrder}号${knife.characterName}，是否使用解药？`
            : '是否使用解药？'
          return match
        }
      } else {
        state.witchNightStep = 'poison'
      }
    }

    if (state.witchNightStep === 'poison') {
      if (state.poisonUsed || round < 2) {
        state.witchPoisonDecided = true
        state.witchHumanPoisonTargetId = null
        state.witchNightStep = 'done'
        return null
      }
      if (!state.witchPoisonDecided) {
        match.runtime.humanInputKind = 'witch_poison'
        match.runtime.stepAdvanceState = 'ready'
        match.runtime.waitingHint = '选择毒药目标，或选择不用毒药。'
        return match
      }
      state.witchNightStep = 'done'
    }

    return null
  },

  async submitWitchAntidote(matchId: string, useAntidote: boolean): Promise<Match> {
    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'witch_antidote' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在女巫解药阶段', 'match')
    }

    const state = ensureWerewolfState(match)
    if (state.antidoteUsed) {
      throw new ArenaError('VALIDATION', '解药已用尽', 'match')
    }
    if (useAntidote && !state.pendingKnifeTargetId) {
      throw new ArenaError('VALIDATION', '本夜无刀口，无法使用解药', 'match')
    }

    state.witchAntidoteDecided = true
    state.witchUseAntidote = useAntidote
    state.witchNightStep = 'poison'
    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'

    const pending = this.prepareHumanWitchNight(match)
    if (pending?.runtime.humanInputKind) {
      return matchService.save(pending)
    }
    state.witchNightStep = 'done'
    match.runtime.waitingHint = '女巫用药已确认，可继续推进夜晚结算。'
    return matchService.save(match)
  },

  async submitWitchPoison(matchId: string, targetId: string | null): Promise<Match> {
    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'witch_poison' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在女巫毒药阶段', 'match')
    }

    const state = ensureWerewolfState(match)
    if (state.poisonUsed) {
      throw new ArenaError('VALIDATION', '毒药已用尽', 'match')
    }
    if (match.runtime.currentRound < 2) {
      throw new ArenaError('VALIDATION', '首夜不可使用毒药', 'match')
    }

    if (targetId) {
      const target = match.participants.find((p) => p.characterId === targetId && p.alive === 'alive')
      if (!target || target.characterId === humanId) {
        throw new ArenaError('VALIDATION', '请选择有效的毒药目标', 'match')
      }
    }

    state.witchPoisonDecided = true
    state.witchHumanPoisonTargetId = targetId
    state.witchNightStep = 'done'
    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '女巫用药已确认，可继续推进夜晚结算。'
    return matchService.save(match)
  },

  async submitGuardProtect(matchId: string, targetId: string | null): Promise<Match> {
    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'guard_protect' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在守卫守护阶段', 'match')
    }

    const state = ensureWerewolfState(match)
    if (targetId) {
      const valid = listGuardProtectCandidates(match, humanId).some((p) => p.characterId === targetId)
      if (!valid) {
        throw new ArenaError('VALIDATION', '请选择有效的守护目标', 'match')
      }
    }

    state.guardDecided = true
    state.guardHumanTargetId = targetId
    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '守卫守护已确认，可继续推进夜晚。'
    return matchService.save(match)
  },

  async submitSeerCheck(matchId: string, targetId: string): Promise<Match> {
    let match = await matchService.get(matchId)
    const humanId = match.runtime.humanControlledId
    if (match.runtime.humanInputKind !== 'seer_check' || !humanId) {
      throw new ArenaError('VALIDATION', '当前不在预言家查验阶段', 'match')
    }

    const valid = listSeerCheckCandidates(match, humanId).some((p) => p.characterId === targetId)
    if (!valid) {
      throw new ArenaError('VALIDATION', '请选择有效的查验目标', 'match')
    }

    const state = ensureWerewolfState(match)
    state.seerDecided = true
    state.seerHumanTargetId = targetId
    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '预言家查验已确认，可继续推进夜晚。'
    return matchService.save(match)
  },

  async submitRefereeBridge(matchId: string, content: string): Promise<Match> {
    const trimmed = content.trim()
    if (!trimmed) throw new ArenaError('VALIDATION', '裁判引导内容不能为空', 'match')

    let match = await matchService.get(matchId)
    const kind = match.runtime.humanInputKind
    if (kind !== 'referee_bridge' && kind !== 'referee_commentary') {
      throw new ArenaError('VALIDATION', '当前不在裁判引导阶段', 'match')
    }

    const state = match.runtime.roundtableState
    if (!state) throw new ArenaError('VALIDATION', '讨论状态不存在', 'match')

    const round = match.runtime.currentRound
    state.refereeBridges = [
      ...(state.refereeBridges || []),
      {
        round,
        mode: kind === 'referee_commentary' ? 'live_commentary' : 'round_bridge',
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]

    match.messages.push({
      id: randomUUID(),
      kind: 'judge',
      participantId: 'judge',
      participantName: '裁判',
      roleLabel: kind === 'referee_commentary' ? '圆桌解说' : '轮间引导',
      content: trimmed,
      streamStatus: 'done',
      confirmed: true,
      createdAt: new Date().toISOString(),
      round,
      phaseId: match.runtime.currentPhaseId,
    })

    clearHumanInput(match)
    match.runtime.stepAdvanceState = 'ready'
    match.runtime.waitingHint = '裁判引导已发布，可继续推进进入下一轮。'
    return matchService.save(match)
  },
}
