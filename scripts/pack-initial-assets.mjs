/**
 * 将 .dev-assets/ 全部内容（图片包 + 初始化数据包）打成 initial 素材 zip。
 * 打包前会先 sync 初始化 JSON 到 .dev-assets/character-data-packs 等目录。
 *
 * Run: pnpm pack:assets
 */
import archiver from 'archiver'
import extractZip from 'extract-zip'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLED_MANIFEST_PATH } from './lib/bundled-manifest-path.mjs'

const ASSET_PACK_CONTENT_ROOTS = [
  'character-packs',
  'game-mode-packs',
  'character-data-packs',
  'game-mode-data-packs',
]

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const devAssetsDir = join(root, '.dev-assets')
const zipOutDir = join(root, '.tmp/asset-pack')

const version =
  process.env.ARENA_ASSET_PACK_VERSION ||
  JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version ||
  '1.0.0'
const fileName = `arena-initial-assets-${version}.zip`
const zipPath = join(zipOutDir, fileName)
const releaseConfig = JSON.parse(
  readFileSync(join(root, 'src/shared/app-release-config.json'), 'utf8')
)
const baseUrl = (
  process.env.ARENA_ASSETS_BASE_URL ||
  String(releaseConfig.initialAssetPackDownloadUrl || '').trim() ||
  ''
).replace(/\/+$/, '')

mkdirSync(zipOutDir, { recursive: true })

if (!existsSync(devAssetsDir)) {
  throw new Error('缺少 .dev-assets/，请先执行 pnpm init:dev-assets')
}

console.log('[pack-initial-assets] syncing init-data -> .dev-assets/...')
const syncRes = spawnSync(process.execPath, [join(root, 'scripts/sync-init-data-packs.mjs')], {
  stdio: 'inherit',
})
if (syncRes.status !== 0) {
  throw new Error('sync-init-data-packs 失败，无法打包')
}

function sha256File(path) {
  const hash = createHash('sha256')
  hash.update(readFileSync(path))
  return hash.digest('hex')
}

function addDirectoryToArchive(archive, dir, archivePrefix = '') {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const absPath = join(dir, entry.name)
    const archivePath = archivePrefix ? `${archivePrefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      addDirectoryToArchive(archive, absPath, archivePath)
      continue
    }
    if (!entry.isFile()) continue
    archive.file(absPath, { name: archivePath })
  }
}

function getPackSourceDirs(baseDir) {
  return ASSET_PACK_CONTENT_ROOTS.map((name) => join(baseDir, name)).filter((dir) => existsSync(dir))
}

async function createZip() {
  const packDirs = getPackSourceDirs(devAssetsDir)
  const missing = ASSET_PACK_CONTENT_ROOTS.filter((name) => !existsSync(join(devAssetsDir, name)))
  if (missing.length) {
    throw new Error(
      `.dev-assets/ 缺少目录：${missing.join('、')}。请先 pnpm init:dev-assets && pnpm sync:init-data`
    )
  }

  await new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath)
    const archive = archiver('zip', { zlib: { level: 9 } })
    output.on('close', resolve)
    archive.on('error', reject)
    archive.pipe(output)
    for (const packDir of packDirs) {
      addDirectoryToArchive(archive, packDir, basename(packDir))
    }
    void archive.finalize()
  })
}

await createZip()

const sizeBytes = statSync(zipPath).size
const sha256 = sha256File(zipPath)
const manifest = {
  packId: 'initial',
  version,
  fileName,
  downloadUrl: baseUrl ? `${baseUrl}/assets/${fileName}` : '',
  sha256,
  sizeBytes,
  generatedAt: new Date().toISOString(),
  contentRoots: ASSET_PACK_CONTENT_ROOTS,
}

const manifestPath = BUNDLED_MANIFEST_PATH
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

const verifyDir = join(zipOutDir, '.verify')
if (existsSync(verifyDir)) rmSync(verifyDir, { recursive: true, force: true })
mkdirSync(verifyDir, { recursive: true })
await extractZip(zipPath, { dir: verifyDir })

const marker = join(verifyDir, 'character-packs/manifest.json')
const gameMarker = join(verifyDir, 'game-mode-packs/manifest.json')
const charDataDir = join(verifyDir, 'character-data-packs')
if (!existsSync(marker)) {
  rmSync(verifyDir, { recursive: true, force: true })
  throw new Error('素材包结构无效，缺少 character-packs/manifest.json')
}
if (!existsSync(gameMarker)) {
  rmSync(verifyDir, { recursive: true, force: true })
  throw new Error('素材包结构无效，缺少 game-mode-packs/manifest.json')
}
const charDataCount = existsSync(charDataDir)
  ? readdirSync(charDataDir).filter((f) => f.endsWith('.json')).length
  : 0
if (!charDataCount) {
  rmSync(verifyDir, { recursive: true, force: true })
  throw new Error('素材包缺少 character-data-packs/*.json，请执行 pnpm sync:init-data')
}

rmSync(verifyDir, { recursive: true, force: true })

console.log(`[pack-initial-assets] zip: ${zipPath}`)
console.log(`[pack-initial-assets] size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`)
console.log(`[pack-initial-assets] sha256: ${sha256}`)
console.log(`[pack-initial-assets] character-data-packs: ${charDataCount} files`)
console.log(`[pack-initial-assets] manifest: ${manifestPath}`)
console.log(`[pack-initial-assets] downloadUrl: ${manifest.downloadUrl}`)
console.log('[pack-initial-assets] verify: ok')
