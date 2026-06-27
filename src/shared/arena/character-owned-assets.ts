import {
  CHARACTER_EXPRESSIONS,
  type CharacterExpressionId,
  type CharacterImageSlot,
} from './character-visuals'

export const CHARACTER_OWNED_REF_PREFIX = 'asset://owned/' as const
export const CHARACTER_PACKAGED_REF_PREFIX = 'package://' as const

export const CHARACTER_PACK_EXPORT_KIND = 'agent-arena/character-pack-v2' as const

export interface CharacterPackManifest {
  kind: typeof CHARACTER_PACK_EXPORT_KIND
  version: 2
  exportedAt: string
}

export function isCharacterPackManifest(value: unknown): value is CharacterPackManifest {
  if (!value || typeof value !== 'object') return false
  const manifest = value as Partial<CharacterPackManifest>
  return manifest.kind === CHARACTER_PACK_EXPORT_KIND && manifest.version === 2
}

export function buildOwnedAssetRef(
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): string {
  if (slot === 'expression') return `${CHARACTER_OWNED_REF_PREFIX}expression/${expressionId}`
  if (slot === 'avatar') return `${CHARACTER_OWNED_REF_PREFIX}avatar/${expressionId}`
  return `${CHARACTER_OWNED_REF_PREFIX}${slot}`
}

export function parseOwnedAssetRef(ref = ''): {
  slot: CharacterImageSlot
  expressionId?: CharacterExpressionId
} | null {
  if (!ref.startsWith(CHARACTER_OWNED_REF_PREFIX)) return null
  const tail = ref.slice(CHARACTER_OWNED_REF_PREFIX.length)
  if (tail === 'portrait-vertical' || tail === 'portrait-horizontal') {
    return { slot: tail as CharacterImageSlot }
  }
  const avatarMatch = tail.match(/^avatar\/([a-z]+)$/i)
  if (avatarMatch) {
    return { slot: 'avatar', expressionId: avatarMatch[1] as CharacterExpressionId }
  }
  const expressionMatch = tail.match(/^expression\/([a-z]+)$/i)
  if (expressionMatch) {
    return { slot: 'expression', expressionId: expressionMatch[1] as CharacterExpressionId }
  }
  return null
}

export function isOwnedAssetRef(ref = ''): boolean {
  return Boolean(parseOwnedAssetRef(ref))
}

export function ownedAssetRelativePath(
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): string {
  if (slot === 'portrait-vertical') return 'portrait.png'
  if (slot === 'portrait-horizontal') return 'banner.png'
  return `avatars/${expressionId || 'neutral'}.png`
}

export function buildPackagedAssetRef(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `${CHARACTER_PACKAGED_REF_PREFIX}${normalized}`
}

export function parsePackagedAssetRef(ref = ''): string | null {
  if (!ref.startsWith(CHARACTER_PACKAGED_REF_PREFIX)) return null
  return ref.slice(CHARACTER_PACKAGED_REF_PREFIX.length)
}

export function packagedAssetPathForSlot(
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): string {
  return buildPackagedAssetRef(`assets/${ownedAssetRelativePath(slot, expressionId)}`)
}

export function collectCharacterVisualRefs(input: {
  avatarUrl?: string
  portraitUrl?: string
  portraitHorizontalUrl?: string
  expressionUrls?: Partial<Record<CharacterExpressionId, string>>
}): Array<{ ref: string; slot: CharacterImageSlot; expressionId?: CharacterExpressionId }> {
  const rows: Array<{ ref: string; slot: CharacterImageSlot; expressionId?: CharacterExpressionId }> = []
  if (input.avatarUrl) rows.push({ ref: input.avatarUrl, slot: 'avatar', expressionId: 'neutral' })
  if (input.portraitUrl) rows.push({ ref: input.portraitUrl, slot: 'portrait-vertical' })
  if (input.portraitHorizontalUrl) {
    rows.push({ ref: input.portraitHorizontalUrl, slot: 'portrait-horizontal' })
  }
  for (const item of CHARACTER_EXPRESSIONS) {
    const ref = input.expressionUrls?.[item.id]
    if (ref) rows.push({ ref, slot: 'expression', expressionId: item.id })
  }
  return rows
}

export function characterNeedsAssetMaterialize(input: {
  avatarUrl?: string
  portraitUrl?: string
  portraitHorizontalUrl?: string
  expressionUrls?: Partial<Record<CharacterExpressionId, string>>
}): boolean {
  return collectCharacterVisualRefs(input).some((row) => !isOwnedAssetRef(row.ref))
}
