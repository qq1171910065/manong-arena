import { buildArenaAssetUrl } from '@shared/arena/asset-url'

import charGemini from '@renderer/assets/home/char-gemini.png'
import developerWechatQr from '@renderer/assets/home/developer-wechat-qr.png'
import judgeAvatar from '@renderer/assets/home/judge-avatar.png'
import mascotCat from '@renderer/assets/home/mascot-cat-v2.png'
import sleepyCat from '@renderer/assets/home/sleepy-cat-cutout.png'
import { loginBundledAssets } from '@renderer/data/login-bundled-assets'

/** 首页 / 壳层 UI 素材：Vite 打进安装包，不依赖首次素材下载 */
export const arenaHomeAssets = {
  bgClean: loginBundledAssets.bgClean,
  brandLockup: loginBundledAssets.brandLockup,
  charGemini,
  mascotCat,
  sleepyCat,
  judgeAvatar,
  developerWechatQr,
} as const

export function packAssetUrl(relativePath: string): string {
  return buildArenaAssetUrl(`character-packs/${relativePath}`)
}
