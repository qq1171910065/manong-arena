/** 首次初始化时安装的默认玩法 */

export const STARTER_GAME_MODE_IDS = [
  'werewolf',
  'roundtable',
  'brainstorm-game-design',
  'brainstorm-character-design',
  'undercover',
] as const

export type StarterGameModeId = (typeof STARTER_GAME_MODE_IDS)[number]

export const STARTER_GAME_MODE_LABELS: Record<StarterGameModeId, string> = {
  werewolf: '狼人杀',
  roundtable: '圆桌讨论',
  'brainstorm-game-design': '头脑风暴 · 玩法设计',
  'brainstorm-character-design': '头脑风暴 · 角色塑造',
  undercover: '谁是卧底',
}
