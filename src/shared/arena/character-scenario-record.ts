/** 角色在各场景范式下的演练记录聚合 — 供详情页与弹窗使用 */

import type {
  BehaviorChangeRecord,
  Character,
  CharacterGrowthRecord,
  CharacterGrowthSnapshot,
  Match,
  MatchParticipant,
} from './types'
import {
  resolveParadigmForGameMode,
  type BrainstormCategoryId,
} from './social-paradigm'
import { modeSupportsExperienceLessons } from './builtin-game-mode-registry'

export interface ScenarioRecordMeta {
  scenarioId: string
  scenarioName: string
  gameModeId: string
  requiresExam?: boolean
}

export interface CharacterScenarioRecordSummary {
  scenarioId: string
  scenarioName: string
  gameModeId: string
  paradigmShortLabel: string
  matchCount: number
  winCount: number
  mvpCount: number
  lastMatchAt: string | null
  learned: boolean
  examPassed: boolean
  examBypassed: boolean
  statusLabel: string
}

export type MatchOutcomeKind = 'win' | 'lose' | 'neutral'

export interface CharacterMatchPerformanceRow {
  matchId: string
  title: string
  gameModeName: string
  endedAt: string
  outcome: MatchOutcomeKind
  speechCount: number
  voteCount: number
  modelCallCount: number
  costCents: number
  isMvp: boolean
  discussionTopic?: string
  brainstormCategory?: BrainstormCategoryId
  designTarget?: string
  sessionLabel?: string
  artifactSummary?: string
  recapSnippet?: string
  roleName?: string | null
  roleCamp?: string | null
}

export interface CharacterScenarioLessonRow {
  id: string
  source: string
  summary: string
  createdAt: string
  matchId?: string
}

export interface CharacterScenarioDetail {
  summary: CharacterScenarioRecordSummary
  matches: CharacterMatchPerformanceRow[]
  lessons: CharacterScenarioLessonRow[]
  snapshots: CharacterGrowthSnapshot[]
}

function terminalMatch(match: Match): boolean {
  return match.status === 'completed' || match.status === 'aborted'
}

function participantFor(characterId: string, match: Match): MatchParticipant | undefined {
  return match.participants.find((p) => p.characterId === characterId)
}

export function resolveMatchOutcome(match: Match, characterId: string): MatchOutcomeKind {
  const participant = participantFor(characterId, match)
  if (!participant) return 'neutral'
  if (!match.winnerCamp) return 'neutral'
  if (!participant.roleCamp) return 'neutral'
  return participant.roleCamp === match.winnerCamp ? 'win' : 'lose'
}

export function matchesForCharacterInScenario(
  characterId: string,
  gameModeId: string,
  matches: Match[]
): Match[] {
  return matches
    .filter(
      (m) =>
        m.gameModeId === gameModeId &&
        m.participantIds.includes(characterId) &&
        terminalMatch(m)
    )
    .sort((a, b) => (b.endedAt || b.updatedAt).localeCompare(a.endedAt || a.updatedAt))
}

function skillStatusLabel(
  skill: Character['gameSkills'][number] | undefined,
  requiresExam?: boolean
): string {
  if (!skill?.learned) return '未学习'
  if (requiresExam && !skill.examPassed && !skill.examBypassed) return '待校验'
  if (skill.examBypassed && !skill.examPassed) return '已免考'
  return '可参与'
}

export function buildScenarioRecordSummary(
  character: Character,
  meta: ScenarioRecordMeta,
  matches: Match[]
): CharacterScenarioRecordSummary {
  const skill = character.gameSkills?.find((s) => s.scenarioId === meta.scenarioId)
  const scenarioMatches = matchesForCharacterInScenario(character.id, meta.gameModeId, matches)
  const winCount = scenarioMatches.filter((m) => resolveMatchOutcome(m, character.id) === 'win').length
  const mvpCount = scenarioMatches.filter((m) => m.recap?.mvp?.characterId === character.id).length
  const last = scenarioMatches[0]
  const paradigm = resolveParadigmForGameMode({ id: meta.gameModeId })

  return {
    scenarioId: meta.scenarioId,
    scenarioName: meta.scenarioName,
    gameModeId: meta.gameModeId,
    paradigmShortLabel: paradigm.shortLabel,
    matchCount: scenarioMatches.length,
    winCount,
    mvpCount,
    lastMatchAt: last ? last.endedAt || last.updatedAt : null,
    learned: Boolean(skill?.learned),
    examPassed: Boolean(skill?.examPassed),
    examBypassed: Boolean(skill?.examBypassed),
    statusLabel: skillStatusLabel(skill, meta.requiresExam),
  }
}

export function listScenarioRecordSummaries(
  character: Character,
  metas: ScenarioRecordMeta[],
  matches: Match[]
): CharacterScenarioRecordSummary[] {
  return metas.map((meta) => buildScenarioRecordSummary(character, meta, matches))
}

function sessionLabelForMode(gameModeId: string): string | undefined {
  if (gameModeId === 'roundtable') return '圆桌讨论'
  if (gameModeId === 'brainstorm-game-design') return '头脑风暴 · 玩法设计'
  if (gameModeId === 'brainstorm-character-design') return '头脑风暴 · 角色塑造'
  if (gameModeId === 'undercover') return '谁是卧底'
  return undefined
}

function buildMatchPerformanceRow(characterId: string, match: Match): CharacterMatchPerformanceRow {
  const participant = participantFor(characterId, match)!
  const rt = match.runtime.roundtableState
  const brainstormCategory = rt?.brainstormCategory
  const speechCount = match.messages.filter(
    (m) => m.participantId === participant.characterId && m.kind === 'speech' && m.confirmed
  ).length
  const voteCount = match.votes.filter((v) => v.voterId === participant.characterId).length
  const modelCallCount = match.modelCalls.filter((c) => c.characterId === participant.characterId).length
  const costCents = match.modelCalls
    .filter((c) => c.characterId === participant.characterId)
    .reduce((sum, c) => sum + c.costCents, 0)

  return {
    matchId: match.id,
    title: match.title,
    gameModeName: match.gameModeName,
    endedAt: match.endedAt || match.updatedAt,
    outcome: resolveMatchOutcome(match, characterId),
    speechCount,
    voteCount,
    modelCallCount,
    costCents,
    isMvp: match.recap?.mvp?.characterId === characterId,
    discussionTopic: rt?.discussionTopic,
    brainstormCategory,
    designTarget: rt?.designTarget,
    sessionLabel: sessionLabelForMode(match.gameModeId),
    artifactSummary: rt?.artifactSummary,
    recapSnippet: match.recap?.summary?.slice(0, 160) || match.resultSummary?.slice(0, 160),
    roleName: participant.roleName,
    roleCamp: participant.roleCamp,
  }
}

export function collectScenarioLessons(
  character: Character,
  scenarioId: string,
  gameModeId: string,
  matchIds: Set<string>,
  growthRecords: CharacterGrowthRecord[],
  behaviorChanges: BehaviorChangeRecord[]
): CharacterScenarioLessonRow[] {
  if (!modeSupportsExperienceLessons(gameModeId)) return []
  const rows: CharacterScenarioLessonRow[] = []
  const skill = character.gameSkills?.find((s) => s.scenarioId === scenarioId)

  for (const entry of skill?.learningLog || []) {
    if (entry.source === 'initial') continue
    if (entry.matchId && !matchIds.has(entry.matchId)) continue
    rows.push({
      id: entry.id,
      source: entry.source === 'post_match' ? '复盘领悟' : '再次学习',
      summary: entry.summary,
      createdAt: entry.createdAt,
      matchId: entry.matchId,
    })
  }

  for (const record of growthRecords) {
    if (record.scenarioId && record.scenarioId !== scenarioId) continue
    if (record.matchId && !matchIds.has(record.matchId)) continue
    if (!record.applied) continue
    rows.push({
      id: record.id,
      source: record.source === 'chat' ? '私聊沉淀' : '复盘微调',
      summary: record.summary,
      createdAt: record.createdAt,
      matchId: record.matchId,
    })
  }

  for (const record of behaviorChanges) {
    if (record.scenarioId !== scenarioId) {
      if (!record.matchId || !matchIds.has(record.matchId)) continue
    }
    if (!record.applied) continue
    rows.push({
      id: record.id,
      source: '行为准则',
      summary: record.summary,
      createdAt: record.createdAt,
      matchId: record.matchId,
    })
  }

  for (const mistake of skill?.commonMistakes || []) {
    rows.push({
      id: `mistake-${mistake.slice(0, 12)}`,
      source: '常见教训',
      summary: mistake,
      createdAt: skill?.learnedAt || '',
    })
  }

  return rows
    .filter((r) => r.summary)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
}

export function buildCharacterScenarioDetail(
  character: Character,
  meta: ScenarioRecordMeta,
  matches: Match[],
  snapshots: CharacterGrowthSnapshot[],
  growthRecords: CharacterGrowthRecord[],
  behaviorChanges: BehaviorChangeRecord[]
): CharacterScenarioDetail {
  const summary = buildScenarioRecordSummary(character, meta, matches)
  const scenarioMatches = matchesForCharacterInScenario(character.id, meta.gameModeId, matches)
  const matchIds = new Set(scenarioMatches.map((m) => m.id))
  const matchRows = scenarioMatches.map((m) => buildMatchPerformanceRow(character.id, m))
  const lessons = collectScenarioLessons(
    character,
    meta.scenarioId,
    meta.gameModeId,
    matchIds,
    growthRecords,
    behaviorChanges
  )
  const relatedSnapshots = snapshots
    .filter((s) => s.matchId && matchIds.has(s.matchId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return {
    summary,
    matches: matchRows,
    lessons,
    snapshots: relatedSnapshots,
  }
}

export function outcomeLabel(outcome: MatchOutcomeKind): string {
  if (outcome === 'win') return '阵营胜利'
  if (outcome === 'lose') return '未胜'
  return '无胜负'
}

export function brainstormCategoryLabel(id?: BrainstormCategoryId): string {
  if (!id) return ''
  if (id === 'game_design') return '玩法设计'
  if (id === 'character_design') return '角色塑造'
  return id
}
