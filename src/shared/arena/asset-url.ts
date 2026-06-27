/** 本地素材自定义协议（由主进程解析到 userData 或开发目录） */
export const ARENA_ASSET_SCHEME = 'arena-asset'

export function buildArenaAssetUrl(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `${ARENA_ASSET_SCHEME}://local/${encodeURI(normalized)}`
}

export function homeAssetUrl(fileName: string): string {
  return buildArenaAssetUrl(`home/${fileName}`)
}

export function charactersAssetUrl(relativePath: string): string {
  return buildArenaAssetUrl(`characters/${relativePath}`)
}

export function characterPackAssetUrl(relativePath: string): string {
  return buildArenaAssetUrl(`character-packs/${relativePath}`)
}

export function gameModePackAssetUrl(relativePath: string): string {
  return buildArenaAssetUrl(`game-mode-packs/${relativePath}`)
}
