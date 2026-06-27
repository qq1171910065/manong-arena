import bgClean from '@renderer/assets/home/home-bg-clean.png'
import brandLockup from '@renderer/assets/home/brand-lockup-v2.png'
import avatarDoubao from '@renderer/assets/characters/avatars/avatar-doubao.png'
import avatarGpt from '@renderer/assets/characters/avatars/avatar-gpt.png'
import avatarClaude from '@renderer/assets/characters/avatars/avatar-claude.png'

/** 登录页与主窗口壳层必备素材：Vite 打进安装包，不依赖首次素材下载 */
export const loginBundledAssets = {  bgClean,
  brandLockup,
  avatars: {
    doubao: avatarDoubao,
    gpt: avatarGpt,
    claude: avatarClaude,
  },
} as const
