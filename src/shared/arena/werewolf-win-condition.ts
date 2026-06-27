import type { GameMode, Match, MatchParticipant } from './types'

export type WerewolfWinCondition = 'side_slaughter' | 'city_slaughter'

export const DEFAULT_WEREWOLF_WIN_CONDITION: WerewolfWinCondition = 'city_slaughter'

export const WEREWOLF_WIN_CONDITION_OPTIONS: Array<{
  id: WerewolfWinCondition
  name: string
  desc: string
}> = [
  { id: 'side_slaughter', name: '屠边', desc: '狼人杀光所有平民或所有神职即获胜。' },
  { id: 'city_slaughter', name: '屠城', desc: '狼人杀光所有好人即获胜。' },
]

export function normalizeWerewolfWinCondition(raw?: string | null): WerewolfWinCondition {
  return raw === 'side_slaughter' ? 'side_slaughter' : 'city_slaughter'
}

export function werewolfWinConditionLabel(id: WerewolfWinCondition): string {
  return WEREWOLF_WIN_CONDITION_OPTIONS.find((item) => item.id === id)?.name ?? '屠城'
}

export function werewolfWinConditionDesc(id: WerewolfWinCondition): string {
  return WEREWOLF_WIN_CONDITION_OPTIONS.find((item) => item.id === id)?.desc ?? ''
}

function isGoodGod(participant: MatchParticipant, mode: GameMode): boolean {
  if (participant.roleCamp !== 'good') return false
  const role = mode.roles.find((item) => item.id === participant.roleId)
  return Boolean(role?.isGod)
}

function isGoodVillager(participant: MatchParticipant, mode: GameMode): boolean {
  if (participant.roleCamp !== 'good') return false
  return !isGoodGod(participant, mode)
}

export function checkWerewolfWinCondition(
  match: Match,
  mode: GameMode
): { winnerCamp: string; summary: string } | null {
  const alive = match.participants.filter((p) => p.alive === 'alive')
  const aliveWolves = alive.filter((p) => p.roleCamp === 'wolf')
  const aliveGood = alive.filter((p) => p.roleCamp === 'good')

  if (aliveWolves.length === 0 && aliveGood.length > 0) {
    return { winnerCamp: 'good', summary: '好人阵营获胜：所有狼人已经出局。' }
  }

  const condition = normalizeWerewolfWinCondition(match.werewolfWinCondition)

  if (condition === 'city_slaughter') {
    if (aliveWolves.length > 0 && aliveGood.length === 0) {
      return { winnerCamp: 'wolf', summary: '狼人阵营获胜：所有好人已经出局（屠城）。' }
    }
    return null
  }

  const hadVillagers = match.participants.some((p) => isGoodVillager(p, mode))
  const hadGods = match.participants.some((p) => isGoodGod(p, mode))
  const aliveVillagers = aliveGood.filter((p) => isGoodVillager(p, mode))
  const aliveGods = aliveGood.filter((p) => isGoodGod(p, mode))

  if (aliveWolves.length > 0) {
    if (hadVillagers && aliveVillagers.length === 0) {
      return { winnerCamp: 'wolf', summary: '狼人阵营获胜：所有平民已经出局（屠边）。' }
    }
    if (hadGods && aliveGods.length === 0) {
      return { winnerCamp: 'wolf', summary: '狼人阵营获胜：所有神职已经出局（屠边）。' }
    }
  }

  return null
}
