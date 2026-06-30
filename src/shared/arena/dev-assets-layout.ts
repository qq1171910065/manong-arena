/** 开发素材工作区目录约定（`.dev-assets/`，gitignore） */

export const DEV_ASSETS_DIR_NAME = '.dev-assets'

/** 16 个角色图片素材包（不含 default，default 在 src/bundled-assets） */
export const CHARACTER_IMAGE_PACK_VENDORS = [
  'doubao',
  'gpt',
  'claude',
  'deepseek',
  'kimi',
  'gemini',
  'qwen',
  'mistral',
  'llama',
  'hunyuan',
  'glm',
  'minimax',
  'ernie',
  'spark',
  'yi',
  'grok',
] as const

/** 运行时安装目录仍使用 character-packs / game-mode-packs（与 zip 结构一致） */
export const DEV_ASSETS_IMAGE_DIRS = ['character-packs', 'game-mode-packs'] as const

/** 初始化数据包（JSON，与图片分离） */
export const DEV_ASSETS_DATA_DIRS = ['character-data-packs', 'game-mode-data-packs'] as const

export const DEV_ASSETS_SYNC_DIRS = [...DEV_ASSETS_IMAGE_DIRS, ...DEV_ASSETS_DATA_DIRS] as const
