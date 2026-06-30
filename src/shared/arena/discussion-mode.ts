/** 讨论型玩法（圆桌 / 头脑风暴）— 机制与产物 */

import { isBrainstormGameModeId } from './builtin-game-mode-registry'
import type { GameEngineKind } from './game-scenario'
import type { GameMode } from './types'

export type DiscussionFacilitationMode = 'round_bridge' | 'live_commentary'

export interface DiscussionRefereeBridge {
  round: number
  mode: DiscussionFacilitationMode
  content: string
  createdAt: string
}

export interface DiscussionArtifactSection {
  heading: string
  bullets: string[]
}

export type DiscussionArtifactKind = 'discussion' | 'brainstorm_rules' | 'brainstorm_character'

export interface DiscussionArtifact {
  kind: DiscussionArtifactKind
  title: string
  summary: string
  sections: DiscussionArtifactSection[]
  openQuestions?: string[]
  generatedAt: string
  source: 'ai' | 'fallback'
}

export const DISCUSSION_FACILITATION_OPTIONS: Array<{
  id: DiscussionFacilitationMode
  label: string
  description: string
}> = [
  {
    id: 'round_bridge',
    label: '轮间总结引导',
    description: '每轮全员发言后，由你总结要点并引导下一轮对话方向。',
  },
  {
    id: 'live_commentary',
    label: '圆桌解说',
    description: '每轮发言后，由你以裁判身份解说本轮氛围、分歧与精彩观点。',
  },
]

export function isDiscussionEngineKind(engineKind?: GameEngineKind): boolean {
  return engineKind === 'roundtable' || engineKind === 'brainstorm'
}

export function isDiscussionGameModeId(gameModeId: string): boolean {
  return gameModeId === 'roundtable' || isBrainstormGameModeId(gameModeId)
}

export function isDiscussionGameMode(mode: Pick<GameMode, 'id' | 'engineKind'>): boolean {
  return isDiscussionGameModeId(mode.id) || isDiscussionEngineKind(mode.engineKind)
}

export function resolveDiscussionArtifactKind(gameModeId: string): DiscussionArtifactKind {
  if (gameModeId === 'brainstorm-game-design') return 'brainstorm_rules'
  if (gameModeId === 'brainstorm-character-design') return 'brainstorm_character'
  return 'discussion'
}

export function formatRefereeBridgeHint(
  facilitationMode: DiscussionFacilitationMode,
  round: number,
  totalRounds: number
): string {
  if (facilitationMode === 'live_commentary') {
    return `第 ${round} 轮发言已结束。请以裁判身份解说本轮讨论，提交后可进入第 ${round + 1} 轮（共 ${totalRounds} 轮）。`
  }
  return `第 ${round} 轮发言已结束。请总结本轮要点并引导第 ${round + 1} 轮对话，提交后可继续（共 ${totalRounds} 轮）。`
}

export function formatDiscussionArtifactLabel(kind: DiscussionArtifactKind): string {
  if (kind === 'brainstorm_rules') return '玩法草案'
  if (kind === 'brainstorm_character') return '角色塑造清单'
  return '讨论纪要'
}

export function hasRefereeBridgeForRound(
  bridges: DiscussionRefereeBridge[] | undefined,
  round: number
): boolean {
  return Boolean(bridges?.some((item) => item.round === round))
}
