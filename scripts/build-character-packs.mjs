/**
 * Build / normalize all character asset packs under assets/character-packs/.
 * Run: node scripts/build-character-packs.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const assetsRoot = join(root, 'src/renderer/src/assets')
const packsRoot = join(assetsRoot, 'character-packs')

const EXPRESSIONS = ['neutral', 'thinking', 'confident', 'happy', 'sad', 'angry']

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

const STANDARD_META = {
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
  glm: { name: '智谱 GLM', modelId: 'glm-4', accent: '#6b8cff', palette: 'blue-violet / cyan / silver' },
  minimax: { name: 'MiniMax', modelId: 'minimax', accent: '#ff8a6a', palette: 'coral pink / warm orange / cream' },
  ernie: { name: '文心 ERNIE', modelId: 'ernie-bot', accent: '#5e8dff', palette: 'deep blue / porcelain white / vermilion' },
  spark: { name: '讯飞星火', modelId: 'spark', accent: '#58b4ff', palette: 'electric blue / navy / red' },
  yi: { name: '零一 Yi', modelId: 'yi-large', accent: '#5f74ff', palette: 'slate / cyan / white' },
}

const VENDOR_SOURCE_PRIORITY = ['model-vendors-chibi-v1', 'model-vendors-v1']
const EXTENDED_FROM_VENDOR = ['glm', 'minimax', 'ernie', 'spark']
const EXTENDED_FROM_STANDARD = { yi: 'deepseek' }

function ensureDir(path) {
  if (!existsSync(path)) mkdirSync(path, { recursive: true })
}

function copyIfExists(from, to) {
  if (!existsSync(from)) return false
  ensureDir(dirname(to))
  copyFileSync(from, to)
  return true
}

function copyRequired(from, to, label) {
  if (!copyIfExists(from, to)) {
    console.warn(`[skip] ${label}: missing ${from}`)
    return false
  }
  return true
}

function ensureExpressionAvatars(charDir) {
  const avatarDir = join(charDir, 'avatars')
  ensureDir(avatarDir)
  const neutral = join(avatarDir, 'neutral.png')
  const key = charDir.split(/[/\\]/).pop()

  if (!existsSync(neutral)) {
    copyIfExists(join(assetsRoot, 'characters/avatars', `avatar-${key}.png`), neutral)
  }
  if (!existsSync(neutral)) return false

  for (const expression of EXPRESSIONS) {
    if (expression === 'neutral') continue
    const target = join(avatarDir, `${expression}.png`)
    if (!existsSync(target)) copyIfExists(neutral, target)
  }
  return true
}

function ensurePortraitAndBanner(charDir) {
  const portrait = join(charDir, 'portrait.png')
  const banner = join(charDir, 'banner.png')
  if (!existsSync(banner) && existsSync(portrait)) copyIfExists(portrait, banner)
  return existsSync(portrait)
}

function buildStandardCharacterEntry(key, charDir) {
  const meta = STANDARD_META[key]
  if (!ensureExpressionAvatars(charDir)) return null
  ensurePortraitAndBanner(charDir)
  return {
    id: key,
    name: meta.name,
    modelId: meta.modelId,
    accent: meta.accent,
    palette: meta.palette,
    portrait: `${key}/portrait.png`,
    banner: `${key}/banner.png`,
    avatars: Object.fromEntries(EXPRESSIONS.map((id) => [id, `${key}/avatars/${id}.png`])),
  }
}

function copyVendorCharacterIntoStandard(key) {
  const targetDir = join(packsRoot, 'standard-v1', key)
  ensureDir(targetDir)

  for (const packId of VENDOR_SOURCE_PRIORITY) {
    const sourceDir = join(packsRoot, packId, key)
    if (!existsSync(sourceDir)) continue

    copyIfExists(join(sourceDir, 'portrait.png'), join(targetDir, 'portrait.png'))
    copyIfExists(join(sourceDir, 'banner.png'), join(targetDir, 'banner.png'))

    const sourceAvatars = join(sourceDir, 'avatars')
    if (existsSync(sourceAvatars)) {
      for (const file of readdirSync(sourceAvatars)) {
        copyIfExists(join(sourceAvatars, file), join(targetDir, 'avatars', file))
      }
    }

    ensureExpressionAvatars(targetDir)
    ensurePortraitAndBanner(targetDir)
    console.log(`[standard-v1] ${key} <= ${packId}`)
    return true
  }
  return false
}

function copyFromAlias(key, alias) {
  const sourceDir = join(packsRoot, 'standard-v1', alias)
  const targetDir = join(packsRoot, 'standard-v1', key)
  ensureDir(join(targetDir, 'avatars'))
  copyIfExists(join(sourceDir, 'portrait.png'), join(targetDir, 'portrait.png'))
  copyIfExists(join(sourceDir, 'banner.png'), join(targetDir, 'banner.png'))
  for (const expression of EXPRESSIONS) {
    copyIfExists(join(sourceDir, 'avatars', `${expression}.png`), join(targetDir, 'avatars', `${expression}.png`))
  }
  ensureExpressionAvatars(targetDir)
  ensurePortraitAndBanner(targetDir)
  console.log(`[standard-v1] ${key} <= alias:${alias}`)
}

function buildStandardV1() {
  const packRoot = join(packsRoot, 'standard-v1')
  ensureDir(packRoot)
  const characters = []

  for (const key of STANDARD_KEYS) {
    const charDir = join(packRoot, key)
    ensureDir(charDir)

    copyRequired(
      join(assetsRoot, 'characters/avatars', `avatar-${key}.png`),
      join(charDir, 'avatars', 'neutral.png'),
      `standard-v1/${key}/avatar`
    )
    ensureExpressionAvatars(charDir)
    copyRequired(
      join(assetsRoot, 'home', `char-${key}.png`),
      join(charDir, 'portrait.png'),
      `standard-v1/${key}/portrait`
    )
    ensurePortraitAndBanner(charDir)

    const entry = buildStandardCharacterEntry(key, charDir)
    if (entry) characters.push(entry)
    console.log('[standard-v1]', key)
  }

  for (const key of EXTENDED_FROM_VENDOR) {
    if (!copyVendorCharacterIntoStandard(key)) {
      const alias = { glm: 'qwen', minimax: 'gemini', ernie: 'gpt', spark: 'kimi' }[key]
      copyFromAlias(key, alias)
    }
    const entry = buildStandardCharacterEntry(key, join(packRoot, key))
    if (entry) characters.push(entry)
  }

  for (const [key, alias] of Object.entries(EXTENDED_FROM_STANDARD)) {
    copyFromAlias(key, alias)
    const entry = buildStandardCharacterEntry(key, join(packRoot, key))
    if (entry) characters.push(entry)
  }

  writeFileSync(
    join(packRoot, 'manifest.json'),
    JSON.stringify(
      {
        version: 1,
        packageId: 'standard-v1',
        generatedAt: new Date().toISOString(),
        styleGuide: {
          avatar: '256×256 square PNG',
          portrait: '9:16 vertical PNG',
          banner: '16:9 horizontal PNG',
          emotions: EXPRESSIONS,
        },
        characters,
      },
      null,
      2
    ) + '\n',
    'utf8'
  )
}

function normalizeExistingPack(packId, options = {}) {
  const { styleLabel = '', hasBanner = false } = options
  const packRoot = join(packsRoot, packId)
  if (!existsSync(packRoot)) return

  const characters = []
  for (const entry of readdirSync(packRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const key = entry.name
    const charDir = join(packRoot, key)
    if (!ensureExpressionAvatars(charDir)) continue

    if (hasBanner) ensurePortraitAndBanner(charDir)
    else {
      const portrait = join(charDir, 'portrait.png')
      const banner = join(charDir, 'banner.png')
      if (!existsSync(portrait)) continue
      if (!existsSync(banner)) copyIfExists(portrait, banner)
    }

    const meta = STANDARD_META[key] || { name: key, modelId: key, accent: '#6366f1', palette: styleLabel }
    characters.push({
      id: key,
      name: meta.name,
      modelId: meta.modelId,
      accent: meta.accent,
      palette: meta.palette || styleLabel,
      style: styleLabel || undefined,
      portrait: `${key}/portrait.png`,
      banner: `${key}/banner.png`,
      avatars: Object.fromEntries(EXPRESSIONS.map((id) => [id, `${key}/avatars/${id}.png`])),
    })
    console.log(`[${packId}]`, key)
  }

  writeFileSync(
    join(packRoot, 'manifest.json'),
    JSON.stringify({ version: 1, packageId: packId, generatedAt: new Date().toISOString(), characters }, null, 2) + '\n',
    'utf8'
  )
}

buildStandardV1()
normalizeExistingPack('model-vendors-v1', { styleLabel: '厂商写实风' })
normalizeExistingPack('model-vendors-chibi-v1', { styleLabel: 'Q版', hasBanner: true })

console.log('All character packs built under', packsRoot)
