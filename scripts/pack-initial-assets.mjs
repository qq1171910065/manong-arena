/**

 * 将 renderer 初始素材打包为 zip，并写入内置 manifest（随安装包版本发布）。

 * 素材 zip **包含** character-packs/ 与 game-mode-packs/；logo、背景、登录贴图等不打包。

 *

 * zip 输出到 .tmp/asset-pack/。素材源为 `.dev-assets/`（请先 pnpm init:dev-assets 或打开素材管理）。

 */

import archiver from 'archiver'

import extractZip from 'extract-zip'

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



const ASSET_PACK_CONTENT_ROOTS = ['character-packs', 'game-mode-packs']



const __dirname = dirname(fileURLToPath(import.meta.url))

const root = join(__dirname, '..')

const devAssetsDir = join(root, '.dev-assets')

const assetsDir = existsSync(join(devAssetsDir, 'character-packs'))
  ? devAssetsDir
  : existsSync(join(root, 'bundled-assets', 'character-packs'))
    ? join(root, 'bundled-assets')
    : devAssetsDir

const zipOutDir = join(root, '.tmp/asset-pack')

const version = process.env.ARENA_ASSET_PACK_VERSION || '1.0.0'

const fileName = `arena-initial-assets-${version}.zip`

const zipPath = join(zipOutDir, fileName)

const baseUrl = (
  process.env.ARENA_ASSETS_BASE_URL ||
  `https://github.com/czmanong/manong-arena/releases/download/v${process.env.npm_package_version || version}`
).replace(/\/+$/, '')



mkdirSync(zipOutDir, { recursive: true })



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

  return ASSET_PACK_CONTENT_ROOTS

    .map((name) => join(baseDir, name))

    .filter((dir) => existsSync(dir))

}



async function createZip() {

  const packDirs = getPackSourceDirs(assetsDir)

  if (!packDirs.length) {

    throw new Error(
      `缺少 ${ASSET_PACK_CONTENT_ROOTS.join(' 或 ')} 目录，请先执行 pnpm init:dev-assets 或在素材管理中拉取素材包`
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

  downloadUrl: `${baseUrl}/assets/${fileName}`,

  sha256,

  sizeBytes,

  generatedAt: new Date().toISOString(),

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

if (!existsSync(marker)) {

  rmSync(verifyDir, { recursive: true, force: true })

  throw new Error('素材包结构无效，缺少 character-packs/manifest.json')

}

if (!existsSync(gameMarker)) {

  rmSync(verifyDir, { recursive: true, force: true })

  throw new Error('素材包结构无效，缺少 game-mode-packs/manifest.json')

}

rmSync(verifyDir, { recursive: true, force: true })



console.log(`[pack-initial-assets] zip: ${zipPath}`)

console.log(`[pack-initial-assets] size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB`)

console.log(`[pack-initial-assets] sha256: ${sha256}`)

console.log(`[pack-initial-assets] manifest: ${manifestPath}`)

console.log(`[pack-initial-assets] downloadUrl: ${manifest.downloadUrl}`)

console.log('[pack-initial-assets] verify: ok')

console.log('[pack-initial-assets] 请将 zip 上传到 OSS/CDN；内置 manifest 会随 pnpm build 打进安装包')


