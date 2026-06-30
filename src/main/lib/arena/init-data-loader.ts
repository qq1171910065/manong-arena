import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { STARTER_GAME_MODE_IDS } from '@shared/arena/starter-game-modes'
import { STARTER_SEED_CHARACTERS } from '@shared/init-data/starter-seed-characters'
import type { StarterSeedCharacter } from '@shared/init-data/types'
import { getInstalledAssetsDir } from '../asset-pack/paths'
import { getProjectRoots } from '../asset-pack/project-roots'

const CHARACTER_DATA_DIR = 'character-data-packs'
const GAME_MODE_DATA_DIR = 'game-mode-data-packs'
const GAME_MODE_DATA_FILE = 'installed.json'

function readCharacterDataFromDir(dir: string): StarterSeedCharacter[] | null {
  if (!existsSync(dir)) return null
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b))
  if (!files.length) return null

  const characters: StarterSeedCharacter[] = []
  for (const fileName of files) {
    try {
      const parsed = JSON.parse(readFileSync(join(dir, fileName), 'utf8')) as StarterSeedCharacter
      if (parsed?.seedKey) characters.push(parsed)
    } catch {
      /* skip invalid */
    }
  }
  return characters.length ? characters : null
}

function readGameModeIdsFromDir(dir: string): string[] | null {
  const filePath = join(dir, GAME_MODE_DATA_FILE)
  if (!existsSync(filePath)) return null
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { gameModeIds?: string[] }
    if (Array.isArray(parsed.gameModeIds) && parsed.gameModeIds.length) {
      return parsed.gameModeIds.map(String)
    }
  } catch {
    /* ignore */
  }
  return null
}

function findBundledInitDataRoot(): string | null {
  for (const root of getProjectRoots()) {
    const dir = join(root, 'src/shared/init-data')
    if (existsSync(join(dir, CHARACTER_DATA_DIR))) return dir
  }
  return null
}

/** 优先从已安装素材包读取，与 zip / .dev-assets 内容一致 */
export function loadStarterCharacterData(appId: string): StarterSeedCharacter[] {
  const installedDir = join(getInstalledAssetsDir(appId), CHARACTER_DATA_DIR)
  const fromInstalled = readCharacterDataFromDir(installedDir)
  if (fromInstalled) return fromInstalled

  const bundledRoot = findBundledInitDataRoot()
  if (bundledRoot) {
    const fromBundled = readCharacterDataFromDir(join(bundledRoot, CHARACTER_DATA_DIR))
    if (fromBundled) return fromBundled
  }

  return STARTER_SEED_CHARACTERS
}

export function loadStarterGameModeIds(appId: string): string[] {
  const installedDir = join(getInstalledAssetsDir(appId), GAME_MODE_DATA_DIR)
  const fromInstalled = readGameModeIdsFromDir(installedDir)
  if (fromInstalled) return fromInstalled

  const bundledRoot = findBundledInitDataRoot()
  if (bundledRoot) {
    const fromBundled = readGameModeIdsFromDir(join(bundledRoot, GAME_MODE_DATA_DIR))
    if (fromBundled) return fromBundled
  }

  return [...STARTER_GAME_MODE_IDS]
}
