/**
 * 同步内置默认 PNG 到 src/bundled-assets/（无 manifest，元数据见 pack-manifests/bundled-character-packs.json）
 * Run: pnpm sync:bundled-assets
 */
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const devRoot = join(root, '.dev-assets')
const bundledRoot = join(root, 'src/bundled-assets')

const DEFAULT_CHARACTER_SRC = join(devRoot, 'character-packs/default')
const CUSTOM_MODE_SRC = join(devRoot, 'game-mode-packs/custom')
const DEFAULT_CHARACTER_DEST = join(bundledRoot, 'character-packs/default')
const CUSTOM_MODE_DEST = join(bundledRoot, 'game-mode-packs/custom')

function copyTree(src, dest) {
  if (!existsSync(src)) {
    throw new Error(`源目录不存在: ${src}`)
  }
  if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
  mkdirSync(dirname(dest), { recursive: true })
  cpSync(src, dest, { recursive: true, force: true })
}

function readDefaultCharacterEntry() {
  const devManifestPath = join(devRoot, 'character-packs/manifest.json')
  if (!existsSync(devManifestPath)) {
    throw new Error('缺少 .dev-assets/character-packs/manifest.json')
  }
  const devManifest = JSON.parse(readFileSync(devManifestPath, 'utf8'))
  const entry = devManifest.characters?.find((item) => item.id === 'default')
  if (!entry) throw new Error('.dev-assets manifest 中未找到 default 角色')
  return entry
}

copyTree(DEFAULT_CHARACTER_SRC, DEFAULT_CHARACTER_DEST)
copyTree(CUSTOM_MODE_SRC, CUSTOM_MODE_DEST)

for (const entry of readdirSync(join(bundledRoot, 'game-mode-packs'), { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== 'custom') {
    rmSync(join(bundledRoot, 'game-mode-packs', entry.name), { recursive: true, force: true })
  }
}

const defaultCharacter = readDefaultCharacterEntry()
const characterCatalog = {
  version: 'bundled-minimal-1',
  packageId: 'character-packs',
  generatedAt: new Date().toISOString(),
  usage: '内置 default 占位素材包（仅 PNG；完整 16 角色图见远程素材包）',
  characters: [defaultCharacter],
}

const rendererManifestPath = join(root, 'src/renderer/src/data/pack-manifests/bundled-character-packs.json')
writeFileSync(rendererManifestPath, `${JSON.stringify(characterCatalog, null, 2)}\n`, 'utf8')

console.log('[sync-bundled-default-assets] synced PNG -> src/bundled-assets/ (no manifest in tree)')
