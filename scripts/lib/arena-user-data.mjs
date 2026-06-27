import { homedir } from 'node:os'
import { join } from 'node:path'

export const DEFAULT_ARENA_APP_ID = 'com.agentarena'

/** 与 Electron `app.getPath('userData')` 对齐（package.json name = arena） */
export function resolveArenaUserDataRoot() {
  if (process.env.ARENA_USER_DATA_DIR) return process.env.ARENA_USER_DATA_DIR
  return process.platform === 'win32'
    ? join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'arena')
    : join(homedir(), '.config', 'arena')
}

export function resolveAppId() {
  return process.env.ARENA_APP_ID || DEFAULT_ARENA_APP_ID
}

export function resolveAppHome(appId = resolveAppId()) {
  return join(resolveArenaUserDataRoot(), appId)
}

export function resolveArenaAssetsDir(appId = resolveAppId()) {
  return join(resolveAppHome(appId), 'arena-assets')
}

export function resolveAssetPackCacheDir(appId = resolveAppId()) {
  return join(resolveAppHome(appId), 'arena-asset-pack')
}
