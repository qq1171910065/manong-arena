/**
 * 将内置角色/玩法初始化数据导出为 JSON 数据包
 * Run: node scripts/sync-init-data-packs.mjs
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

function loadStarterSeedCharacters() {
  const seedPath = join(root, 'src/main/lib/arena/seed.ts')
  const source = readFileSync(seedPath, 'utf8')
  const marker = 'const SEED_CHARACTERS = STARTER_SEED_CHARACTERS'
  if (source.includes(marker)) {
    return loadFromStarterSeedFile()
  }
  const legacyStart = source.indexOf('const SEED_CHARACTERS: SeedCharacter[] = [')
  if (legacyStart < 0) throw new Error('SEED_CHARACTERS block not found')
  const arrayStart = legacyStart + 'const SEED_CHARACTERS: SeedCharacter[] = '.length
  const arrayEnd = source.indexOf('\nconst LEGACY_SEED_MODEL_IDS', arrayStart)
  return new Function(`return ${source.slice(arrayStart, arrayEnd).trim()}`)()
}

function loadFromStarterSeedFile() {
  const seedPath = join(root, 'src/shared/init-data/starter-seed-characters.ts')
  const source = readFileSync(seedPath, 'utf8')
  const start = source.indexOf('export const STARTER_SEED_CHARACTERS')
  const marker = '= ['
  const markerIndex = source.indexOf(marker, start)
  if (markerIndex < 0) throw new Error('STARTER_SEED_CHARACTERS array not found')
  const arrayStart = markerIndex + marker.length - 1
  let depth = 0
  let arrayEnd = -1
  for (let i = arrayStart; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1
    if (source[i] === ']') {
      depth -= 1
      if (depth === 0) {
        arrayEnd = i
        break
      }
    }
  }
  if (arrayEnd < 0) throw new Error('STARTER_SEED_CHARACTERS array end not found')
  return new Function(`return ${source.slice(arrayStart, arrayEnd + 1)}`)()
}

const characters = loadStarterSeedCharacters()

const sharedCharDir = join(root, 'src/shared/init-data/character-data-packs')
const sharedModePath = join(root, 'src/shared/init-data/game-mode-data-packs/installed.json')
const devCharDir = join(root, '.dev-assets/character-data-packs')
const devModeDir = join(root, '.dev-assets/game-mode-data-packs')

mkdirSync(sharedCharDir, { recursive: true })

function writeCharacterPacks(targetDir) {
  mkdirSync(targetDir, { recursive: true })
  for (const entry of readdirSync(targetDir)) {
    if (entry.endsWith('.json')) rmSync(join(targetDir, entry))
  }
  for (const item of characters) {
    writeFileSync(join(targetDir, `${item.seedKey}.json`), `${JSON.stringify(item, null, 2)}\n`, 'utf8')
  }
}

writeCharacterPacks(sharedCharDir)
if (existsSync(join(root, '.dev-assets'))) {
  writeCharacterPacks(devCharDir)
}

const gameModeData = {
  version: 1,
  gameModeIds: [
    'werewolf',
    'roundtable',
    'brainstorm-game-design',
    'brainstorm-character-design',
    'undercover',
    'avalon',
  ],
  generatedAt: new Date().toISOString(),
}

mkdirSync(dirname(sharedModePath), { recursive: true })
writeFileSync(sharedModePath, `${JSON.stringify(gameModeData, null, 2)}\n`, 'utf8')
if (existsSync(join(root, '.dev-assets'))) {
  mkdirSync(devModeDir, { recursive: true })
  writeFileSync(join(devModeDir, 'installed.json'), `${JSON.stringify(gameModeData, null, 2)}\n`, 'utf8')
}

console.log(`[sync-init-data-packs] wrote ${characters.length} character data packs`)
