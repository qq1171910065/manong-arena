/** Character visual asset refs, slots, and normalization (shared by main + renderer). */

export type CharacterExpressionId = 'neutral' | 'thinking' | 'confident' | 'happy' | 'sad' | 'angry'

export type CharacterImageSlot = 'avatar' | 'portrait-vertical' | 'portrait-horizontal' | 'expression'

export interface CharacterImageSpec {
  label: string
  width: number
  height: number
  ratio: number
  /** Allowed relative deviation from target ratio, e.g. 0.12 = ±12% */
  ratioTolerance: number
  hint: string
}

export const CHARACTER_EXPRESSIONS: Array<{ id: CharacterExpressionId; label: string }> = [
  { id: 'neutral', label: '默认' },
  { id: 'thinking', label: '思考' },
  { id: 'confident', label: '自信' },
  { id: 'happy', label: '开心' },
  { id: 'sad', label: '低落' },
  { id: 'angry', label: '生气' },
]

export const CHARACTER_IMAGE_SPECS: Record<CharacterImageSlot, CharacterImageSpec> = {
  avatar: {
    label: '头像',
    width: 256,
    height: 256,
    ratio: 1,
    ratioTolerance: 0.12,
    hint: '正方形 PNG，推荐 256×256',
  },
  'portrait-vertical': {
    label: '竖版立绘',
    width: 720,
    height: 1280,
    ratio: 9 / 16,
    ratioTolerance: 0.15,
    hint: '竖向 PNG，推荐 720×1280（9:16）',
  },
  'portrait-horizontal': {
    label: '横版立绘',
    width: 1280,
    height: 720,
    ratio: 16 / 9,
    ratioTolerance: 0.15,
    hint: '横向 PNG，推荐 1280×720（16:9）',
  },
  expression: {
    label: '表情',
    width: 256,
    height: 256,
    ratio: 1,
    ratioTolerance: 0.12,
    hint: '正方形 PNG，推荐 256×256',
  },
}

export interface CharacterVisualPatch {
  visualPackId?: string
  avatarUrl?: string
  portraitUrl?: string
  portraitHorizontalUrl?: string
  expressionUrls?: Partial<Record<CharacterExpressionId, string>>
  accentColor?: string
}

export interface CharacterVisualLike {
  modelId?: string
  avatarUrl?: string
  portraitUrl?: string
  portraitHorizontalUrl?: string
  expressionUrls?: Partial<Record<CharacterExpressionId, string>>
  visualPackId?: string
  accentColor?: string
}

const LEGACY_KEY_ALIASES: Record<string, string> = {
  glm: 'qwen',
  minimax: 'gemini',
  yi: 'deepseek',
  ernie: 'gpt',
  grok: 'mistral',
  spark: 'kimi',
}

const LEGACY_PACK_IDS = new Set(['standard-v1', 'standard-vendor-16', 'model-vendors-v1', 'model-vendors-chibi-v1'])

const PACK_SLOT_PATTERN = '(avatar|portrait-vertical|portrait-horizontal|expression)'

export function buildPackAssetRef(
  characterId: string,
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): string {
  if (slot === 'expression') return `asset://pack/${characterId}/expression/${expressionId}`
  if (slot === 'avatar') return `asset://pack/${characterId}/avatar/${expressionId}`
  return `asset://pack/${characterId}/${slot}`
}

export function buildDefaultExpressionRefs(characterId: string): Partial<Record<CharacterExpressionId, string>> {
  const refs: Partial<Record<CharacterExpressionId, string>> = {}
  for (const item of CHARACTER_EXPRESSIONS) {
    refs[item.id] = buildPackAssetRef(characterId, 'expression', item.id)
  }
  return refs
}

export function buildPackVisualPatch(characterId: string, accentColor?: string): CharacterVisualPatch {
  return {
    visualPackId: characterId,
    avatarUrl: buildPackAssetRef(characterId, 'avatar', 'neutral'),
    portraitUrl: buildPackAssetRef(characterId, 'portrait-vertical'),
    portraitHorizontalUrl: buildPackAssetRef(characterId, 'portrait-horizontal'),
    expressionUrls: buildDefaultExpressionRefs(characterId),
    accentColor,
  }
}

export function inferLegacyCharacterKey(ref = '', modelId = ''): string | null {
  const normalized = `${ref} ${modelId}`.toLowerCase()
  const keys = [
    'default',
    'doubao',
    'gpt',
    'claude',
    'deepseek',
    'kimi',
    'gemini',
    'qwen',
    'mistral',
    'llama',
    'hunyuan',
    'glm',
    'minimax',
    'ernie',
    'spark',
    'yi',
    'grok',
  ]
  for (const key of keys) {
    if (normalized.includes(key)) return key
  }
  if (normalized.includes('豆包')) return 'doubao'
  if (normalized.includes('通义') || normalized.includes('千问')) return 'qwen'
  if (normalized.includes('混元')) return 'hunyuan'
  if (normalized.includes('智谱')) return 'glm'
  if (normalized.includes('文心')) return 'ernie'
  if (normalized.includes('星火') || normalized.includes('讯飞')) return 'spark'
  if (normalized.includes('零一')) return 'yi'
  return null
}

export function canonicalCharacterKey(key: string | null | undefined): string | null {
  if (!key) return null
  const lower = key.toLowerCase()
  return LEGACY_KEY_ALIASES[lower] || lower
}

export function parsePackAssetRef(ref = ''): {
  characterId: string
  slot: CharacterImageSlot
  expressionId?: CharacterExpressionId
} | null {
  const legacy = ref.match(
    new RegExp(`^asset://pack/[^/]+/([^/]+)/${PACK_SLOT_PATTERN}(?:/([a-z]+))?$`, 'i')
  )
  if (legacy) {
    return {
      characterId: legacy[1],
      slot: legacy[2] as CharacterImageSlot,
      expressionId: legacy[3] as CharacterExpressionId | undefined,
    }
  }

  const flat = ref.match(
    new RegExp(`^asset://pack/([^/]+)/${PACK_SLOT_PATTERN}(?:/([a-z]+))?$`, 'i')
  )
  if (!flat) return null
  return {
    characterId: flat[1],
    slot: flat[2] as CharacterImageSlot,
    expressionId: flat[3] as CharacterExpressionId | undefined,
  }
}

function resolveVisualCharacterId(visualPackId?: string, legacyKey?: string | null): string {
  if (visualPackId?.includes('/')) {
    const [maybePack, maybeCharacter] = visualPackId.split('/')
    if (LEGACY_PACK_IDS.has(maybePack)) {
      return canonicalCharacterKey(maybeCharacter) || legacyKey || 'doubao'
    }
    return canonicalCharacterKey(maybeCharacter || maybePack) || legacyKey || 'doubao'
  }
  if (visualPackId) {
    return canonicalCharacterKey(visualPackId) || legacyKey || 'doubao'
  }
  return canonicalCharacterKey(legacyKey) || 'doubao'
}

export function normalizeCharacterVisuals<T extends CharacterVisualLike>(character: T): T {
  const next = { ...character }
  const legacyKey = canonicalCharacterKey(inferLegacyCharacterKey(next.avatarUrl || next.portraitUrl || '', next.modelId || ''))
  const packCharacterId = resolveVisualCharacterId(next.visualPackId, legacyKey)

  if (!next.visualPackId || next.visualPackId.includes('/')) {
    next.visualPackId = packCharacterId
  }

  if (next.avatarUrl?.startsWith('asset://avatar/')) {
    next.avatarUrl = buildPackAssetRef(packCharacterId, 'avatar', 'neutral')
  } else if (!next.avatarUrl) {
    next.avatarUrl = buildPackAssetRef(packCharacterId, 'avatar', 'neutral')
  }

  if (next.portraitUrl?.startsWith('asset://portrait/')) {
    next.portraitUrl = buildPackAssetRef(packCharacterId, 'portrait-vertical')
  } else if (!next.portraitUrl) {
    next.portraitUrl = buildPackAssetRef(packCharacterId, 'portrait-vertical')
  }

  if (!next.portraitHorizontalUrl) {
    next.portraitHorizontalUrl = buildPackAssetRef(packCharacterId, 'portrait-horizontal')
  } else if (next.portraitHorizontalUrl.startsWith('asset://banner/')) {
    next.portraitHorizontalUrl = buildPackAssetRef(packCharacterId, 'portrait-horizontal')
  }

  const expressions = { ...(next.expressionUrls || {}) }
  for (const item of CHARACTER_EXPRESSIONS) {
    if (!expressions[item.id]) {
      expressions[item.id] = buildPackAssetRef(packCharacterId, 'expression', item.id)
    }
  }
  next.expressionUrls = expressions

  return next
}

export function isDirectImageRef(ref = ''): boolean {
  return /^(data:image\/|blob:|file:|https?:\/\/)/i.test(ref)
}

export function imageSpecForSlot(slot: CharacterImageSlot): CharacterImageSpec {
  return slot === 'expression' ? CHARACTER_IMAGE_SPECS.expression : CHARACTER_IMAGE_SPECS[slot]
}

export function validateImageDimensions(
  width: number,
  height: number,
  slot: CharacterImageSlot
): { ok: true } | { ok: false; message: string } {
  const spec = imageSpecForSlot(slot)
  if (width < 32 || height < 32) {
    return { ok: false, message: `${spec.label}尺寸过小，请使用清晰 PNG 图片。` }
  }
  const ratio = width / height
  const delta = Math.abs(ratio - spec.ratio) / spec.ratio
  if (delta > spec.ratioTolerance) {
    return {
      ok: false,
      message: `${spec.label}宽高比不符合要求。${spec.hint}`,
    }
  }
  return { ok: true }
}
