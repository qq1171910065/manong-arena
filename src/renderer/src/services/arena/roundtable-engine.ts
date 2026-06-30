import type { GameMode, Match } from '@shared/arena/types'
import { preparePhaseStep } from './phase-engine'
import { isBrainstormGameModeId } from '@shared/arena/builtin-game-mode-registry'

export function createRoundtableState(
  topic: string,
  totalRounds: number,
  hostEnabled: boolean,
  narratorEnabled: boolean,
  options?: {
    designTarget?: string
    brainstormCategory?: import('@shared/arena/social-paradigm').BrainstormCategoryId
  }
) {
  return {
    discussionTopic: topic,
    totalRounds: Math.max(1, totalRounds),
    hostEnabled,
    narratorEnabled,
    designTarget: options?.designTarget?.trim() || undefined,
    brainstormCategory: options?.brainstormCategory,
  }
}

export function isRoundtableMode(mode: GameMode): boolean {
  return mode.engineKind === 'roundtable' || mode.id === 'roundtable'
}

export function isBrainstormMode(mode: GameMode): boolean {
  return mode.engineKind === 'brainstorm' || isBrainstormGameModeId(mode.id)
}

/** 圆桌 + 头脑风暴共用步进引擎 */
export function isDiscussionEngineMode(mode: GameMode): boolean {
  return isRoundtableMode(mode) || isBrainstormMode(mode)
}

export function checkRoundtableComplete(match: Match, mode: GameMode): { summary: string } | null {
  if (!isDiscussionEngineMode(mode)) return null
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  const phase = sorted[match.runtime.phaseIndex]
  if (phase?.id !== 'closing') return null
  if (!match.runtime.actedCharacterIds.length) return null
  const topic = match.runtime.roundtableState?.discussionTopic || mode.name
  if (isBrainstormMode(mode)) {
    const artifact = match.runtime.roundtableState?.artifactSummary
    return {
      summary: artifact
        ? `头脑风暴「${topic}」已结束。产物：${artifact}`
        : `头脑风暴「${topic}」已结束，共 ${match.runtime.roundtableState?.totalRounds || 1} 轮讨论。`,
    }
  }
  return {
    summary: `圆桌讨论「${topic}」已结束，共 ${match.runtime.roundtableState?.totalRounds || 1} 轮发言。`,
  }
}

export function advanceRoundtablePhase(match: Match, mode: GameMode): Match {
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  const phase = sorted[match.runtime.phaseIndex]
  const state = match.runtime.roundtableState

  if (phase?.id === 'opening') {
    const discussIndex = sorted.findIndex((p) => p.id === 'round-discuss')
    match.runtime.phaseIndex = discussIndex >= 0 ? discussIndex : 1
    match.runtime.currentRound = 1
    return preparePhaseStep(match, mode)
  }

  if (phase?.id === 'round-discuss' && state) {
    if (match.runtime.currentRound < state.totalRounds) {
      match.runtime.currentRound += 1
      match.runtime.actedCharacterIds = []
      return preparePhaseStep(match, mode)
    }
    const closingIndex = sorted.findIndex((p) => p.id === 'closing')
    match.runtime.phaseIndex = closingIndex >= 0 ? closingIndex : sorted.length - 1
    return preparePhaseStep(match, mode)
  }

  match.runtime.phaseIndex = Math.min(match.runtime.phaseIndex + 1, sorted.length - 1)
  return preparePhaseStep(match, mode)
}

export function openingNeedsHostSpeech(match: Match, mode: GameMode): boolean {
  return (
    isDiscussionEngineMode(mode) &&
    match.runtime.currentPhaseId === 'opening' &&
    Boolean(match.runtime.roundtableState?.hostEnabled) &&
    !match.runtime.actedCharacterIds.includes('host')
  )
}
