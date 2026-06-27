/** 开发环境本地素材工作区（`.dev-assets/`，gitignore）— 仅管理可下载素材包 */

import { CHARACTER_EXPRESSIONS, CHARACTER_IMAGE_SPECS } from './character-visuals'
import {
  BUILTIN_GAME_MODE_IMAGE_KEYS,
  BUILTIN_GAME_MODE_LABELS,
  GAME_MODE_IMAGE_SLOTS,
} from './game-mode-visuals'

export const DEV_ASSETS_DIR_NAME = '.dev-assets'

/** 随安装包 / Vite 静态引用，不在 `.dev-assets/` 素材管理中维护 */
export const RENDERER_STATIC_ASSET_DIRS = ['home', 'characters'] as const

/** 同步到 renderer 的素材包目录（不含 shell 静态资源）— 已废弃，仅保留常量供 IPC 命名兼容 */
export const DEV_ASSETS_SYNC_DIRS = ['character-packs', 'game-mode-packs'] as const

export const CHARACTER_PACK_VENDORS = [
  'default',
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

export interface DevAssetsDirNode {
  path: string
  readme: string
  children?: DevAssetsDirNode[]
}

function expressionListMarkdown(): string {
  return CHARACTER_EXPRESSIONS.map((item) => item.id).join(' / ')
}

function characterSetReadme(vendor: string): string {
  const portraitSpec = CHARACTER_IMAGE_SPECS['portrait-vertical']
  const bannerSpec = CHARACTER_IMAGE_SPECS['portrait-horizontal']
  const avatarSpec = CHARACTER_IMAGE_SPECS.avatar
  return `# ${vendor} — 成套角色素材

与角色编辑器四个槽位对应。

## 文件约定

- \`portrait.png\` — ${portraitSpec.label}（${portraitSpec.hint}）
- \`banner.png\` — ${bannerSpec.label}（${bannerSpec.hint}）
- \`avatars/neutral.png\` — 头像（${avatarSpec.hint}）
- \`avatars/{expression}.png\` — 表情（${CHARACTER_IMAGE_SPECS.expression.hint}）

## 表情 ID

${expressionListMarkdown()}
`
}

function characterPackChildren(): DevAssetsDirNode[] {
  return CHARACTER_PACK_VENDORS.map((vendor) => ({
    path: `character-packs/${vendor}`,
    readme: characterSetReadme(vendor),
    children: [
      {
        path: `character-packs/${vendor}/avatars`,
        readme: `# ${vendor} / avatars\n\n头像（neutral）与表情槽位。表情 ID：${expressionListMarkdown()}`,
      },
    ],
  }))
}

function gameModeSetChildren(): DevAssetsDirNode[] {
  return BUILTIN_GAME_MODE_IMAGE_KEYS.map((modeId) => ({
    path: `game-mode-packs/${modeId}`,
    readme: `# ${BUILTIN_GAME_MODE_LABELS[modeId]} — 成套玩法素材

与玩法 \`imageKey: ${modeId}\` 对应。

## 文件约定

${GAME_MODE_IMAGE_SLOTS.map((slot) => `- \`${slot.fileName}\` — ${slot.label}（${slot.hint}）`).join('\n')}
`,
  }))
}

export const DEV_ASSETS_TREE: DevAssetsDirNode[] = [
  {
    path: '',
    readme: `# Agent Arena 开发素材工作区

本目录 **不会提交到 Git**，仅管理 **可下载素材包**（角色 / 玩法）。

壳层与登录页静态图请直接维护 \`src/renderer/src/assets/home/\`、\`characters/\`（随安装包打包，不在此管理）。

## 顶层目录

\`\`\`
character-packs/      # 17 个角色目录 + manifest.json
game-mode-packs/      # 4 个玩法目录 + manifest.json
\`\`\`

## 工作流

1. 将 PNG 放入对应子目录（参考各目录 README）
2. 在应用底部点击 **素材管理** 预览与管理
3. **同步运行时** — 复制素材包到 userData 安装目录（供 arena-asset 协议加载）
4. **打包导出** — 打包为 initial 素材 zip
`,
  },
  {
    path: 'character-packs',
    readme: `# character-packs — 角色视觉包

打进 initial 素材 zip。目录下直接放置 17 个角色文件夹与 \`manifest.json\`。

| 槽位 | 文件 |
|------|------|
| 竖版立绘 | \`{characterId}/portrait.png\` |
| 横版立绘 | \`{characterId}/banner.png\` |
| 头像 | \`{characterId}/avatars/neutral.png\` |
| 表情 | \`{characterId}/avatars/{expression}.png\` |
`,
    children: characterPackChildren(),
  },
  {
    path: 'game-mode-packs',
    readme: `# game-mode-packs — 玩法视觉包

打进 initial 素材 zip。目录下直接放置 4 个玩法文件夹与 \`manifest.json\`。
`,
    children: gameModeSetChildren(),
  },
]

export function flattenDevAssetsDirs(nodes: DevAssetsDirNode[] = DEV_ASSETS_TREE): DevAssetsDirNode[] {
  const out: DevAssetsDirNode[] = []
  const walk = (list: DevAssetsDirNode[]) => {
    for (const node of list) {
      out.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(nodes)
  return out
}
