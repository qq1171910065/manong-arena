/** 玩法视觉素材槽位（与角色 editor 槽位概念对齐） */

export const BUILTIN_GAME_MODE_IMAGE_KEYS = ['werewolf', 'roundtable', 'avalon', 'undercover', 'custom'] as const

export type BuiltinGameModeImageKey = (typeof BUILTIN_GAME_MODE_IMAGE_KEYS)[number]

export const DEFAULT_GAME_MODE_PACK_ID = 'builtin-v1'

export interface GameModeImageSlot {
  id: 'mode-cover' | 'match-banner'
  fileName: string
  label: string
  hint: string
}

export const GAME_MODE_IMAGE_SLOTS: GameModeImageSlot[] = [
  {
    id: 'mode-cover',
    fileName: 'mode-cover.png',
    label: '玩法封面',
    hint: '玩法卡片 / 列表封面图',
  },
  {
    id: 'match-banner',
    fileName: 'match-banner.png',
    label: '对局横幅',
    hint: '对局记录 / 大厅匹配横幅',
  },
]

export const BUILTIN_GAME_MODE_LABELS: Record<BuiltinGameModeImageKey, string> = {
  werewolf: '狼人杀',
  roundtable: '圆桌讨论',
  avalon: '阿瓦隆',
  undercover: '谁是卧底',
  custom: '自定义',
}

/** 旧 home/ 文件名 → 新 game-mode-packs 路径 */
export const LEGACY_HOME_MODE_ASSET_FILES: Record<
  BuiltinGameModeImageKey,
  { modeCover: string; matchBanner: string }
> = {
  werewolf: { modeCover: 'mode-werewolf.png', matchBanner: 'match-werewolf.png' },
  avalon: { modeCover: 'mode-avalon.png', matchBanner: 'match-avalon.png' },
  undercover: { modeCover: 'mode-undercover.png', matchBanner: 'match-undercover.png' },
  roundtable: { modeCover: 'mode-custom.png', matchBanner: 'mode-custom.png' },
  custom: { modeCover: 'mode-custom.png', matchBanner: 'mode-custom.png' },
}

export function gameModePackRelativePath(
  modeId: string,
  slot: GameModeImageSlot['id']
): string {
  const fileName = GAME_MODE_IMAGE_SLOTS.find((s) => s.id === slot)?.fileName || 'mode-cover.png'
  return `${modeId}/${fileName}`
}
