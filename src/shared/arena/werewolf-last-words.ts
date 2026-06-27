import type { Match, MatchParticipant } from './types'
import { hasWerewolfRuleModule, type WerewolfLastWordsReason } from './werewolf-dlc'

export function isLastWordsPhase(match: Match): boolean {
  return match.runtime.currentPhaseId === 'last-words'
}

/** 是否处于首个夜晚（第 1 轮 night 结算时 currentRound 仍为 1） */
export function isFirstNightRound(match: Match): boolean {
  return (match.runtime.currentRound ?? 1) <= 1
}

/**
 * 遗言权限：
 * - 标准规则：仅首夜（第 1 轮夜晚）狼刀等夜间出局者可遗言
 * - 白天放逐默认无遗言（day_vote_last_words 扩展）
 * - 第二夜及以后夜间出局默认无遗言（night_last_words 扩展）
 * - 毒杀默认无遗言（poison_last_words 扩展）
 */
export function shouldAllowLastWords(match: Match, reason: WerewolfLastWordsReason): boolean {
  if (match.gameModeId !== 'werewolf') return false

  if (reason === 'day-vote') {
    return hasWerewolfRuleModule(match.werewolfRuleModules, 'day_vote_last_words')
  }

  if (reason === 'night') {
    if (isFirstNightRound(match)) return true
    return hasWerewolfRuleModule(match.werewolfRuleModules, 'night_last_words')
  }

  if (reason === 'poison') {
    return hasWerewolfRuleModule(match.werewolfRuleModules, 'poison_last_words')
  }

  return false
}

export function startLastWordsPhase(match: Match, characterIds: string[]): void {
  const uniqueIds = [...new Set(characterIds.filter(Boolean))]
  if (!uniqueIds.length) return
  const names = uniqueIds
    .map((id) => match.participants.find((p) => p.characterId === id)?.characterName)
    .filter(Boolean)
  match.runtime.pendingLastWordsIds = uniqueIds
  match.runtime.currentPhaseId = 'last-words'
  match.runtime.currentPhaseName = '遗言'
  match.runtime.currentActionKind = 'speech'
  match.runtime.speechQueue = uniqueIds
  match.runtime.currentSpeakerId = uniqueIds[0] ?? null
  match.runtime.actedCharacterIds = []
  match.runtime.waitingHint =
    names.length > 1
      ? names.join('、') + ' 依次发表遗言。'
      : (names[0] || '出局者') + ' 发表遗言。'
}

export function collectVoteLastWordsTargets(match: Match, eliminated: MatchParticipant | null | undefined): string[] {
  if (!eliminated || eliminated.alive !== 'eliminated') return []
  if (!shouldAllowLastWords(match, 'day-vote')) return []
  return [eliminated.characterId]
}

export function collectNightLastWordsTargets(match: Match, eliminated: MatchParticipant[]): string[] {
  return eliminated
    .filter((participant) => participant.alive === 'eliminated')
    .filter((participant) => {
      const poisoned = match.runtime.werewolfState?.poisonedCharacterIds || []
      const reason = poisoned.includes(participant.characterId) ? 'poison' : 'night'
      return shouldAllowLastWords(match, reason)
    })
    .map((participant) => participant.characterId)
}
