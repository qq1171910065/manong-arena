/** 首次初始化时安装的默认玩法 */
export const STARTER_GAME_MODE_IDS = ['werewolf', 'roundtable'] as const

export type StarterGameModeId = (typeof STARTER_GAME_MODE_IDS)[number]

export const STARTER_GAME_MODE_LABELS: Record<StarterGameModeId, string> = {
  werewolf: '狼人杀',
  roundtable: '自定义圆桌讨论',
}
