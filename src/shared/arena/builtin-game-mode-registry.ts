/** 内置玩法注册表 — 不可删除，支持导入导出更新 */

export const BUILTIN_GAME_MODE_IDS = [
  'werewolf',
  'roundtable',
  'brainstorm-game-design',
  'brainstorm-character-design',
  'undercover',
  'avalon',
  'custom',
] as const

export type BuiltinGameModeId = (typeof BUILTIN_GAME_MODE_IDS)[number]

/** 第一阶段可玩内置玩法 */
export const BUILTIN_PLAYABLE_MODE_IDS = [
  'werewolf',
  'roundtable',
  'brainstorm-game-design',
  'brainstorm-character-design',
  'undercover',
] as const

export type BuiltinPlayableModeId = (typeof BUILTIN_PLAYABLE_MODE_IDS)[number]

export function isBuiltinGameModeId(modeId: string): modeId is BuiltinGameModeId {
  return (BUILTIN_GAME_MODE_IDS as readonly string[]).includes(modeId)
}

export function isBuiltinPlayableModeId(modeId: string): modeId is BuiltinPlayableModeId {
  return (BUILTIN_PLAYABLE_MODE_IDS as readonly string[]).includes(modeId)
}

export function canDeleteGameMode(modeId: string): boolean {
  return modeId.startsWith('user-mode-')
}

/** 角色详情「场景记录」是否展示经验教训 tab */
export function modeSupportsExperienceLessons(gameModeId: string): boolean {
  if (gameModeId === 'werewolf') return true
  if (gameModeId.startsWith('user-mode-')) return true
  return false
}

/** 是否为头脑风暴类玩法（讨论 + 产物） */
export function isBrainstormGameModeId(modeId: string): boolean {
  return modeId === 'brainstorm-game-design' || modeId === 'brainstorm-character-design'
}

/** 是否为纯讨论圆桌（无产物、无教训沉淀） */
export function isPureDiscussionGameModeId(modeId: string): boolean {
  return modeId === 'roundtable'
}
