/**
 * 修复开发环境素材缓存：删除过期 zip，从 .dev-assets 同步到 userData。
 *
 * 用法: node scripts/repair-dev-asset-cache.mjs
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  resolveArenaAssetsDir,
  resolveAssetPackCacheDir,
  resolveAppId,
} from './lib/arena-user-data.mjs'
import { BUNDLED_MANIFEST_PATH } from './lib/bundled-manifest-path.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const devRoot = join(root, '.dev-assets')
const manifest = JSON.parse(readFileSync(BUNDLED_MANIFEST_PATH, 'utf8'))

const appId = resolveAppId()
const userAssets = resolveArenaAssetsDir(appId)
const userZipDir = resolveAssetPackCacheDir(appId)
const packDirs = ['character-packs', 'game-mode-packs']

function assertDevContent() {
  const marker = join(devRoot, 'character-packs/manifest.json')
  const gameMarker = join(devRoot, 'game-mode-packs/manifest.json')
  if (!existsSync(marker) || !existsSync(gameMarker)) {
    console.error('[repair-dev-asset-cache] .dev-assets 素材不完整，先执行: pnpm init:dev-assets')
    process.exit(1)
  }
}

async function main() {
  if (!existsSync(devRoot)) {
    console.log('[repair-dev-asset-cache] initializing .dev-assets...')
    const { spawnSync } = await import('node:child_process')
    spawnSync(process.execPath, ['scripts/init-dev-assets.mjs'], { cwd: root, stdio: 'inherit' })
  }

  assertDevContent()

  const zipPath = join(userZipDir, manifest.fileName)
  if (existsSync(zipPath)) {
    rmSync(zipPath, { force: true })
    console.log(`[repair-dev-asset-cache] removed stale zip: ${zipPath}`)
  }

  mkdirSync(userAssets, { recursive: true })
  for (const dirName of packDirs) {
    const src = join(devRoot, dirName)
    if (!existsSync(src)) continue
    await cp(src, join(userAssets, dirName), { recursive: true, force: true })
    console.log(`[repair-dev-asset-cache] synced -> ${join(userAssets, dirName)}`)
  }

  const installState = {
    packId: manifest.packId,
    version: manifest.version,
    installedAt: new Date().toISOString(),
  }
  writeFileSync(join(userAssets, 'installed.json'), `${JSON.stringify(installState, null, 2)}\n`, 'utf8')
  writeFileSync(join(devRoot, '.asset-pack-installed.json'), `${JSON.stringify(installState, null, 2)}\n`, 'utf8')

  console.log('[repair-dev-asset-cache] done — 可重启 pnpm dev')
}

await main()
