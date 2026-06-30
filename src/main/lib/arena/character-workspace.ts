import { randomUUID } from 'node:crypto'
import { createReadStream, existsSync } from 'node:fs'
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { basename, join, normalize as normalizePath, relative, sep } from 'node:path'
import {
  CHARACTER_WORKSPACE_FILE_MAX,
  CHARACTER_WORKSPACE_TEXT_MAX_BYTES,
  type CharacterWorkspaceFile,
} from '@shared/arena/character-agent'
import { getAppStorageDir } from '../app-home'

const WORKSPACE_DIR = 'workspace'
const TEXT_EXTENSIONS = new Set(['.txt', '.md', '.json', '.csv', '.yaml', '.yml', '.log'])

function getCharacterWorkspaceRoot(appId: string, characterId: string): string {
  return join(getAppStorageDir(appId), 'characters', characterId, WORKSPACE_DIR)
}

function guessMimeType(name: string): string {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  if (ext === '.md') return 'text/markdown'
  if (ext === '.json') return 'application/json'
  if (ext === '.csv') return 'text/csv'
  if (ext === '.yaml' || ext === '.yml') return 'text/yaml'
  return 'text/plain'
}

function isSafeRelativePath(relativePath: string): boolean {
  const normalized = normalizePath(relativePath).replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('..') || normalized.includes('/..')) return false
  return true
}

function resolveWorkspaceFilePath(appId: string, characterId: string, relativePath: string): string {
  if (!isSafeRelativePath(relativePath)) throw new Error('无效的文件路径')
  const root = getCharacterWorkspaceRoot(appId, characterId)
  const abs = normalizePath(join(root, relativePath))
  if (!abs.startsWith(normalizePath(root))) throw new Error('无效的文件路径')
  return abs
}

async function ensureWorkspaceRoot(appId: string, characterId: string): Promise<string> {
  const root = getCharacterWorkspaceRoot(appId, characterId)
  await mkdir(root, { recursive: true })
  return root
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
  return trimmed || 'untitled.txt'
}

export function getCharacterWorkspaceDir(appId: string, characterId: string): string {
  return getCharacterWorkspaceRoot(appId, characterId)
}

export async function listCharacterWorkspaceFiles(
  appId: string,
  characterId: string,
  stored: CharacterWorkspaceFile[] = []
): Promise<CharacterWorkspaceFile[]> {
  await ensureWorkspaceRoot(appId, characterId)
  const byPath = new Map(stored.map((item) => [item.relativePath, item]))
  const root = getCharacterWorkspaceRoot(appId, characterId)
  const entries = await readdir(root, { withFileTypes: true })
  const next: CharacterWorkspaceFile[] = []

  for (const entry of entries) {
    if (!entry.isFile()) continue
    const relativePath = entry.name
    const abs = join(root, relativePath)
    const info = await stat(abs)
    const existing = byPath.get(relativePath)
    next.push({
      id: existing?.id || randomUUID(),
      name: existing?.name || basename(relativePath),
      relativePath,
      mimeType: existing?.mimeType || guessMimeType(relativePath),
      sizeBytes: info.size,
      description: existing?.description,
      createdAt: existing?.createdAt || info.birthtime.toISOString(),
      updatedAt: info.mtime.toISOString(),
    })
  }

  return next
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, CHARACTER_WORKSPACE_FILE_MAX)
}

export async function readCharacterWorkspaceFile(
  appId: string,
  characterId: string,
  relativePath: string
): Promise<string> {
  const abs = resolveWorkspaceFilePath(appId, characterId, relativePath)
  if (!existsSync(abs)) throw new Error('文件不存在')
  const info = await stat(abs)
  if (info.size > CHARACTER_WORKSPACE_TEXT_MAX_BYTES) {
    throw new Error(`文件过大（上限 ${Math.round(CHARACTER_WORKSPACE_TEXT_MAX_BYTES / 1024)}KB）`)
  }
  return readFile(abs, 'utf8')
}

export async function writeCharacterWorkspaceFile(
  appId: string,
  characterId: string,
  input: {
    relativePath?: string
    name: string
    content: string
    description?: string
    id?: string
  },
  stored: CharacterWorkspaceFile[] = []
): Promise<{ file: CharacterWorkspaceFile; files: CharacterWorkspaceFile[] }> {
  if (stored.length >= CHARACTER_WORKSPACE_FILE_MAX && !input.relativePath) {
    throw new Error(`文件空间已满（最多 ${CHARACTER_WORKSPACE_FILE_MAX} 个）`)
  }
  const contentBytes = Buffer.byteLength(input.content, 'utf8')
  if (contentBytes > CHARACTER_WORKSPACE_TEXT_MAX_BYTES) {
    throw new Error(`内容过大（上限 ${Math.round(CHARACTER_WORKSPACE_TEXT_MAX_BYTES / 1024)}KB）`)
  }

  await ensureWorkspaceRoot(appId, characterId)
  const safeName = sanitizeFileName(input.name)
  const relativePath = input.relativePath || safeName
  if (!isSafeRelativePath(relativePath)) throw new Error('无效的文件名')

  const abs = resolveWorkspaceFilePath(appId, characterId, relativePath)
  await writeFile(abs, input.content, 'utf8')
  const info = await stat(abs)
  const existing = stored.find((item) => item.relativePath === relativePath)
  const now = new Date().toISOString()
  const file: CharacterWorkspaceFile = {
    id: input.id || existing?.id || randomUUID(),
    name: safeName,
    relativePath,
    mimeType: guessMimeType(relativePath),
    sizeBytes: info.size,
    description: input.description ?? existing?.description,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  }

  const files = [
    ...stored.filter((item) => item.relativePath !== relativePath),
    file,
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, CHARACTER_WORKSPACE_FILE_MAX)

  return { file, files }
}

export async function deleteCharacterWorkspaceFile(
  appId: string,
  characterId: string,
  relativePath: string,
  stored: CharacterWorkspaceFile[] = []
): Promise<CharacterWorkspaceFile[]> {
  const abs = resolveWorkspaceFilePath(appId, characterId, relativePath)
  await rm(abs, { force: true })
  return stored.filter((item) => item.relativePath !== relativePath)
}

export async function importCharacterWorkspaceFile(
  appId: string,
  characterId: string,
  sourcePath: string,
  stored: CharacterWorkspaceFile[] = []
): Promise<{ file: CharacterWorkspaceFile; files: CharacterWorkspaceFile[] }> {
  if (stored.length >= CHARACTER_WORKSPACE_FILE_MAX) {
    throw new Error(`文件空间已满（最多 ${CHARACTER_WORKSPACE_FILE_MAX} 个）`)
  }
  const name = sanitizeFileName(basename(sourcePath))
  const content = await readFile(sourcePath, 'utf8')
  return writeCharacterWorkspaceFile(appId, characterId, { name, content }, stored)
}

export async function duplicateCharacterWorkspace(
  appId: string,
  sourceCharacterId: string,
  targetCharacterId: string,
  stored: CharacterWorkspaceFile[] = []
): Promise<CharacterWorkspaceFile[]> {
  const sourceRoot = getCharacterWorkspaceRoot(appId, sourceCharacterId)
  if (!existsSync(sourceRoot)) return []
  await ensureWorkspaceRoot(appId, targetCharacterId)
  const targetRoot = getCharacterWorkspaceRoot(appId, targetCharacterId)
  await cp(sourceRoot, targetRoot, { recursive: true, force: true })
  const files = await listCharacterWorkspaceFiles(appId, targetCharacterId, stored)
  return files.map((file) => ({ ...file, id: randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
}

export async function deleteCharacterWorkspace(appId: string, characterId: string): Promise<void> {
  await rm(join(getAppStorageDir(appId), 'characters', characterId), { recursive: true, force: true })
}

export function isWorkspaceTextFile(name: string): boolean {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
  return TEXT_EXTENSIONS.has(ext)
}

export async function readWorkspaceExcerptsForPrompt(
  appId: string,
  characterId: string,
  files: CharacterWorkspaceFile[],
  maxChars = 4000
): Promise<Array<{ name: string; content: string }>> {
  const excerpts: Array<{ name: string; content: string }> = []
  let total = 0
  for (const file of files) {
    if (!isWorkspaceTextFile(file.name)) continue
    try {
      const raw = await readCharacterWorkspaceFile(appId, characterId, file.relativePath)
      const slice = raw.trim().slice(0, Math.max(200, Math.floor(maxChars / 4)))
      if (!slice) continue
      if (total + slice.length > maxChars) break
      excerpts.push({ name: file.name, content: slice })
      total += slice.length
    } catch {
      // skip unreadable files
    }
  }
  return excerpts
}

export async function streamCharacterWorkspaceFile(
  appId: string,
  characterId: string,
  relativePath: string
): Promise<NodeJS.ReadableStream> {
  const abs = resolveWorkspaceFilePath(appId, characterId, relativePath)
  if (!existsSync(abs)) throw new Error('文件不存在')
  return createReadStream(abs)
}

export function workspaceRelativePathFromRoot(appId: string, characterId: string, absPath: string): string {
  const root = getCharacterWorkspaceRoot(appId, characterId)
  return relative(root, absPath).split(sep).join('/')
}
