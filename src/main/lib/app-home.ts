import { app } from 'electron'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** 应用数据根目录下的标准子目录（相对 `{userData}/{appId}/`） */
export const APP_HOME_SUBDIRS = [
  'arena',
  'arena-assets',
  'arena-assets/characters',
  'arena-asset-pack',
  'storage',
] as const

const APP_HOME_README = `# Agent Arena 应用数据目录

本目录由应用在首次启动时自动创建，存放本机运行时数据。

## 子目录

- \`arena/\` — 角色、玩法、对局等业务 JSON
- \`arena-assets/\` — 运行时素材（初始包解压 + 角色自有素材）
  - \`character-packs/\`、\`game-mode-packs/\` — 初始素材包
  - \`characters/{角色ID}/\` — 角色自有素材
- \`arena-asset-pack/\` — 下载/缓存的 initial 素材 zip
- \`storage/\` — 通用键值存储

开发环境素材工作区为项目内 \`.dev-assets/\`，不与此目录混用。
`

/** `{userData}/{appId}/` — 单应用实例的本机数据根 */
export function getAppHomeDir(appId: string): string {
  return join(app.getPath('userData'), appId)
}

export function getArenaStoreDir(appId: string): string {
  return join(getAppHomeDir(appId), 'arena')
}

export function getAppStorageDir(appId: string): string {
  return join(getAppHomeDir(appId), 'storage')
}

export function getInstalledAssetsDir(appId: string): string {
  return join(getAppHomeDir(appId), 'arena-assets')
}

export function getAssetPackCacheDir(appId: string): string {
  return join(getAppHomeDir(appId), 'arena-asset-pack')
}

/** 启动时创建应用目录及标准子目录 */
export function ensureAppHomeDir(appId: string): string {
  const home = getAppHomeDir(appId)
  mkdirSync(home, { recursive: true })
  for (const sub of APP_HOME_SUBDIRS) {
    mkdirSync(join(home, sub), { recursive: true })
  }
  const readmePath = join(home, 'README.md')
  if (!existsSync(readmePath)) {
    writeFileSync(readmePath, APP_HOME_README, 'utf8')
  }
  return home
}

export function getAppHomePaths(appId: string): {
  userData: string
  appHome: string
  arenaStore: string
  arenaAssets: string
  assetPackCache: string
  storage: string
} {
  return {
    userData: app.getPath('userData'),
    appHome: getAppHomeDir(appId),
    arenaStore: getArenaStoreDir(appId),
    arenaAssets: getInstalledAssetsDir(appId),
    assetPackCache: getAssetPackCacheDir(appId),
    storage: getAppStorageDir(appId),
  }
}
