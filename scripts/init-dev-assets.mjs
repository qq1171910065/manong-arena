/**
 * 初始化 `.dev-assets/` 开发素材工作区（仅 character-packs / game-mode-packs）
 */
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { cp } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveArenaAssetsDir, resolveAppId } from './lib/arena-user-data.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const devRoot = join(root, '.dev-assets')
const rendererAssets = join(root, 'src/renderer/src/assets')
const staticDirs = ['home', 'characters']
const packDirs = ['character-packs', 'game-mode-packs']

const appId = resolveAppId()
const userAssets = resolveArenaAssetsDir(appId)

const CHARACTER_VENDORS = [
  'default', 'doubao', 'gpt', 'claude', 'deepseek', 'kimi', 'gemini', 'qwen', 'mistral', 'llama', 'hunyuan', 'glm', 'minimax', 'ernie', 'spark', 'yi', 'grok',
]
const GAME_MODE_IDS = ['werewolf', 'avalon', 'undercover', 'custom']
const LEGACY_HOME_MODE_FILES = {
  werewolf: { modeCover: 'mode-werewolf.png', matchBanner: 'match-werewolf.png' },
  avalon: { modeCover: 'mode-avalon.png', matchBanner: 'match-avalon.png' },
  undercover: { modeCover: 'mode-undercover.png', matchBanner: 'match-undercover.png' },
  custom: { modeCover: 'mode-custom.png', matchBanner: 'mode-custom.png' },
}

function vendorReadme(vendor) {
  return `# ${vendor} — 成套角色素材\n\n- portrait.png — 竖版立绘\n- banner.png — 横版立绘\n- avatars/neutral.png — 头像\n- avatars/{expression}.png — 表情\n`
}

function gameModeReadme(modeId) {
  return `# ${modeId} — 成套玩法素材\n\n- mode-cover.png — 玩法封面\n- match-banner.png — 对局横幅\n`
}

function buildNodes() {
  const nodes = [
    {
      path: '',
      readme: `# Agent Arena 开发素材工作区\n\n仅管理可下载素材包。\n\n壳层静态图请维护 \`src/renderer/src/assets/home/\`、\`characters/\`。\n\n\`\`\`\ncharacter-packs/\ngame-mode-packs/\n\`\`\``,
    },
    {
      path: 'character-packs',
      readme: `# character-packs\n\n\`\`\`\n{characterId}/portrait.png, banner.png, avatars/\nmanifest.json\n\`\`\``,
    },
    {
      path: 'game-mode-packs',
      readme: `# game-mode-packs\n\n\`\`\`\n{imageKey}/mode-cover.png, match-banner.png\nmanifest.json\n\`\`\``,
    },
  ]

  for (const vendor of CHARACTER_VENDORS) {
    nodes.push({ path: `character-packs/${vendor}`, readme: vendorReadme(vendor) })
    nodes.push({ path: `character-packs/${vendor}/avatars`, readme: `# ${vendor} / avatars` })
  }
  for (const modeId of GAME_MODE_IDS) {
    nodes.push({ path: `game-mode-packs/${modeId}`, readme: gameModeReadme(modeId) })
  }
  return nodes
}

function migrateLegacyGameModeAssets(assetsRoot, staticHomeDir) {
  const packRoot = join(assetsRoot, 'game-mode-packs')
  mkdirSync(packRoot, { recursive: true })

  for (const modeId of GAME_MODE_IDS) {
    const modeDir = join(packRoot, modeId)
    mkdirSync(modeDir, { recursive: true })
    const legacy = LEGACY_HOME_MODE_FILES[modeId]
    for (const { dest, legacy: legacyName } of [
      { dest: 'mode-cover.png', legacy: legacy.modeCover },
      { dest: 'match-banner.png', legacy: legacy.matchBanner },
    ]) {
      const destPath = join(modeDir, dest)
      if (existsSync(destPath)) continue
      const legacyPath = join(staticHomeDir, legacyName)
      if (existsSync(legacyPath)) copyFileSync(legacyPath, destPath)
    }
  }

  const manifestPath = join(packRoot, 'manifest.json')
  if (!existsSync(manifestPath)) {
    const modes = GAME_MODE_IDS.map((id) => ({
      id,
      modeCover: `${id}/mode-cover.png`,
      matchBanner: `${id}/match-banner.png`,
    }))
    writeFileSync(manifestPath, `${JSON.stringify({ version: 1, packageId: 'game-mode-packs', modes }, null, 2)}\n`, 'utf8')
  }
}

function pruneStaticFromDev() {
  for (const name of staticDirs) {
    const abs = join(devRoot, name)
    if (existsSync(abs)) {
      rmSync(abs, { recursive: true, force: true })
      console.log(`[init-dev-assets] removed ${name}/ from .dev-assets (use src/renderer/src/assets/)`)
    }
  }
}

function hasPackContent(dir) {
  return (
    existsSync(join(dir, 'character-packs/manifest.json')) &&
    existsSync(join(dir, 'game-mode-packs/manifest.json'))
  )
}

mkdirSync(devRoot, { recursive: true })
pruneStaticFromDev()

if (!existsSync(join(devRoot, 'character-packs')) && hasPackContent(userAssets)) {
  console.log('[init-dev-assets] seed pack dirs from userData arena-assets...')
  for (const dirName of packDirs) {
    const src = join(userAssets, dirName)
    if (!existsSync(src)) continue
    await cp(src, join(devRoot, dirName), { recursive: true, force: true })
  }
}

const staticHome = join(rendererAssets, 'home')
migrateLegacyGameModeAssets(devRoot, staticHome)

for (const node of buildNodes()) {
  const dir = node.path ? join(devRoot, node.path) : devRoot
  mkdirSync(dir, { recursive: true })
  const readmePath = join(dir, 'README.md')
  if (!existsSync(readmePath)) writeFileSync(readmePath, `${node.readme.trim()}\n`, 'utf8')
}

console.log(`[init-dev-assets] ready: ${devRoot}`)
