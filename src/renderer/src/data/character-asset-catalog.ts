import characterManifest from '@renderer/data/pack-manifests/character-packs.json'

import { packAssetUrl } from '@renderer/data/arena-home-assets'
import { charactersAssetUrl } from '@shared/arena/asset-url'

import {
  buildPackAssetRef,
  buildPackVisualPatch,
  canonicalCharacterKey,
  inferLegacyCharacterKey,
  isDirectImageRef,
  normalizeCharacterVisuals,
  parsePackAssetRef,
  type CharacterExpressionId,
  type CharacterImageSlot,
  type CharacterVisualLike,
} from '@shared/arena/character-visuals'

import { ownedAssetRelativePath, parseOwnedAssetRef } from '@shared/arena/character-owned-assets'

import type { Character } from '@shared/arena/types'

type ManifestCharacter = {
  id: string
  name: string
  modelId?: string
  accent?: string
  palette?: string
  portrait?: string
  banner?: string
  avatars?: Partial<Record<CharacterExpressionId, string>>
}

type ManifestFile = {
  packageId?: string
  characters: ManifestCharacter[]
}

function mergeCharacterManifests(runtime: ManifestCharacter[], bundled: ManifestCharacter[]): ManifestCharacter[] {
  const map = new Map<string, ManifestCharacter>()
  for (const item of bundled) map.set(item.id, item)
  for (const item of runtime) {
    const base = map.get(item.id)
    map.set(item.id, base ? { ...base, ...item } : item)
  }
  const order = bundled.map((item) => item.id)
  for (const item of runtime) {
    if (!order.includes(item.id)) order.push(item.id)
  }
  return order.map((id) => map.get(id)).filter(Boolean) as ManifestCharacter[]
}

export function appendAssetCacheBust(url: string, token?: string | number | null): string {
  if (!url || token == null || token === '') return url
  if (/^(data:|blob:|https?:)/i.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}v=${encodeURIComponent(String(token))}`
}

function resolveRelativePackPath(relativePath: string): string {
  return packAssetUrl(relativePath)
}

export interface CharacterAssetPackOption {
  characterId: string
  label: string
  modelId?: string
  accent?: string
  palette?: string
  previewPortraitUrl: string
  previewAvatarUrl: string
  previewBannerUrl?: string
}

export function buildCharacterAssetPackOptions(manifest: ManifestFile): CharacterAssetPackOption[] {
  if (!Array.isArray(manifest.characters) || !manifest.characters.length) return []
  return manifest.characters.map((item) => {
    const portraitPath = item.portrait || `${item.id}/portrait.png`
    const avatarPath = item.avatars?.neutral || `${item.id}/avatars/neutral.png`
    const bannerPath = item.banner || `${item.id}/banner.png`

    return {
      characterId: item.id,
      label: item.name,
      modelId: item.modelId,
      accent: item.accent,
      palette: item.palette,
      previewPortraitUrl: resolveRelativePackPath(portraitPath),
      previewAvatarUrl: resolveRelativePackPath(avatarPath),
      previewBannerUrl: resolveRelativePackPath(bannerPath),
    } satisfies CharacterAssetPackOption
  })
}

const BUNDLED_CHARACTER_ASSET_PACK_OPTIONS: CharacterAssetPackOption[] = buildCharacterAssetPackOptions(
  characterManifest as ManifestFile
)

let runtimeCharacterAssetPackOptions: CharacterAssetPackOption[] | null = null

export const CHARACTER_ASSET_PACK_OPTIONS: CharacterAssetPackOption[] = BUNDLED_CHARACTER_ASSET_PACK_OPTIONS

export function setRuntimeCharacterAssetPackOptions(options: CharacterAssetPackOption[]): void {
  runtimeCharacterAssetPackOptions = options.length ? options : null
}

export function resetRuntimeCharacterAssetPackOptions(): void {
  runtimeCharacterAssetPackOptions = null
}

export async function ensureCharacterAssetPackCatalog(options?: { refresh?: boolean }): Promise<CharacterAssetPackOption[]> {
  if (!options?.refresh && runtimeCharacterAssetPackOptions?.length) {
    return runtimeCharacterAssetPackOptions
  }
  try {
    if (typeof window.api?.getCharacterPackCatalog === 'function') {
      const characters = await window.api.getCharacterPackCatalog()
      if (Array.isArray(characters) && characters.length) {
        const merged = mergeCharacterManifests(characters as ManifestCharacter[], characterManifest.characters as ManifestCharacter[])
        const built = buildCharacterAssetPackOptions({ characters: merged })
        if (built.length) {
          runtimeCharacterAssetPackOptions = built
          return built
        }
      }
    }
  } catch {
    /* fall back to bundled manifest */
  }
  runtimeCharacterAssetPackOptions = BUNDLED_CHARACTER_ASSET_PACK_OPTIONS
  return BUNDLED_CHARACTER_ASSET_PACK_OPTIONS
}

function currentCharacterAssetPackOptions(): CharacterAssetPackOption[] {
  return runtimeCharacterAssetPackOptions?.length
    ? runtimeCharacterAssetPackOptions
    : BUNDLED_CHARACTER_ASSET_PACK_OPTIONS
}

export function listCharacterAssetPackOptions(modelId = '', opts?: { filterByModel?: boolean }): CharacterAssetPackOption[] {
  const all = currentCharacterAssetPackOptions()
  if (!opts?.filterByModel || !modelId) return all

  const key = canonicalCharacterKey(inferLegacyCharacterKey('', modelId))
  const matched = all.filter((item) => item.characterId === key || item.modelId === modelId)
  return matched.length ? matched : all
}

export function listCharacterAssetPackGroups(modelId = ''): Array<{ label: string; options: CharacterAssetPackOption[] }> {
  return [{ label: '内置角色', options: listCharacterAssetPackOptions(modelId) }]
}

function resolvePackRef(ref: string): string | null {
  const parsed = parsePackAssetRef(ref)
  if (!parsed) return null

  const { characterId, slot, expressionId } = parsed
  let relativePath = ''
  if (slot === 'portrait-vertical') relativePath = `${characterId}/portrait.png`
  else if (slot === 'portrait-horizontal') relativePath = `${characterId}/banner.png`
  else if (slot === 'avatar' || slot === 'expression') {
    relativePath = `${characterId}/avatars/${expressionId || 'neutral'}.png`
  }

  return resolveRelativePackPath(relativePath)
}

function resolveOwnedRef(ref: string, characterId?: string): string | null {
  const parsed = parseOwnedAssetRef(ref)
  if (!parsed || !characterId) return null
  const rel = ownedAssetRelativePath(parsed.slot, parsed.expressionId)
  return charactersAssetUrl(`${characterId}/${rel}`)
}

export function resolveCharacterImageRef(
  ref = '',
  fallback?: { name?: string; index?: number; modelId?: string; characterId?: string }
): string | null {
  if (!ref) return null
  if (isDirectImageRef(ref)) return ref

  const owned = resolveOwnedRef(ref, fallback?.characterId)
  if (owned) return owned

  const fromPack = resolvePackRef(ref)
  if (fromPack) return fromPack

  const legacyKey = canonicalCharacterKey(inferLegacyCharacterKey(ref, fallback?.modelId || ''))
  if (!legacyKey) return null

  if (ref.includes('avatar') || ref.startsWith('asset://avatar/')) {
    return resolveRelativePackPath(`${legacyKey}/avatars/neutral.png`)
  }
  if (ref.includes('banner') || ref.includes('horizontal')) {
    return resolveRelativePackPath(`${legacyKey}/banner.png`)
  }
  return resolveRelativePackPath(`${legacyKey}/portrait.png`)
}

export function characterAvatarByName(name = '', index = 0, modelId = '', avatarUrl = '', characterId = ''): string {
  const resolved = resolveCharacterImageRef(avatarUrl, { name, index, modelId, characterId })
  if (resolved) return resolved

  const key = canonicalCharacterKey(inferLegacyCharacterKey('', modelId))
  const fallback = key ? resolveRelativePackPath(`${key}/avatars/neutral.png`) : null
  if (fallback) return fallback

  const ids = ['doubao', 'gpt', 'claude', 'deepseek', 'kimi', 'gemini', 'qwen', 'mistral', 'llama', 'hunyuan']
  return resolveRelativePackPath(`${ids[index % ids.length]}/avatars/neutral.png`)
}

export function characterPortraitByName(name = '', index = 0, modelId = '', portraitUrl = '', characterId = ''): string {
  const resolved = resolveCharacterImageRef(portraitUrl, { name, index, modelId, characterId })
  if (resolved) return resolved

  const key = canonicalCharacterKey(inferLegacyCharacterKey('', modelId))
  const fallback = key ? resolveRelativePackPath(`${key}/portrait.png`) : null
  if (fallback) return fallback

  const ids = ['doubao', 'gpt', 'claude', 'deepseek', 'kimi', 'gemini', 'qwen', 'mistral', 'llama', 'hunyuan']
  return resolveRelativePackPath(`${ids[index % ids.length]}/portrait.png`)
}

export function characterPortraitHorizontalByName(
  name = '',
  index = 0,
  modelId = '',
  portraitHorizontalUrl = '',
  portraitUrl = '',
  characterId = ''
): string {
  const resolved = resolveCharacterImageRef(portraitHorizontalUrl || portraitUrl, { name, index, modelId, characterId })
  if (resolved) return resolved

  const key = canonicalCharacterKey(inferLegacyCharacterKey(portraitHorizontalUrl || portraitUrl, modelId))
  const fallback = key ? resolveRelativePackPath(`${key}/banner.png`) : null
  if (fallback) return fallback

  return characterPortraitByName(name, index, modelId, portraitUrl)
}

export function characterExpressionByRef(
  expressionRef = '',
  fallback?: { name?: string; index?: number; modelId?: string; expressionId?: CharacterExpressionId; characterId?: string }
): string {
  const resolved = resolveCharacterImageRef(expressionRef, fallback)
  if (resolved) return resolved

  const key = canonicalCharacterKey(inferLegacyCharacterKey('', fallback?.modelId || '')) || 'doubao'
  const expressionId = fallback?.expressionId || 'neutral'
  return resolveRelativePackPath(`${key}/avatars/${expressionId}.png`) || characterAvatarByName('', 0, fallback?.modelId || '')
}

export const characterImageByName = characterPortraitByName

export function characterPortraitUrl(
  character: Pick<Character, 'id' | 'name' | 'modelId' | 'portraitUrl' | 'updatedAt'>,
  cacheToken?: string | number
): string {
  return appendAssetCacheBust(
    characterPortraitByName(character.name, 0, character.modelId, character.portraitUrl, character.id),
    cacheToken ?? character.updatedAt
  )
}

export function characterBannerUrl(
  character: Pick<Character, 'id' | 'name' | 'modelId' | 'portraitHorizontalUrl' | 'portraitUrl' | 'updatedAt'>,
  cacheToken?: string | number
): string {
  return appendAssetCacheBust(
    characterPortraitHorizontalByName(
      character.name,
      0,
      character.modelId,
      character.portraitHorizontalUrl,
      character.portraitUrl,
      character.id
    ),
    cacheToken ?? character.updatedAt
  )
}

export function characterAvatarUrl(
  character: Pick<Character, 'id' | 'name' | 'modelId' | 'avatarUrl' | 'updatedAt'>,
  cacheToken?: string | number
): string {
  return appendAssetCacheBust(
    characterAvatarByName(character.name, 0, character.modelId, character.avatarUrl, character.id),
    cacheToken ?? character.updatedAt
  )
}

export function applyCharacterAssetPack(character: Character, option: CharacterAssetPackOption): Character {
  const patch = buildPackVisualPatch(option.characterId, option.accent || character.accentColor)
  return normalizeCharacterVisuals({
    ...character,
    ...patch,
  })
}

export function normalizeCharacterAssets<T extends CharacterVisualLike>(character: T): T {
  return normalizeCharacterVisuals(character)
}

export function buildExpressionRef(character: Character, expressionId: CharacterExpressionId): string {
  return character.expressionUrls?.[expressionId] || buildPackAssetRef('doubao', 'expression', expressionId)
}

export function slotFromEditorTab(tab: 'avatar' | 'portrait-vertical' | 'portrait-horizontal' | 'expressions'): CharacterImageSlot {
  if (tab === 'expressions') return 'expression'
  return tab
}

export { modeImageById, matchImageByModeId, modeBadges } from './arena-visual-assets-home'
