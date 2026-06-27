import {
  applyCharacterAssetPack,
  type CharacterAssetPackOption,
} from '@renderer/data/character-asset-catalog'
import { cloneJson } from '@shared/clone-json'
import type { Character } from '@shared/arena/types'
import { arenaInvoke } from './client'

export async function materializeCharacterPackSelection(
  character: Character,
  option: CharacterAssetPackOption
): Promise<Character> {
  const seeded = applyCharacterAssetPack(cloneJson(character), option)
  if (!window.api?.materializeCharacterFromPack) {
    return seeded
  }
  const materialized = await arenaInvoke('storage', 'materializeFromPack', () =>
    window.api.materializeCharacterFromPack(seeded, '', option.characterId)
  )
  if (option.accent) materialized.accentColor = option.accent
  return materialized
}
