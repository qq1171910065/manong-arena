import { randomRoomCode, randomUUID } from '@renderer/utils/id'
import { arenaInvoke, ensureArenaReady } from './client'
import { ArenaError } from './errors'
import {
  buildMatchTitle,
  characterService,
  gameModeService,
  validateCreateMatchInput,
} from './character-service'
import { createWerewolfState, initRuntimeForMode, normalizeRuntime, preparePhaseStep } from './phase-engine'
import { createRoundtableState } from './roundtable-engine'
import { assignUndercoverWords, createUndercoverState } from './undercover-engine'
import { isModePlayable } from './game-engine-registry'
import { gameScenarioService } from './game-scenario-service'
import { canJoinScenario } from './character-learning-service'
import { postGameReviewService } from './post-game-review-service'
import { characterGrowthService } from './character-growth-service'
import { lineupService } from './lineup-service'
import { settingsService } from './settings-service'
import { matchCostEstimator } from './match-cost-estimator'
import { getFallbackModelId } from './settings-runtime'
import { getUserProfileCharacterId } from './user-profile-service'
import { buildWerewolfRolePlanWithExpansions, normalizeWerewolfRuleModules, type WerewolfExpansionRoleId } from '@shared/arena/werewolf-dlc'
import { normalizeWerewolfWinCondition } from '@shared/arena/werewolf-win-condition'
import type {
  Character,
  CreateMatchInput,
  Match,
  MatchFilter,
  MatchParticipant,
  MatchRecap,
} from '@shared/arena/types'

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function buildWerewolfRolePool(
  mode: ReturnType<typeof gameModeService.get>,
  playerCount: number,
  werewolfDlcs: WerewolfExpansionRoleId[] = []
) {
  if (!mode) return []
  const byId = (id: string) => mode.roles.find((role) => role.id === id) || mode.roles[0]
  return buildWerewolfRolePlanWithExpansions(playerCount, werewolfDlcs).map(byId)
}

function assignRoles(
  participants: MatchParticipant[],
  mode: ReturnType<typeof gameModeService.get>,
  manualRoles: Record<string, string> = {},
  werewolfDlcs: WerewolfExpansionRoleId[] = []
): MatchParticipant[] {
  if (!mode) return participants
  const hasManual = Object.keys(manualRoles).length > 0
  const rolePool =
    mode.id === 'werewolf' && !hasManual
      ? buildWerewolfRolePool(mode, participants.length, werewolfDlcs)
      : [...mode.roles]
  while (rolePool.length < participants.length) {
    rolePool.push(mode.roles.find((r) => r.id === 'villager') || mode.roles[0])
  }
  const shuffledRoles = shuffle(rolePool).slice(0, participants.length)
  return participants.map((p, index) => {
    const manualRoleId = manualRoles[p.characterId]
    const role = manualRoleId
      ? mode.roles.find((r) => r.id === manualRoleId) || shuffledRoles[index]
      : shuffledRoles[index]
    return {
      ...p,
      roleId: role.id,
      roleName: role.name,
      roleCamp: role.camp,
    }
  })
}

export function filterMatches(items: Match[], filter: MatchFilter = {}): Match[] {
  let next = [...items]
  const query = filter.query?.trim().toLowerCase()
  if (query) {
    next = next.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        m.gameModeName.toLowerCase().includes(query) ||
        m.participants.some((p) => p.characterName.toLowerCase().includes(query))
    )
  }
  if (filter.status && filter.status !== 'all') {
    next = next.filter((m) => m.status === filter.status)
  }
  if (filter.gameModeId) {
    next = next.filter((m) => m.gameModeId === filter.gameModeId)
  }
  return next.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

function isTerminalMatch(match: Match): boolean {
  return match.status === 'completed' || match.status === 'aborted' || match.status === 'archived'
}

async function pruneExpiredMatches(items: Match[]): Promise<void> {
  const settings = await settingsService.get().catch(() => null)
  if (!settings?.dataRetentionDays) return
  const cutoff = Date.now() - settings.dataRetentionDays * 24 * 60 * 60 * 1000
  const expired = items.filter((match) => {
    if (!isTerminalMatch(match)) return false
    const raw = match.endedAt || match.updatedAt || match.createdAt
    const time = new Date(raw).getTime()
    return Number.isFinite(time) && time < cutoff
  })
  for (const match of expired) {
    await window.api.deleteMatch(match.id).catch(() => false)
  }
}

function snapshotSystemRoleModels(scenario: ReturnType<typeof gameScenarioService.getByGameModeId>): Record<string, string> {
  const models: Record<string, string> = {}
  for (const role of scenario?.systemRoles || []) {
    models[role.kind] = role.modelId || getFallbackModelId()
  }
  return models
}

function normalizeMatch(match: Match): Match {
  const mode = gameModeService.get(match.gameModeId)
  if (mode) match.runtime = normalizeRuntime(match.runtime, mode)
  return match
}

export const matchService = {
  async list(filter?: MatchFilter): Promise<Match[]> {
    await ensureArenaReady()
    const items = await arenaInvoke('match', 'listMatches', () => window.api.listMatches())
    await pruneExpiredMatches(items)
    const normalized = items.map((item) => normalizeMatch(item))
    return filterMatches(normalized, filter)
  },

  async get(id: string): Promise<Match> {
    await ensureArenaReady()
    const match = await arenaInvoke('match', 'getMatch', () => window.api.getMatch(id))
    if (!match) throw new ArenaError('NOT_FOUND', '\u5bf9\u5c40\u4e0d\u5b58\u5728', 'match')
    const normalized = normalizeMatch(match)
    if (!normalized.runtime.systemRoleModels) {
      await gameScenarioService.refresh()
      normalized.runtime.systemRoleModels = snapshotSystemRoleModels(
        gameScenarioService.getByGameModeId(normalized.gameModeId)
      )
    }
    return normalized
  },

  async save(match: Match): Promise<Match> {
    await ensureArenaReady()
    const next: Match = { ...match, updatedAt: new Date().toISOString() }
    return arenaInvoke('match', 'saveMatch', () => window.api.saveMatch(next))
  },

  async remove(id: string): Promise<void> {
    await ensureArenaReady()
    await arenaInvoke('match', 'deleteMatch', () => window.api.deleteMatch(id))
  },

  async findResumable(): Promise<Match | null> {
    const items = await this.list()
    return items.find((m) => m.status === 'active' || m.status === 'paused') || null
  },

  async listRecent(limit = 5): Promise<Match[]> {
    const items = await this.list()
    return items.slice(0, limit)
  },

  async create(input: CreateMatchInput): Promise<Match> {
    validateCreateMatchInput(input)
    const mode = gameModeService.get(input.gameModeId)
    if (!mode) throw new ArenaError('VALIDATION', '玩法不存在', 'match')
    if (!isModePlayable(mode)) throw new ArenaError('VALIDATION', '当前玩法尚未开放', 'match')

    await gameScenarioService.refresh()
    const scenario = gameScenarioService.getByGameModeId(mode.id)

    const characters: Character[] = []
    for (const id of input.characterIds) {
      characters.push(await characterService.get(id))
    }

    const disabled = characters.find((c) => c.status !== 'enabled')
    if (disabled) {
      throw new ArenaError('VALIDATION', '角色「' + disabled.name + '」已停用，无法加入对局', 'match')
    }

    if (scenario?.requiresLearning && !input.skipLearningCheck) {
      for (const character of characters) {
        const check = canJoinScenario(character, scenario.id)
        if (!check.ok) throw new ArenaError('VALIDATION', check.reason || '角色未完成玩法学习', 'match')
      }
    }

    const now = new Date().toISOString()
    const firstPhase = mode.phases[0]
    let participants: MatchParticipant[] = characters.map((character, index) => ({
      characterId: character.id,
      characterName: character.name,
      avatarUrl: character.avatarUrl,
      accentColor: character.accentColor,
      modelId: character.modelId,
      seatOrder: index + 1,
      roleId: null,
      roleName: null,
      roleCamp: null,
      alive: 'alive',
      isSpeaking: false,
    }))

    participants = assignRoles(
      participants,
      mode,
      input.manualRoles || {},
      (input.werewolfDlcs || []) as WerewolfExpansionRoleId[]
    )

    const promptPackId = input.promptPackId || scenario?.defaultPromptPackId
    const roundtableTopic = input.discussionTopic || scenario?.discussionTopic || '自由讨论'
    const roundtableRounds = input.roundtableRounds || scenario?.defaultRounds || 3

    await matchCostEstimator.refresh().catch(() => null)
    const sheriffEnabled = input.sheriffEnabled !== false
    const systemRoleModels = snapshotSystemRoleModels(scenario)
    const estimatedCostCents = (
      await matchCostEstimator.estimateAsync(mode.id, participants.length, {
        participantModelIds: participants.map((item) => item.modelId),
        systemRoleModelIds: systemRoleModels,
        sheriffEnabled: mode.id === 'werewolf' ? sheriffEnabled : undefined,
        roundtableRounds,
        roundtableHostEnabled: scenario?.systemRoles.some((role) => role.kind === 'host' && role.enabled) ?? true,
        roundtableNarratorEnabled: scenario?.systemRoles.some((role) => role.kind === 'narrator' && role.enabled) ?? false,
      })
    ).totalCents
    const isRoundtableLike =
      mode.engineKind === 'roundtable' ||
      mode.id === 'roundtable' ||
      mode.engineKind === 'brainstorm' ||
      mode.id.startsWith('brainstorm-')
    const isUndercover = mode.engineKind === 'undercover' || mode.id === 'undercover'

    const runtime = {
      ...initRuntimeForMode(mode),
      promptPackId,
      systemRoleModels,
      sheriffEnabled: mode.id === 'werewolf' ? sheriffEnabled : undefined,
      werewolfState: mode.id === 'werewolf' ? createWerewolfState() : undefined,
      roundtableState: isRoundtableLike
          ? createRoundtableState(
              roundtableTopic,
              roundtableRounds,
              scenario?.systemRoles.some((r) => r.kind === 'host' && r.enabled) ?? true,
              scenario?.systemRoles.some((r) => r.kind === 'narrator' && r.enabled) ?? false,
              {
                designTarget: input.designTarget,
                brainstormCategory: scenario?.brainstormCategory,
              }
            )
          : undefined,
      undercoverState: isUndercover ? createUndercoverState(participants.length) : undefined,
    }

    const match: Match = {
      id: randomUUID(),
      title: input.title || buildMatchTitle(mode, participants.length),
      gameModeId: mode.id,
      gameModeName: mode.name,
      status: 'active',
      identityAssignMode: input.identityAssignMode || 'random',
      participantIds: participants.map((p) => p.characterId),
      participants,
      messages: [],
      votes: [],
      events: [
        {
          id: randomUUID(),
          icon: 'game',
          text: '对局开始 · ' + mode.name + ' · ' + participants.length + ' 人。' + (mode.setupSummary ? ' ' + mode.setupSummary : ''),
          createdAt: now,
          phaseId: firstPhase.id,
          round: 1,
        },
      ],
      modelCalls: [],
      anomalies: [],
      runtime,
      totalCostCents: 0,
      estimatedCostCents,
      resultSummary: null,
      winnerCamp: null,
      recap: null,
      roomCode: randomRoomCode(),
      createdAt: now,
      updatedAt: now,
      startedAt: now,
      endedAt: null,
      werewolfRuleModules:
        mode.id === 'werewolf' ? normalizeWerewolfRuleModules(input.werewolfRuleModules) : undefined,
      werewolfWinCondition:
        mode.id === 'werewolf' ? normalizeWerewolfWinCondition(input.werewolfWinCondition) : undefined,
    }

    preparePhaseStep(match, mode)
    if (isUndercover) {
      assignUndercoverWords(match, Math.max(1, Math.floor(participants.length / 4)))
    }
    if (mode.id === 'werewolf' && !sheriffEnabled) {
      const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
      const nightIndex = sorted.findIndex((p) => p.id === 'night')
      if (nightIndex >= 0) {
        match.runtime.phaseIndex = nightIndex
        preparePhaseStep(match, mode)
      }
    }
    const profileId = await getUserProfileCharacterId().catch(() => null)
    if (profileId && participants.some((p) => p.characterId === profileId)) {
      match.runtime.userProfileCharacterId = profileId
    }
    match.runtime.stepAdvanceState = 'ready'
    const saved = await this.save(match)

    for (const character of characters) {
      character.stats.matchCount += 1
      character.stats.lastMatchAt = now
      await characterService.save(character)
    }

    return saved
  },

  async pause(id: string, reason: string): Promise<Match> {
    const match = await this.get(id)
    match.status = 'paused'
    match.runtime.stepAdvanceState = 'paused'
    match.runtime.waitingHint = reason
    match.anomalies.push({
      id: randomUUID(),
      matchId: id,
      type: 'paused',
      message: reason,
      createdAt: new Date().toISOString(),
      resolved: false,
      resolution: null,
    })
    return this.save(match)
  },

  async complete(id: string, summary: string, winnerCamp: string | null): Promise<Match> {
    const match = await this.get(id)
    match.status = 'completed'
    match.resultSummary = summary
    match.winnerCamp = winnerCamp
    match.endedAt = new Date().toISOString()
    match.runtime.stepAdvanceState = 'disabled'
    match.runtime.waitingHint = '对局已结束'
    match.events.push({
      id: randomUUID(),
      icon: '🏆',
      text: summary,
      createdAt: match.endedAt,
      phaseId: match.runtime.currentPhaseId,
      round: match.runtime.currentRound,
    })
    const saved = await this.save(match)
    void postGameReviewService.reviewMatchForAll(saved).catch(() => undefined)
    void characterGrowthService.applyMatchGrowth(saved).catch(() => undefined)
    void lineupService.applyMatchResult(saved).catch(() => undefined)
    void import('./match-recap-service')
      .then(({ matchRecapService }) => matchRecapService.ensureRecap(saved.id))
      .catch(() => undefined)
    const settings = await settingsService.get().catch(() => null)
    if (settings && !settings.autoSaveMatch) {
      await this.remove(saved.id).catch(() => undefined)
    }
    return saved
  },

  async updateRecap(id: string, recap: MatchRecap): Promise<Match> {
    const match = await this.get(id)
    match.recap = recap
    return this.save(match)
  },
}
