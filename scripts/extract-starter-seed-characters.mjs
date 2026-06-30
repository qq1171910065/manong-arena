/**
 * 从 seed.ts 提取 STARTER_SEED_CHARACTERS 到 src/shared/init-data/
 * Run: node scripts/extract-starter-seed-characters.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const seedPath = join(root, 'src/main/lib/arena/seed.ts')
const outDir = join(root, 'src/shared/init-data')
const outPath = join(outDir, 'starter-seed-characters.ts')

const source = readFileSync(seedPath, 'utf8')
const start = source.indexOf('const SEED_CHARACTERS: SeedCharacter[] = [')
const end = source.indexOf('\nconst LEGACY_SEED_MODEL_IDS', start)
if (start < 0 || end < 0) throw new Error('SEED_CHARACTERS block not found')

const arrayBody = source.slice(start + 'const SEED_CHARACTERS: SeedCharacter[] = '.length, end).trim()

mkdirSync(outDir, { recursive: true })
writeFileSync(
  outPath,
  `import type { StarterSeedCharacter } from './types'

/** 16 个内置角色初始化数据（与 character-image-packs 分离） */
export const STARTER_SEED_CHARACTERS: StarterSeedCharacter[] = ${arrayBody}

export const STARTER_SEED_CHARACTER_KEYS = STARTER_SEED_CHARACTERS.map((item) => item.seedKey)
`,
  'utf8'
)

console.log(`[extract-starter-seed-characters] wrote ${outPath}`)

// 同步 JSON 数据包
import { spawnSync } from 'node:child_process'
spawnSync(process.execPath, [join(root, 'scripts/sync-init-data-packs.mjs')], { stdio: 'inherit' })
