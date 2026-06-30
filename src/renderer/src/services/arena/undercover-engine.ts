/** 谁是卧底 — 描述 + 投票步进（第一阶段简化实现） */

import type { GameMode, Match, MatchParticipant } from '@shared/arena/types'
import { preparePhaseStep } from './phase-engine'

export const UNDERCOVER_WORD_PAIRS = [
  { civilian: '苹果', undercover: '梨' },
  { civilian: '咖啡', undercover: '奶茶' },
  { civilian: '地铁', undercover: '公交' },
  { civilian: '夏天', undercover: '冬天' },
] as const

export interface UndercoverRuntimeState {
  civilianWord: string
  undercoverWord: string
  wordByCharacterId: Record<string, string>
  describeRounds: number
}

export function createUndercoverState(playerCount: number): UndercoverRuntimeState {
  const pair = UNDERCOVER_WORD_PAIRS[playerCount % UNDERCOVER_WORD_PAIRS.length]
  return {
    civilianWord: pair.civilian,
    undercoverWord: pair.undercover,
    wordByCharacterId: {},
    describeRounds: Math.max(1, Math.min(3, Math.ceil(playerCount / 3))),
  }
}

export function assignUndercoverWords(match: Match, undercoverCount = 1): void {
  const state = match.runtime.undercoverState
  if (!state) return
  const shuffled = [...match.participants].sort(() => Math.random() - 0.5)
  const undercoverIds = new Set(shuffled.slice(0, undercoverCount).map((p) => p.characterId))
  for (const p of match.participants) {
    const isUndercover = undercoverIds.has(p.characterId)
    state.wordByCharacterId[p.characterId] = isUndercover ? state.undercoverWord : state.civilianWord
    p.roleId = isUndercover ? 'undercover' : 'civilian'
    p.roleName = isUndercover ? '卧底' : '平民'
    p.roleCamp = isUndercover ? 'evil' : 'good'
  }
}

export function isUndercoverMode(mode: GameMode): boolean {
  return mode.engineKind === 'undercover' || mode.id === 'undercover'
}

export function checkUndercoverComplete(
  match: Match,
  mode: GameMode
): { summary: string; winnerCamp: string | null } | null {
  if (!isUndercoverMode(mode)) return null
  const alive = match.participants.filter((p) => p.alive === 'alive')
  const wolves = alive.filter((p) => p.roleCamp === 'evil')
  const goods = alive.filter((p) => p.roleCamp === 'good')
  if (!wolves.length) {
    return { summary: '所有卧底已被找出，平民阵营胜利。', winnerCamp: 'good' }
  }
  if (wolves.length >= goods.length) {
    return { summary: '卧底人数达到或超过平民，卧底阵营胜利。', winnerCamp: 'evil' }
  }
  return null
}

export function advanceUndercoverPhase(match: Match, mode: GameMode): Match {
  const sorted = [...mode.phases].sort((a, b) => a.order - b.order)
  const phase = sorted[match.runtime.phaseIndex]
  const state = match.runtime.undercoverState

  if (phase?.id === 'describe' && state) {
    if (match.runtime.currentRound < state.describeRounds) {
      match.runtime.currentRound += 1
      match.runtime.actedCharacterIds = []
      return preparePhaseStep(match, mode)
    }
  }

  match.runtime.phaseIndex = Math.min(match.runtime.phaseIndex + 1, sorted.length - 1)
  if (match.runtime.phaseIndex < sorted.length) {
    match.runtime.currentRound = 1
    match.runtime.actedCharacterIds = []
  }
  return preparePhaseStep(match, mode)
}

export function undercoverRoleContext(match: Match, participant: MatchParticipant): string {
  const word = match.runtime.undercoverState?.wordByCharacterId[participant.characterId]
  if (!word) return ''
  return `你的词语（仅你可见）：${word}。描述时不可直接说出词语本身。`
}
