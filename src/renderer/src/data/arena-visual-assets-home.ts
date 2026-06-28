import { gameModePackAssetUrl } from '@shared/arena/asset-url'
import {
  BUILTIN_GAME_MODE_IMAGE_KEYS,
  gameModePackRelativePath,
  type BuiltinGameModeImageKey,
} from '@shared/arena/game-mode-visuals'

function resolveModeAsset(modeId: string, slot: 'mode-cover' | 'match-banner'): string {
  const normalized = modeId === 'roundtable' ? 'roundtable' : modeId
  const key = (BUILTIN_GAME_MODE_IMAGE_KEYS.includes(normalized as BuiltinGameModeImageKey)
    ? normalized
    : 'custom') as BuiltinGameModeImageKey
  return gameModePackAssetUrl(gameModePackRelativePath(key, slot))
}

export function modeImageById(id = ''): string {
  return resolveModeAsset(id, 'mode-cover')
}

export function matchImageByModeId(id = ''): string {
  return resolveModeAsset(id, 'match-banner')
}

export const modeBadges: Record<string, string> = {
  werewolf: '狼',
  roundtable: '圆',
  avalon: '剑',
  undercover: '词',
  custom: '创',
}
