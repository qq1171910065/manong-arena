/** 登录页与主窗口壳层必备素材：保留在安装包内，不打进首次下载的素材 zip */
export const LOGIN_BUNDLED_RELATIVE_PATHS = [
  'home/home-bg-clean.png',
  'home/brand-lockup-v2.png',  'characters/avatars/avatar-doubao.png',
  'characters/avatars/avatar-gpt.png',
  'characters/avatars/avatar-claude.png',
] as const

export type LoginBundledRelativePath = (typeof LOGIN_BUNDLED_RELATIVE_PATHS)[number]
