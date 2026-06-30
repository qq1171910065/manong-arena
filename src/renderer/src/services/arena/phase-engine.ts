import { randomUUID } from '@renderer/utils/id'
import { gameModeService } from './character-service'
import { finalizeSheriffCandidates } from './werewolf-sheriff'
import type { GameMode, GameModePhase, Match, MatchParticipant, PhaseActionKind, WerewolfRuntimeState } from '@shared/arena/types'
import { checkWerewolfWinCondition } from '@shared/arena/werewolf-win-condition'

function aliveParticipants(match: Match): MatchParticipant[] {
  return match.participants.filter((p) => p.alive === 'alive')
}

function votingParticipants(match: Match): MatchParticipant[] {
  const state = match.runtime.werewolfState
  const noVote = new Set(state?.revealedIdiotIds || [])
  return aliveParticipants(match).filter((p) => !noVote.has(p.characterId))
}

function getPhase(mode: GameMode, index: number): GameModePhase {
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  return sorted[index] ?? sorted[sorted.length - 1]
}

function actionKindForPhase(phase: GameModePhase): PhaseActionKind {
  if (phase.kind === 'discussion' || phase.kind === 'day') return 'speech'
  if (phase.kind === 'vote') return 'vote'
  if (phase.kind === 'night') return 'night'
  if (phase.kind === 'result' || phase.kind === 'action') return 'judge'
  return 'idle'
}

function buildSpeechQueue(match: Match): string[] {
  const sheriffId = match.runtime.werewolfState?.sheriffId || match.runtime.sheriffId
  const alive = aliveParticipants(match).sort((a, b) => a.seatOrder - b.seatOrder)
  if (!sheriffId) return alive.map((p) => p.characterId)
  const sheriffIndex = alive.findIndex((p) => p.characterId === sheriffId)
  if (sheriffIndex < 0) return alive.map((p) => p.characterId)
  return [...alive.slice(sheriffIndex + 1), ...alive.slice(0, sheriffIndex + 1)].map((p) => p.characterId)
}

function phaseHint(actionKind: PhaseActionKind, phase: GameModePhase): string {
  if (phase.id === 'sheriff-speech') return '警上发言阶段：严格按席位顺序依次发言；可竞选警长并说明警徽流。'
  if (phase.id === 'sheriff-vote') return '警长投票阶段：只有警上宣布竞选的玩家可获票，全体存活玩家从中投票选出警长。'
  if (actionKind === 'speech') return '发言须严格按席位顺序进行（被 @ 不会提前你的顺位）；警长归票阶段通常最后发言。'
  if (actionKind === 'vote') return '放逐投票阶段，存活且有投票权的角色依次提交投票；警长票按 1.5 票计算。'
  if (actionKind === 'night') return '夜晚行动阶段，守卫、狼人、预言家、女巫依次行动，裁判只公开天亮结果。'
  if (actionKind === 'judge') return '裁判复核胜负、技能触发和警徽流转，准备进入下一阶段。'
  return phase.description || '等待推进'
}

export function createWerewolfState(): WerewolfRuntimeState {
  return {
    sheriffId: null,
    sheriffHistory: [],
    sheriffCandidates: [],
    antidoteUsed: false,
    poisonUsed: false,
    guardedLastNightId: null,
    guardedThisNightId: null,
    poisonedCharacterIds: [],
    seerChecks: [],
    revealedIdiotIds: [],
    hunterShotIds: [],
    charmedTargetId: null,
    charmedById: null,
    knightUsed: false,
    gravediggerLastDeathCamp: null,
    wolfKingShotIds: [],
    whiteWolfKingShotIds: [],
    wolfTeamRevealed: false,
  }
}

export function ensureWerewolfState(match: Match): WerewolfRuntimeState {
  if (!match.runtime.werewolfState) match.runtime.werewolfState = createWerewolfState()
  match.runtime.sheriffId = match.runtime.werewolfState.sheriffId
  return match.runtime.werewolfState
}

export function initRuntimeForMode(mode: GameMode): Match['runtime'] {
  const phase = getPhase(mode, 0)
  const actionKind = actionKindForPhase(phase)
  return {
    currentPhaseId: phase.id,
    currentPhaseName: phase.name,
    currentPhaseKind: phase.kind,
    phaseIndex: 0,
    currentRound: 1,
    currentSpeakerId: null,
    currentActionKind: actionKind,
    speechQueue: [],
    actedCharacterIds: [],
    stepAdvanceState: 'ready',
    modelCallStatus: null,
    pendingActionId: null,
    submittedActionIds: [],
    voteOpen: phase.kind === 'vote',
    voteTargetId: null,
    waitingHint: '裁判已就位，点击推进开始首个阶段。',
    sheriffId: null,
    werewolfState: mode.id === 'werewolf' ? createWerewolfState() : undefined,
    roundtableState:
      mode.engineKind === 'roundtable' || mode.id === 'roundtable'
        ? { discussionTopic: '待设置议题', totalRounds: 3, hostEnabled: true, narratorEnabled: false }
        : undefined,
  }
}

export function normalizeRuntime(runtime: Match['runtime'], mode: GameMode): Match['runtime'] {
  const phase = mode.phases.find((p) => p.id === runtime.currentPhaseId) ?? getPhase(mode, runtime.phaseIndex ?? 0)
  const actionKind = runtime.currentActionKind ?? actionKindForPhase(phase)
  return {
    ...initRuntimeForMode(mode),
    ...runtime,
    currentPhaseName: phase.name,
    currentPhaseKind: phase.kind,
    phaseIndex: runtime.phaseIndex ?? 0,
    currentActionKind: actionKind,
    speechQueue: runtime.speechQueue ?? [],
    actedCharacterIds: runtime.actedCharacterIds ?? [],
    voteOpen: phase.kind === 'vote',
    sheriffId: runtime.werewolfState?.sheriffId ?? runtime.sheriffId ?? null,
    werewolfState: mode.id === 'werewolf' ? { ...createWerewolfState(), ...runtime.werewolfState } : runtime.werewolfState,
  }
}

export function preparePhaseStep(match: Match, mode: GameMode): Match {
  const phase = getPhase(mode, match.runtime.phaseIndex)
  const actionKind = actionKindForPhase(phase)
  match.runtime.currentPhaseId = phase.id
  match.runtime.currentPhaseName = phase.name
  match.runtime.currentPhaseKind = phase.kind
  match.runtime.currentActionKind = actionKind
  match.runtime.voteOpen = phase.kind === 'vote'
  match.runtime.actedCharacterIds = []
  match.runtime.speechQueue = actionKind === 'speech' ? buildSpeechQueue(match) : []
  match.runtime.currentSpeakerId = actionKind === 'speech' ? match.runtime.speechQueue[0] ?? null : null
  if (actionKind !== 'vote') match.runtime.voteTargetId = null
  match.runtime.waitingHint = phaseHint(actionKind, phase)
  if (actionKind === 'vote') match.runtime.activeVoteMessageId = null
  if (mode.id === 'werewolf') ensureWerewolfState(match)
  if (phase.id === 'sheriff-vote') finalizeSheriffCandidates(match)
  return match
}

export function getNextActorId(match: Match): string | null {
  const { runtime } = match
  if (runtime.currentActionKind === 'speech') {
    return runtime.speechQueue.find((id) => !runtime.actedCharacterIds.includes(id)) ?? null
  }
  if (runtime.currentActionKind === 'vote') {
    const alive = votingParticipants(match).sort((a, b) => a.seatOrder - b.seatOrder)
    return alive.find((p) => !runtime.actedCharacterIds.includes(p.characterId))?.characterId ?? null
  }
  return null
}

export function markActorDone(match: Match, characterId: string): void {
  if (!match.runtime.actedCharacterIds.includes(characterId)) match.runtime.actedCharacterIds.push(characterId)
  match.runtime.submittedActionIds.push(randomUUID())
}

export function isPhaseStepComplete(match: Match): boolean {
  const { runtime } = match
  if (runtime.currentActionKind === 'night' || runtime.currentActionKind === 'judge' || runtime.currentActionKind === 'system') return true
  if (runtime.currentActionKind === 'speech') {
    if (runtime.currentPhaseId === 'last-words' && runtime.speechQueue.length) {
      return runtime.speechQueue.every((id) => runtime.actedCharacterIds.includes(id))
    }
    const aliveIds = aliveParticipants(match).map((p) => p.characterId)
    return aliveIds.every((id) => runtime.actedCharacterIds.includes(id))
  }
  if (runtime.currentActionKind === 'vote') {
    const voteIds = votingParticipants(match).map((p) => p.characterId)
    return voteIds.every((id) => runtime.actedCharacterIds.includes(id))
  }
  return true
}

export function tallyVotes(match: Match): { targetId: string | null; abstainCount: number; tied: boolean } {
  const counts = new Map<string, number>()
  let abstainCount = 0
  const sheriffId = match.runtime.werewolfState?.sheriffId || match.runtime.sheriffId
  const roundVotes = match.votes.filter((v) => v.phaseId === match.runtime.currentPhaseId && v.round === match.runtime.currentRound)
  for (const vote of roundVotes) {
    if (vote.abstain || !vote.targetId) {
      abstainCount += 1
      continue
    }
    const weight = vote.voterId === sheriffId ? 1.5 : 1
    counts.set(vote.targetId, (counts.get(vote.targetId) || 0) + weight)
  }
  let targetId: string | null = null
  let max = 0
  let tied = false
  for (const [id, count] of counts) {
    if (count > max) {
      max = count
      targetId = id
      tied = false
    } else if (count === max && count > 0) {
      tied = true
    }
  }
  return { targetId: tied ? null : targetId, abstainCount, tied }
}

export function eliminateParticipant(match: Match, characterId: string): MatchParticipant | null {
  const participant = match.participants.find((p) => p.characterId === characterId)
  if (!participant || participant.alive !== 'alive') return null
  participant.alive = 'eliminated'
  return participant
}

function chooseFirstAlive(match: Match, exclude = new Set<string>()): MatchParticipant | null {
  return aliveParticipants(match).filter((p) => !exclude.has(p.characterId)).sort((a, b) => a.seatOrder - b.seatOrder)[0] ?? null
}

function chooseSheriff(match: Match): MatchParticipant | null {
  const priority = ['seer', 'hunter', 'guard', 'witch', 'idiot', 'villager', 'werewolf']
  const alive = aliveParticipants(match)
  for (const roleId of priority) {
    const target = alive.find((p) => p.roleId === roleId)
    if (target) return target
  }
  return alive[0] ?? null
}

export function resolveSheriffElection(match: Match): { icon: string; text: string } {
  const state = ensureWerewolfState(match)
  if (state.sheriffId && aliveParticipants(match).some((p) => p.characterId === state.sheriffId)) {
    return { icon: '⭐', text: '警长投票已完成，警徽由 ' + (match.participants.find((p) => p.characterId === state.sheriffId)?.characterName || '未知角色') + ' 持有。' }
  }

  const candidateIds = new Set(state.sheriffCandidates || [])
  const candidates = aliveParticipants(match).filter((p) => candidateIds.has(p.characterId))
  if (!candidates.length) {
    state.sheriffId = null
    match.runtime.sheriffId = null
    match.participants = match.participants.map((p) => ({ ...p, isSheriff: false }))
    return { icon: '⭐', text: '无人竞选警长，本局暂时没有警长。' }
  }

  const { targetId, tied } = tallyVotes(match)
  if (!targetId || tied) {
    state.sheriffId = null
    match.runtime.sheriffId = null
    match.participants = match.participants.map((p) => ({ ...p, isSheriff: false }))
    return { icon: '⭐', text: tied ? '警长投票平票，本局暂时没有警长。' : '警长投票无人当选，本局暂时没有警长。' }
  }

  const sheriff = match.participants.find((p) => p.characterId === targetId && p.alive === 'alive' && candidateIds.has(p.characterId))
  if (!sheriff) return { icon: '⭐', text: '警长投票目标无效，本局暂时没有警长。' }

  state.sheriffId = sheriff.characterId
  state.sheriffHistory.push(sheriff.characterId)
  match.runtime.sheriffId = sheriff.characterId
  match.participants = match.participants.map((p) => ({ ...p, isSheriff: p.characterId === sheriff.characterId }))
  return { icon: '⭐', text: sheriff.characterName + ' 当选警长，警长票按 1.5 票计算。' }
}

export function transferSheriffIfNeeded(match: Match, eliminated: MatchParticipant | null): string | null {
  if (!eliminated) return null
  const state = ensureWerewolfState(match)
  if (state.sheriffId !== eliminated.characterId) return null
  const next = chooseFirstAlive(match, new Set(state.sheriffHistory)) || chooseFirstAlive(match)
  if (!next) {
    state.sheriffId = null
    match.runtime.sheriffId = null
    match.participants = match.participants.map((p) => ({ ...p, isSheriff: false }))
    return '警长出局，场上无人可接任，警徽流失。'
  }
  state.sheriffId = next.characterId
  state.sheriffHistory.push(next.characterId)
  match.runtime.sheriffId = next.characterId
  match.participants = match.participants.map((p) => ({ ...p, isSheriff: p.characterId === next.characterId }))
  return '警长出局，警徽移交给 ' + next.characterName + '。'
}

function chooseWerewolfNightTarget(match: Match, overrideId?: string | null): MatchParticipant | null {
  if (overrideId) {
    const forced = match.participants.find((p) => p.characterId === overrideId && p.alive === 'alive')
    if (forced) return forced
  }
  const alive = aliveParticipants(match)
  const wolves = alive.filter((p) => p.roleCamp === 'wolf')
  if (!wolves.length) return null

  const goodTargets = alive.filter((p) => p.roleCamp !== 'wolf')

  // 高级战术：自刀骗女巫解药 — 狼人可刀队友（含自己），规则允许
  const maySelfKnife =
    match.runtime.currentRound >= 2 &&
    wolves.length >= 2 &&
    (match.runtime.currentRound + wolves.length) % 4 === 0
  if (maySelfKnife) {
    const sacrificial = wolves.find((p) => !p.isSheriff) || wolves[0]
    if (sacrificial) return sacrificial
  }

  if (!goodTargets.length) {
    return wolves[(match.runtime.currentRound - 1) % wolves.length] ?? wolves[0]
  }

  const sheriffId = match.runtime.werewolfState?.sheriffId
  const sheriffTarget = goodTargets.find((p) => p.characterId === sheriffId)
  if (sheriffTarget) return sheriffTarget
  const god = goodTargets.find((p) => p.roleId && ['seer', 'witch', 'guard', 'hunter', 'knight'].includes(p.roleId))
  if (god) return god
  return goodTargets[(match.runtime.currentRound + wolves.length - 1) % goodTargets.length] ?? goodTargets[0]
}

function chooseGuardTarget(match: Match): MatchParticipant | null {
  const state = ensureWerewolfState(match)
  const guard = aliveParticipants(match).find((p) => p.roleId === 'guard')
  if (!guard) return null
  const candidates = listGuardProtectCandidates(match, guard.characterId)
  const sheriffId = state.sheriffId
  return candidates.find((p) => p.characterId === sheriffId) || candidates.find((p) => p.roleId === 'seer') || candidates[0] || null
}

export function listGuardProtectCandidates(match: Match, guardCharacterId: string): MatchParticipant[] {
  const state = ensureWerewolfState(match)
  return aliveParticipants(match)
    .filter((p) => p.characterId !== state.guardedLastNightId)
    .sort((a, b) => a.seatOrder - b.seatOrder)
}

export function listSeerCheckCandidates(match: Match, seerCharacterId: string): MatchParticipant[] {
  const state = ensureWerewolfState(match)
  const checked = new Set(state.seerChecks.map((item) => item.targetId))
  return aliveParticipants(match)
    .filter((p) => p.characterId !== seerCharacterId && !checked.has(p.characterId))
    .sort((a, b) => a.seatOrder - b.seatOrder)
}

export function resetGuardNightFlow(match: Match, round: number): void {
  const state = ensureWerewolfState(match)
  if (state.guardNightRound === round) return
  state.guardNightRound = round
  state.guardDecided = false
  state.guardHumanTargetId = null
}

export function resetSeerNightFlow(match: Match, round: number): void {
  const state = ensureWerewolfState(match)
  if (state.seerNightRound === round) return
  state.seerNightRound = round
  state.seerDecided = false
  state.seerHumanTargetId = null
}

function choosePoisonTarget(match: Match): MatchParticipant | null {
  const alive = aliveParticipants(match)
  const wolves = alive.filter((p) => p.roleCamp === 'wolf')
  if (!wolves.length) return null
  return wolves[(match.runtime.currentRound - 1) % wolves.length]
}

function chooseSeerTarget(match: Match): MatchParticipant | null {
  const seer = aliveParticipants(match).find((p) => p.roleId === 'seer')
  if (!seer) return null
  return listSeerCheckCandidates(match, seer.characterId)[0] ?? null
}

function chooseHunterTarget(match: Match, hunter: MatchParticipant): MatchParticipant | null {
  const alive = aliveParticipants(match).filter((p) => p.characterId !== hunter.characterId)
  return alive.find((p) => p.roleCamp === 'wolf') || alive[0] || null
}

function chooseDeathSkillTarget(match: Match, source: MatchParticipant): MatchParticipant | null {
  const alive = aliveParticipants(match).filter((p) => p.characterId !== source.characterId)
  return alive.find((p) => p.roleCamp === 'wolf') || alive.find((p) => p.roleCamp === 'good') || alive[0] || null
}

function chooseWolfBeautyTarget(match: Match): MatchParticipant | null {
  const beauty = aliveParticipants(match).find((p) => p.roleId === 'wolf_beauty')
  if (!beauty) return null
  const targets = aliveParticipants(match).filter((p) => p.roleCamp !== 'wolf' && p.characterId !== beauty.characterId)
  return targets[(match.runtime.currentRound - 1) % Math.max(targets.length, 1)] ?? targets[0] ?? null
}

function nightActorLabel(participant: MatchParticipant): string {
  return participant.seatOrder + '号' + participant.characterName + (participant.roleName ? '（' + participant.roleName + '）' : '')
}

function campResultLabel(camp: string | null | undefined): string {
  if (camp === 'wolf') return '狼人阵营'
  if (camp === 'good') return '好人阵营'
  return '未知'
}

function triggerWolfBeautyDeath(match: Match, eliminated: MatchParticipant, state: WerewolfRuntimeState, events: string[]): void {
  if (eliminated.roleId !== 'wolf_beauty' || !state.charmedTargetId) return
  const charmed = match.participants.find((p) => p.characterId === state.charmedTargetId && p.alive === 'alive')
  if (!charmed) return
  const victim = eliminateParticipant(match, charmed.characterId)
  if (victim) {
    events.push('狼美人 ' + eliminated.characterName + ' 出局，被魅惑的 ' + victim.characterName + ' 殉情。')
    const transferText = transferSheriffIfNeeded(match, victim)
    if (transferText) events.push(transferText)
  }
  state.charmedTargetId = null
  state.charmedById = null
}

export function triggerDeathSkill(match: Match, eliminated: MatchParticipant, reason: 'vote' | 'night' | 'poison'): string[] {
  const state = ensureWerewolfState(match)
  const events: string[] = []
  if (eliminated.roleId === 'hunter' && reason !== 'poison' && !state.hunterShotIds?.includes(eliminated.characterId)) {
    const target = chooseHunterTarget(match, eliminated)
    state.hunterShotIds = state.hunterShotIds || []
    state.hunterShotIds.push(eliminated.characterId)
    if (target) {
      const shot = eliminateParticipant(match, target.characterId)
      if (shot) {
        events.push('猎人 ' + eliminated.characterName + ' 开枪带走了 ' + shot.characterName + '。')
        const transferText = transferSheriffIfNeeded(match, shot)
        if (transferText) events.push(transferText)
      }
    }
  }
  if ((eliminated.roleId === 'wolf_king') && reason !== 'poison') {
    state.wolfKingShotIds = state.wolfKingShotIds || []
    if (!state.wolfKingShotIds.includes(eliminated.characterId)) {
      const target = chooseDeathSkillTarget(match, eliminated)
      state.wolfKingShotIds.push(eliminated.characterId)
      if (target) {
        const shot = eliminateParticipant(match, target.characterId)
        if (shot) {
          events.push('狼王 ' + eliminated.characterName + ' 开枪带走了 ' + shot.characterName + '。')
          const transferText = transferSheriffIfNeeded(match, shot)
          if (transferText) events.push(transferText)
        }
      }
    }
  }
  if (eliminated.roleId === 'white_wolf_king' && reason === 'vote') {
    state.whiteWolfKingShotIds = state.whiteWolfKingShotIds || []
    if (!state.whiteWolfKingShotIds.includes(eliminated.characterId)) {
      const target = chooseDeathSkillTarget(match, eliminated)
      state.whiteWolfKingShotIds.push(eliminated.characterId)
      if (target) {
        const shot = eliminateParticipant(match, target.characterId)
        if (shot) {
          events.push('白狼王 ' + eliminated.characterName + ' 自爆带走了 ' + shot.characterName + '。')
          const transferText = transferSheriffIfNeeded(match, shot)
          if (transferText) events.push(transferText)
        }
      }
    }
  }
  triggerWolfBeautyDeath(match, eliminated, state, events)
  return events
}

export function resolveKnightDuel(match: Match): string[] {
  const state = ensureWerewolfState(match)
  if (state.knightUsed || match.runtime.currentPhaseId !== 'day-vote') return []
  const knight = aliveParticipants(match).find((p) => p.roleId === 'knight')
  if (!knight) return []
  const { targetId } = tallyVotes(match)
  if (!targetId || targetId === knight.characterId) return []
  const target = match.participants.find((p) => p.characterId === targetId && p.alive === 'alive')
  if (!target) return []
  state.knightUsed = true
  const events: string[] = []
  if (target.roleCamp === 'wolf') {
    const eliminated = eliminateParticipant(match, target.characterId)
    if (eliminated) {
      events.push('骑士 ' + knight.characterName + ' 对 ' + eliminated.characterName + ' 发起决斗，狼人出局。')
      events.push(...triggerDeathSkill(match, eliminated, 'vote'))
      const transferText = transferSheriffIfNeeded(match, eliminated)
      if (transferText) events.push(transferText)
    }
  } else {
    const eliminated = eliminateParticipant(match, knight.characterId)
    if (eliminated) {
      events.push('骑士 ' + knight.characterName + ' 对 ' + target.characterName + ' 发起决斗，目标为好人，骑士出局。')
      const transferText = transferSheriffIfNeeded(match, eliminated)
      if (transferText) events.push(transferText)
    }
  }
  return events
}

export function resolveIdiotExile(match: Match, targetId: string): { prevented: boolean; text: string | null } {
  const participant = match.participants.find((p) => p.characterId === targetId)
  const state = ensureWerewolfState(match)
  if (!participant || participant.roleId !== 'idiot' || state.revealedIdiotIds.includes(targetId)) {
    return { prevented: false, text: null }
  }
  participant.revealed = true
  state.revealedIdiotIds.push(targetId)
  return { prevented: true, text: participant.characterName + ' 被投票放逐时翻开白痴身份，本次免死，但之后失去投票权。' }
}

export function resolveNightAction(match: Match, mode: GameMode): {
  icon: string
  text: string
  eliminated: MatchParticipant[]
  publicDetails: string[]
  godDetails: string[]
} {
  if (mode.id !== 'werewolf') {
    return { icon: '🌙', text: '第 ' + match.runtime.currentRound + ' 夜结束。', eliminated: [], publicDetails: [], godDetails: [] }
  }
  const state = ensureWerewolfState(match)
  const publicDetails: string[] = []
  const godDetails: string[] = []
  const eliminated: MatchParticipant[] = []

  const guard = aliveParticipants(match).find((p) => p.roleId === 'guard')
  const humanControlsGuard = Boolean(guard && match.runtime.humanControlledId === guard.characterId)
  let guardTarget: MatchParticipant | null = null
  if (guard) {
    if (humanControlsGuard && state.guardDecided) {
      if (state.guardHumanTargetId) {
        const picked = match.participants.find(
          (p) => p.characterId === state.guardHumanTargetId && p.alive === 'alive'
        )
        const valid = picked && picked.characterId !== state.guardedLastNightId
        guardTarget = valid ? picked : null
      }
    } else if (!humanControlsGuard) {
      guardTarget = chooseGuardTarget(match)
    }
  }
  state.guardedThisNightId = guardTarget?.characterId || null
  if (guard) {
    if (guardTarget) {
      godDetails.push('守卫 ' + nightActorLabel(guard) + ' 守护 ' + nightActorLabel(guardTarget))
    } else {
      godDetails.push('守卫 ' + nightActorLabel(guard) + ' 本夜未发动守护（可能因不可连续守同一人）')
    }
  }

  const wolfTarget = chooseWerewolfNightTarget(match, state.wolfKillTargetId)
  if (wolfTarget) {
    const selfKnife = wolfTarget.roleCamp === 'wolf'
    godDetails.push(
      selfKnife
        ? '狼人发动自刀，袭击 ' + nightActorLabel(wolfTarget) + '（骗女巫解药等高级战术）'
        : '狼人袭击 ' + nightActorLabel(wolfTarget)
    )
  } else {
    godDetails.push('狼人本夜无有效袭击目标')
  }

  const wolfBeauty = aliveParticipants(match).find((p) => p.roleId === 'wolf_beauty')
  const charmTarget = wolfBeauty ? chooseWolfBeautyTarget(match) : null
  if (wolfBeauty && charmTarget) {
    state.charmedTargetId = charmTarget.characterId
    state.charmedById = wolfBeauty.characterId
    godDetails.push('狼美人 ' + nightActorLabel(wolfBeauty) + ' 魅惑 ' + nightActorLabel(charmTarget))
  }

  const seer = aliveParticipants(match).find((p) => p.roleId === 'seer')
  const humanControlsSeer = Boolean(seer && match.runtime.humanControlledId === seer.characterId)
  let seerTarget: MatchParticipant | null = null
  if (seer) {
    if (humanControlsSeer && state.seerDecided) {
      if (state.seerHumanTargetId) {
        seerTarget =
          match.participants.find(
            (p) => p.characterId === state.seerHumanTargetId && p.alive === 'alive' && p.characterId !== seer.characterId
          ) || null
      }
    } else if (!humanControlsSeer) {
      seerTarget = chooseSeerTarget(match)
    }
  }
  if (seer && seerTarget) {
    state.seerChecks.push({
      round: match.runtime.currentRound,
      seerId: seer.characterId,
      targetId: seerTarget.characterId,
      camp: seerTarget.roleCamp || 'unknown',
    })
    godDetails.push(
      '预言家 ' +
        nightActorLabel(seer) +
        ' 查验 ' +
        nightActorLabel(seerTarget) +
        '，结果：' +
        campResultLabel(seerTarget.roleCamp)
    )
  } else if (seer) {
    godDetails.push('预言家 ' + nightActorLabel(seer) + ' 本夜未查验（无可用目标）')
  }

  let savedByWitch = false
  const witch = aliveParticipants(match).find((p) => p.roleId === 'witch')
  const humanControlsWitch = Boolean(witch && match.runtime.humanControlledId === witch.characterId)
  if (witch && wolfTarget && !state.antidoteUsed) {
    if (humanControlsWitch && state.witchAntidoteDecided) {
      if (state.witchUseAntidote) {
        savedByWitch = true
        state.antidoteUsed = true
        state.witchSaveTargetId = wolfTarget.characterId
        godDetails.push('女巫 ' + nightActorLabel(witch) + ' 对 ' + nightActorLabel(wolfTarget) + ' 使用解药')
      } else {
        godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用解药')
      }
    } else if (
      !humanControlsWitch &&
      wolfTarget.roleId &&
      ['seer', 'witch', 'guard', 'hunter'].includes(wolfTarget.roleId)
    ) {
      savedByWitch = true
      state.antidoteUsed = true
      godDetails.push('女巫 ' + nightActorLabel(witch) + ' 对 ' + nightActorLabel(wolfTarget) + ' 使用解药')
    } else if (witch) {
      if (state.antidoteUsed) godDetails.push('女巫解药已用尽，本夜未使用解药')
      else if (wolfTarget) godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用解药')
    }
  } else if (witch) {
    if (state.antidoteUsed) godDetails.push('女巫解药已用尽，本夜未使用解药')
    else if (wolfTarget) godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用解药')
  }

  const guarded = Boolean(wolfTarget && state.guardedThisNightId === wolfTarget.characterId)
  if (wolfTarget && guarded) {
    godDetails.push('守卫与狼刀指向同一人，该目标免疫狼刀')
  }

  if (wolfTarget && !guarded && !savedByWitch) {
    const victim = eliminateParticipant(match, wolfTarget.characterId)
    if (victim) {
      eliminated.push(victim)
      publicDetails.push(...triggerDeathSkill(match, victim, 'night'))
      const transferText = transferSheriffIfNeeded(match, victim)
      if (transferText) publicDetails.push(transferText)
    }
  }

  if (witch && !state.poisonUsed && match.runtime.currentRound >= 2) {
    let poisonTarget: MatchParticipant | null = null
    if (humanControlsWitch && state.witchPoisonDecided) {
      if (state.witchHumanPoisonTargetId) {
        poisonTarget =
          match.participants.find(
            (p) => p.characterId === state.witchHumanPoisonTargetId && p.alive === 'alive'
          ) || null
      }
    } else if (!humanControlsWitch) {
      poisonTarget = choosePoisonTarget(match)
    }
    if (poisonTarget) {
      state.poisonUsed = true
      state.witchPoisonTargetId = poisonTarget.characterId
      if (!state.poisonedCharacterIds) state.poisonedCharacterIds = []
      state.poisonedCharacterIds.push(poisonTarget.characterId)
      godDetails.push('女巫 ' + nightActorLabel(witch) + ' 对 ' + nightActorLabel(poisonTarget) + ' 使用毒药')
      const poisoned = eliminateParticipant(match, poisonTarget.characterId)
      if (poisoned) {
        eliminated.push(poisoned)
        publicDetails.push('女巫使用毒药，' + poisoned.characterName + ' 中毒出局。')
        publicDetails.push(...triggerDeathSkill(match, poisoned, 'poison'))
        const transferText = transferSheriffIfNeeded(match, poisoned)
        if (transferText) publicDetails.push(transferText)
      }
    } else if (humanControlsWitch && state.witchPoisonDecided) {
      godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用毒药')
    } else {
      godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用毒药')
    }
  } else if (witch && state.poisonUsed) {
    godDetails.push('女巫毒药已用尽')
  } else if (witch) {
    godDetails.push('女巫 ' + nightActorLabel(witch) + ' 本夜未使用毒药')
  }

  state.guardedLastNightId = state.guardedThisNightId
  state.guardedThisNightId = null

  if (eliminated.length) {
    const first = eliminated[0]
    state.gravediggerLastDeathCamp = first.roleCamp === 'wolf' ? 'wolf' : 'good'
    state.nightDeaths = eliminated.map((p) => p.characterId)
  } else {
    state.gravediggerLastDeathCamp = null
    state.nightDeaths = []
  }

  state.wolfTeamRevealed = true

  if (!eliminated.length) {
    return { icon: '🌙', text: '第 ' + match.runtime.currentRound + ' 夜结束，昨夜平安夜。', eliminated, publicDetails, godDetails }
  }
  return {
    icon: '🌘',
    text: '第 ' + match.runtime.currentRound + ' 夜结束，' + eliminated.map((p) => p.characterName).join('、') + ' 倒在黎明前。',
    eliminated,
    publicDetails,
    godDetails,
  }
}

export function checkWinCondition(match: Match, mode: GameMode): { winnerCamp: string; summary: string } | null {
  if (mode.id === 'werewolf') return checkWerewolfWinCondition(match, mode)
  return null
}

export function advanceToNextPhase(match: Match, mode: GameMode): Match {
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  const skipSheriff = mode.id === 'werewolf' && match.runtime.sheriffEnabled === false
  let nextIndex = match.runtime.phaseIndex + 1
  if (skipSheriff) {
    while (nextIndex < sorted.length && (sorted[nextIndex].id === 'sheriff-speech' || sorted[nextIndex].id === 'sheriff-vote')) {
      nextIndex += 1
    }
  }
  if (nextIndex >= sorted.length) {
    nextIndex = mode.id === 'werewolf' ? sorted.findIndex((p) => p.id === 'night') : 0
    if (nextIndex < 0) nextIndex = 0
    match.runtime.currentRound += 1
  }
  match.runtime.phaseIndex = nextIndex
  return preparePhaseStep(match, mode)
}

export function resolveSystemPhase(match: Match, mode: GameMode): string {
  const phase = getPhase(mode, match.runtime.phaseIndex)
  if (phase.kind === 'result') return '裁判完成胜负与警徽复核，准备进入下一轮。'
  return phase.name + ' 流程推进完成。'
}

export function aliveWolves(match: Match): MatchParticipant[] {
  return aliveParticipants(match).filter((p) => p.roleCamp === 'wolf')
}

export function computeNightKnifeTarget(match: Match): MatchParticipant | null {
  const state = ensureWerewolfState(match)
  return chooseWerewolfNightTarget(match, state.wolfKillTargetId)
}

export function resetWitchNightFlow(match: Match, round: number): void {
  const state = ensureWerewolfState(match)
  if (state.witchNightRound === round) return
  state.witchNightRound = round
  state.witchNightStep = 'antidote'
  state.pendingKnifeTargetId = null
  state.witchAntidoteDecided = false
  state.witchUseAntidote = false
  state.witchPoisonDecided = false
  state.witchHumanPoisonTargetId = null
}

export function resetWolfNightFlow(match: Match, round: number): void {
  const state = ensureWerewolfState(match)
  if (state.wolfNightRound === round) return
  state.wolfNightRound = round
  state.wolfNightStep = 'discussion'
  state.wolfKillTargetId = null
  state.wolfKillVotes = (state.wolfKillVotes || []).filter((item) => item.round !== round)
}

export function appendAiWolfDiscussion(match: Match): void {
  const state = ensureWerewolfState(match)
  const round = match.runtime.currentRound
  const wolves = aliveWolves(match)
  const humanId = match.runtime.humanControlledId
  const messages = [...(state.wolfTeamMessages || [])]
  const target = chooseWerewolfNightTarget(match)

  for (const wolf of wolves) {
    if (wolf.characterId === humanId) continue
    if (messages.some((item) => item.round === round && item.participantId === wolf.characterId)) continue
    const targetName = target && target.roleCamp !== 'wolf' ? target.characterName : '待定'
    messages.push({
      id: randomUUID(),
      participantId: wolf.characterId,
      participantName: wolf.characterName,
      content: `我建议今晚刀 ${targetName}，大家看看有没有异议。`,
      round,
      createdAt: new Date().toISOString(),
    })
  }
  state.wolfTeamMessages = messages
}

export function appendAiWolfKillVotes(match: Match): void {
  const state = ensureWerewolfState(match)
  const round = match.runtime.currentRound
  const humanId = match.runtime.humanControlledId
  const votes = [...(state.wolfKillVotes || [])]
  const target = chooseWerewolfNightTarget(match)
  if (!target) return

  for (const wolf of aliveWolves(match)) {
    if (wolf.characterId === humanId) continue
    if (votes.some((item) => item.round === round && item.voterId === wolf.characterId)) continue
    votes.push({
      voterId: wolf.characterId,
      targetId: target.characterId,
      round,
      createdAt: new Date().toISOString(),
    })
  }
  state.wolfKillVotes = votes
}

export function tallyWolfKillVotes(match: Match): string | null {
  const state = ensureWerewolfState(match)
  const round = match.runtime.currentRound
  const votes = (state.wolfKillVotes || []).filter((item) => item.round === round)
  if (!votes.length) return null

  const counts = new Map<string, number>()
  for (const vote of votes) {
    counts.set(vote.targetId, (counts.get(vote.targetId) || 0) + 1)
  }

  let max = 0
  let leaders: string[] = []
  for (const [targetId, count] of counts) {
    if (count > max) {
      max = count
      leaders = [targetId]
    } else if (count === max) {
      leaders.push(targetId)
    }
  }
  if (!leaders.length) return null
  return leaders[Math.floor(Math.random() * leaders.length)]
}

export function finalizeWolfKillTarget(match: Match): string | null {
  const state = ensureWerewolfState(match)
  const targetId = tallyWolfKillVotes(match)
  state.wolfKillTargetId = targetId
  state.wolfNightStep = 'done'
  return targetId
}
