import { randomUUID } from 'node:crypto'
import { createWriteStream, existsSync } from 'node:fs'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, normalize as normalizePath } from 'node:path'
import archiver from 'archiver'
import extractZip from 'extract-zip'
import { app } from 'electron'
import { ARENA_ASSET_SCHEME } from '@shared/arena/asset-url'
import {
  CHARACTER_EXPRESSIONS,
  buildPackVisualPatch,
  isDirectImageRef,
  normalizeCharacterVisuals,
  parsePackAssetRef,
  type CharacterExpressionId,
  type CharacterImageSlot,
} from '@shared/arena/character-visuals'
import {
  CHARACTER_PACK_EXPORT_KIND,
  buildOwnedAssetRef,
  characterNeedsAssetMaterialize,
  isCharacterPackManifest,
  isOwnedAssetRef,
  ownedAssetRelativePath,
  packagedAssetPathForSlot,
  parsePackagedAssetRef,
  type CharacterPackManifest,
} from '@shared/arena/character-owned-assets'
import {
  isCharacterExportPackage,
  type CharacterExportPackage,
} from '@shared/arena/export-packages'
import type { Character } from '@shared/arena/types'
import { getInstalledAssetsDir, resolveAssetFilePath } from '../asset-pack/paths'

const CHARACTER_JSON = 'character.json'
const MANIFEST_JSON = 'manifest.json'

export function getCharacterAssetsDir(appId: string, characterId: string): string {
  return join(getInstalledAssetsDir(appId), 'characters', characterId)
}

function resolvePackSourcePath(
  appId: string,
  packCharacterId: string,
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): string | null {
  let relativePath = ''
  if (slot === 'portrait-vertical') relativePath = `${packCharacterId}/portrait.png`
  else if (slot === 'portrait-horizontal') relativePath = `${packCharacterId}/banner.png`
  else relativePath = `${packCharacterId}/avatars/${expressionId || 'neutral'}.png`
  return resolveAssetFilePath(`character-packs/${relativePath}`, appId)
}

function parseArenaAssetCharacterRelative(ref = ''): string | null {
  const prefix = `${ARENA_ASSET_SCHEME}://local/characters/`
  if (!ref.startsWith(prefix)) return null
  return decodeURIComponent(ref.slice(prefix.length)).replace(/^\/+/, '')
}

async function writeDataUrlToFile(dataUrl: string, destPath: string): Promise<void> {
  const match = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/s)
  if (!match) throw new Error('无效的图片数据')
  const buffer = Buffer.from(match[2], 'base64')
  await mkdir(dirname(destPath), { recursive: true })
  await writeFile(destPath, buffer)
}

async function copyFileEnsureDir(src: string, dest: string): Promise<void> {
  if (isSameAssetPath(src, dest)) return
  await mkdir(dirname(dest), { recursive: true })
  await cp(src, dest)
}

function isSameAssetPath(src: string, dest: string): boolean {
  return normalizePath(src).toLowerCase() === normalizePath(dest).toLowerCase()
}

function resolveRefSourcePath(
  appId: string,
  characterId: string,
  ref: string,
  slot: CharacterImageSlot,
  expressionId?: CharacterExpressionId
): string | null {
  if (!ref) return null

  const ownedPath = join(
    getCharacterAssetsDir(appId, characterId),
    ownedAssetRelativePath(slot, expressionId)
  )
  if (isOwnedAssetRef(ref) && existsSync(ownedPath)) return ownedPath

  const packaged = parsePackagedAssetRef(ref)
  if (packaged) return null

  const arenaRelative = parseArenaAssetCharacterRelative(ref)
  if (arenaRelative) {
    return resolveAssetFilePath(`characters/${arenaRelative}`, appId)
  }

  const pack = parsePackAssetRef(ref)
  if (pack) {
    return resolvePackSourcePath(appId, pack.characterId, slot, expressionId)
  }

  if (ref.includes('avatar') || ref.startsWith('asset://avatar/')) {
    const legacyKey = ref.split('/').pop() || 'doubao'
    return resolvePackSourcePath(appId, legacyKey, slot, expressionId)
  }
  if (ref.includes('banner') || ref.includes('horizontal') || ref.startsWith('asset://banner/')) {
    const legacyKey = ref.split('/').pop() || 'doubao'
    return resolvePackSourcePath(appId, legacyKey, 'portrait-horizontal', expressionId)
  }
  if (ref.includes('portrait') || ref.startsWith('asset://portrait/')) {
    const legacyKey = ref.split('/').pop() || 'doubao'
    return resolvePackSourcePath(appId, legacyKey, 'portrait-vertical', expressionId)
  }

  return null
}

async function materializeVisualRef(
  appId: string,
  characterId: string,
  ref: string,
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId = 'neutral'
): Promise<string> {
  const ownedRef = buildOwnedAssetRef(slot, expressionId)
  const destPath = join(getCharacterAssetsDir(appId, characterId), ownedAssetRelativePath(slot, expressionId))
  const packRef = parsePackAssetRef(ref)

  if (isOwnedAssetRef(ref) && existsSync(destPath)) {
    return ownedRef
  }

  if (isDirectImageRef(ref)) {
    await writeDataUrlToFile(ref, destPath)
    return ownedRef
  }

  const src = resolveRefSourcePath(appId, characterId, ref, slot, expressionId)
  if (src && existsSync(src)) {
    if (!isSameAssetPath(src, destPath)) {
      await copyFileEnsureDir(src, destPath)
    }
    return ownedRef
  }

  if (packRef) {
    throw new Error(`找不到素材包「${packRef.characterId}」的${slot}文件，请确认初始素材已安装。`)
  }

  if (existsSync(destPath)) return ownedRef
  return ownedRef
}

export async function materializeCharacterAssets(appId: string, character: Character): Promise<Character> {
  await mkdir(getCharacterAssetsDir(appId, character.id), { recursive: true })
  const normalized = normalizeCharacterVisuals(structuredClone(character))
  const next: Character = { ...normalized }

  next.avatarUrl = await materializeVisualRef(
    appId,
    character.id,
    normalized.avatarUrl || '',
    'avatar',
    'neutral'
  )
  next.portraitUrl = await materializeVisualRef(
    appId,
    character.id,
    normalized.portraitUrl || '',
    'portrait-vertical'
  )
  next.portraitHorizontalUrl = await materializeVisualRef(
    appId,
    character.id,
    normalized.portraitHorizontalUrl || normalized.portraitUrl || '',
    'portrait-horizontal'
  )

  const expressions = { ...(normalized.expressionUrls || {}) }
  for (const item of CHARACTER_EXPRESSIONS) {
    const ref = expressions[item.id] || normalized.avatarUrl || ''
    expressions[item.id] = await materializeVisualRef(
      appId,
      character.id,
      ref,
      'expression',
      item.id
    )
  }
  next.expressionUrls = expressions
  if (character.visualPackId) next.visualPackId = character.visualPackId
  return next
}

export async function materializeCharacterFromPack(
  appId: string,
  character: Character,
  packId: string,
  packCharacterId: string
): Promise<Character> {
  const assetDir = getCharacterAssetsDir(appId, character.id)
  await rm(assetDir, { recursive: true, force: true })
  const patch = buildPackVisualPatch(packCharacterId, character.accentColor)
  const materialized = await materializeCharacterAssets(appId, { ...character, ...patch })
  materialized.visualPackId = packCharacterId
  return materialized
}

export async function writeCharacterAssetFile(
  appId: string,
  characterId: string,
  slot: CharacterImageSlot,
  expressionId: CharacterExpressionId | undefined,
  dataUrl: string
): Promise<string> {
  const exp = slot === 'portrait-vertical' || slot === 'portrait-horizontal' ? 'neutral' : expressionId || 'neutral'
  const destPath = join(getCharacterAssetsDir(appId, characterId), ownedAssetRelativePath(slot, exp))
  await writeDataUrlToFile(dataUrl, destPath)
  return buildOwnedAssetRef(slot, exp)
}

export async function duplicateCharacterAssets(appId: string, fromId: string, toId: string): Promise<void> {
  const src = getCharacterAssetsDir(appId, fromId)
  const dest = getCharacterAssetsDir(appId, toId)
  if (!existsSync(src)) return
  await rm(dest, { recursive: true, force: true })
  await cp(src, dest, { recursive: true })
}

export async function deleteCharacterAssets(appId: string, characterId: string): Promise<void> {
  await rm(getCharacterAssetsDir(appId, characterId), { recursive: true, force: true })
}

export async function materializeAllCharacters(appId: string, characters: Character[]): Promise<Character[]> {
  const next: Character[] = []
  for (const character of characters) {
    if (characterNeedsAssetMaterialize(character)) {
      next.push(await materializeCharacterAssets(appId, character))
    } else {
      next.push(character)
    }
  }
  return next
}

function serializeCharacterForPackExport(character: Character): Character {
  const next = structuredClone(character)
  next.avatarUrl = packagedAssetPathForSlot('avatar', 'neutral')
  next.portraitUrl = packagedAssetPathForSlot('portrait-vertical')
  next.portraitHorizontalUrl = packagedAssetPathForSlot('portrait-horizontal')
  const expressions: Partial<Record<CharacterExpressionId, string>> = {}
  for (const item of CHARACTER_EXPRESSIONS) {
    expressions[item.id] = packagedAssetPathForSlot('expression', item.id)
  }
  next.expressionUrls = expressions
  next.visualPackId = undefined
  return next
}

async function createCharacterZip(
  zipPath: string,
  manifest: CharacterPackManifest,
  character: Character,
  assetsDir: string
): Promise<void> {
  await mkdir(dirname(zipPath), { recursive: true })
  await new Promise<void>((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })

    output.on('close', () => resolve())
    archive.on('error', reject)
    output.on('error', reject)

    archive.pipe(output)
    archive.append(JSON.stringify(manifest, null, 2), { name: MANIFEST_JSON })
    archive.append(JSON.stringify(character, null, 2), { name: CHARACTER_JSON })
    archive.directory(assetsDir, 'assets')
    void archive.finalize()
  })
}

export async function exportCharacterPack(appId: string, character: Character, zipPath: string): Promise<void> {
  const materialized = await materializeCharacterAssets(appId, character)
  const exportCharacter = serializeCharacterForPackExport(materialized)
  const manifest: CharacterPackManifest = {
    kind: CHARACTER_PACK_EXPORT_KIND,
    version: 2,
    exportedAt: new Date().toISOString(),
  }
  await createCharacterZip(
    zipPath,
    manifest,
    exportCharacter,
    getCharacterAssetsDir(appId, materialized.id)
  )
}

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

function remapPackagedCharacter(character: Character, characterId: string): Character {
  const next = structuredClone(character)
  const remapRef = (ref: string, slot: CharacterImageSlot, expressionId?: CharacterExpressionId) => {
    const packaged = parsePackagedAssetRef(ref)
    if (packaged) return buildOwnedAssetRef(slot, expressionId)
    if (isOwnedAssetRef(ref)) return ref
    return buildOwnedAssetRef(slot, expressionId)
  }

  next.id = characterId
  next.avatarUrl = remapRef(character.avatarUrl || '', 'avatar', 'neutral')
  next.portraitUrl = remapRef(character.portraitUrl || '', 'portrait-vertical')
  next.portraitHorizontalUrl = remapRef(character.portraitHorizontalUrl || '', 'portrait-horizontal')
  const expressions: Partial<Record<CharacterExpressionId, string>> = {}
  for (const item of CHARACTER_EXPRESSIONS) {
    const ref = character.expressionUrls?.[item.id] || ''
    expressions[item.id] = remapRef(ref, 'expression', item.id)
  }
  next.expressionUrls = expressions
  next.visualPackId = undefined
  return next
}

async function copyImportedAssets(sourceDir: string, characterId: string, appId: string): Promise<void> {
  const destDir = getCharacterAssetsDir(appId, characterId)
  await rm(destDir, { recursive: true, force: true })
  if (existsSync(sourceDir)) {
    await cp(sourceDir, destDir, { recursive: true })
  } else {
    await mkdir(destDir, { recursive: true })
  }
}

async function importCharacterFromExtractedDir(
  appId: string,
  extractedDir: string,
  characterId: string
): Promise<Character> {
  const manifestPath = join(extractedDir, MANIFEST_JSON)
  const characterPath = join(extractedDir, CHARACTER_JSON)
  if (!existsSync(characterPath)) {
    throw new Error('压缩包内缺少 character.json')
  }

  if (existsSync(manifestPath)) {
    const manifest = await readJsonFile<unknown>(manifestPath)
    if (!isCharacterPackManifest(manifest)) {
      throw new Error('不是有效的角色包 manifest')
    }
  }

  const parsed = await readJsonFile<unknown>(characterPath)
  let character: Character
  if (isCharacterExportPackage(parsed)) {
    character = parsed.character
  } else if (parsed && typeof parsed === 'object' && 'name' in parsed) {
    character = parsed as Character
  } else {
    throw new Error('不是有效的角色配置')
  }

  const assetsDir = join(extractedDir, 'assets')
  await copyImportedAssets(assetsDir, characterId, appId)
  return normalizeCharacterVisuals(remapPackagedCharacter(character, characterId))
}

export async function importCharacterPackFromZip(appId: string, zipPath: string, characterId: string): Promise<Character> {
  const tempDir = join(app.getPath('temp'), `arena-char-import-${randomUUID()}`)
  await mkdir(tempDir, { recursive: true })
  try {
    await extractZip(zipPath, { dir: tempDir })
    return await importCharacterFromExtractedDir(appId, tempDir, characterId)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

export async function importLegacyCharacterJson(
  appId: string,
  payload: CharacterExportPackage,
  characterId: string
): Promise<Character> {
  const character = normalizeCharacterVisuals({
    ...payload.character,
    id: characterId,
  })
  return materializeCharacterAssets(appId, character)
}

export function isZipFilePath(filePath: string): boolean {
  return basename(filePath).toLowerCase().endsWith('.zip')
}

export function isLegacyCharacterJsonPath(filePath: string): boolean {
  const lower = basename(filePath).toLowerCase()
  return lower.endsWith('.json') && lower.includes('arena-character')
}

export { isCharacterExportPackage }
