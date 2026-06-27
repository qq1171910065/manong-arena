/**
 * 将 .tmp/asset-pack/ 中的 zip 复制到 Electron userData 安装目录，供本地 dev 测试（无需上传到 CDN）。
 *
 * 用法:
 *   pnpm pack:assets && pnpm install:asset-pack-local
 *
 * 环境变量:
 *   ARENA_APP_ID        默认 com.agentarena
 *   ARENA_USER_DATA_DIR 覆盖 userData 根目录（默认 %APPDATA%/arena 或 ~/.config/arena）
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUNDLED_MANIFEST_PATH } from './lib/bundled-manifest-path.mjs'
import { resolveAssetPackCacheDir, resolveAppId } from './lib/arena-user-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const manifestPath = BUNDLED_MANIFEST_PATH

if (!existsSync(manifestPath)) {
  console.error('[install-asset-pack-local] 内置 manifest 不存在，请先执行 pnpm pack:assets')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const zipSrc = join(root, '.tmp/asset-pack', manifest.fileName)

if (!existsSync(zipSrc)) {
  console.error(`[install-asset-pack-local] zip 不存在: ${zipSrc}`)
  console.error('[install-asset-pack-local] 请先执行 pnpm pack:assets')
  process.exit(1)
}

const appId = resolveAppId()
const cacheDir = resolveAssetPackCacheDir(appId)
const zipDest = join(cacheDir, manifest.fileName)

mkdirSync(cacheDir, { recursive: true })
copyFileSync(zipSrc, zipDest)

console.log(`[install-asset-pack-local] copied -> ${zipDest}`)
console.log('[install-asset-pack-local] 启动 pnpm dev 后，应用会从安装目录读取 zip 并解压到 userData')
