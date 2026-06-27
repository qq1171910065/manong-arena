/**
 * Consolidate legacy avatar / home portrait PNGs into character-packs/standard-v1.
 * Run: node scripts/build-standard-v1-pack.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const assetsRoot = join(root, 'src/renderer/src/assets')
const packRoot = join(assetsRoot, 'character-packs/standard-v1')

const STANDARD_KEYS = [
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
]

const PACK_META = {
  doubao: { name: '豆包', modelId: 'doubao', accent: '#8b6cff', palette: 'lavender / violet / soft pink' },
  gpt: { name: 'GPT', modelId: 'gpt-4o', accent: '#5e8dff', palette: 'teal / cyan / white' },
  claude: { name: 'Claude', modelId: 'claude-3-5-sonnet', accent: '#f2a35f', palette: 'amber / terracotta / cream' },
  deepseek: { name: 'DeepSeek', modelId: 'deepseek-chat', accent: '#5f74ff', palette: 'indigo / blue / silver' },
  kimi: { name: 'Kimi', modelId: 'kimi', accent: '#a873f6', palette: 'violet / lilac / moonlight' },
  gemini: { name: 'Gemini', modelId: 'gemini-pro', accent: '#ee73ad', palette: 'rose / magenta / pearl' },
  qwen: { name: '通义千问', modelId: 'qwen-max', accent: '#6b8cff', palette: 'azure / cobalt / white' },
  mistral: { name: 'Mistral', modelId: 'mistral-large', accent: '#ff7a59', palette: 'orange / coral / sand' },
  llama: { name: 'Llama', modelId: 'llama-3', accent: '#4fbf9a', palette: 'jade / mint / ivory' },
  hunyuan: { name: '混元', modelId: 'hunyuan', accent: '#58b4ff', palette: 'sky blue / navy / gold' },
}

const EXPRESSIONS = ['neutral', 'thinking', 'confident', 'happy', 'sad', 'angry']

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function copyRequired(from, to) {
  if (!existsSync(from)) {
    console.warn('[skip] missing source:', from)
    return false
  }
  ensureDir(dirname(to))
  copyFileSync(from, to)
  return true
}

const characters = []

for (const key of STANDARD_KEYS) {
  const meta = PACK_META[key]
  const charDir = join(packRoot, key)
  const avatarDir = join(charDir, 'avatars')
  ensureDir(avatarDir)

  const legacyAvatar = join(assetsRoot, 'characters/avatars', `avatar-${key}.png`)
  const legacyPortrait = join(packRoot, key, 'portrait.png')
  const neutralPath = join(avatarDir, 'neutral.png')

  copyRequired(legacyAvatar, neutralPath)
  for (const expression of EXPRESSIONS) {
    if (expression === 'neutral') continue
    copyRequired(neutralPath, join(avatarDir, `${expression}.png`))
  }

  copyRequired(legacyPortrait, join(charDir, 'portrait.png'))
  copyRequired(legacyPortrait, join(charDir, 'banner.png'))

  characters.push({
    id: key,
    name: meta.name,
    modelId: meta.modelId,
    accent: meta.accent,
    palette: meta.palette,
    portrait: `${key}/portrait.png`,
    banner: `${key}/banner.png`,
    avatars: Object.fromEntries(EXPRESSIONS.map((id) => [id, `${key}/avatars/${id}.png`])),
  })

  console.log('[ok]', key)
}

const manifest = {
  version: 1,
  packageId: 'standard-v1',
  generatedAt: new Date().toISOString(),
  usage: 'Default Agent Arena character asset pack. portrait = vertical立绘, banner = horizontal立绘, avatars = square头像与表情.',
  styleGuide: {
    avatar: '256×256 square PNG',
    portrait: '9:16 vertical PNG (recommended 720×1280)',
    banner: '16:9 horizontal PNG (recommended 1280×720)',
    emotions: EXPRESSIONS,
  },
  characters,
}

ensureDir(packRoot)
writeFileSync(join(packRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')

const readme = `# Standard Character Pack v1

Default reusable character assets for Agent Arena.

Each character folder contains:

- \`portrait.png\` — vertical full-body art (竖版立绘)
- \`banner.png\` — horizontal key art (横版立绘)
- \`avatars/neutral.png\` — default square avatar (头像)
- \`avatars/{thinking,confident,happy,sad,angry}.png\` — expression slots (表情占位，可替换)

Regenerate with \`node scripts/build-standard-v1-pack.mjs\`.
`

writeFileSync(join(packRoot, 'README.md'), readme, 'utf8')
console.log('Done ->', packRoot)
