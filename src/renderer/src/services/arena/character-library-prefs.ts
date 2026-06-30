const STORAGE_KEY = 'arena-character-library-prefs'

export type CharacterLibraryCategory = 'all' | 'mine' | 'favorites' | 'recent'

export interface CharacterLibraryPrefs {
  favoriteIds: string[]
  recentIds: string[]
}

function readPrefs(): CharacterLibraryPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { favoriteIds: [], recentIds: [] }
    const parsed = JSON.parse(raw) as Partial<CharacterLibraryPrefs>
    return {
      favoriteIds: Array.isArray(parsed.favoriteIds) ? parsed.favoriteIds.filter(Boolean) : [],
      recentIds: Array.isArray(parsed.recentIds) ? parsed.recentIds.filter(Boolean) : [],
    }
  } catch {
    return { favoriteIds: [], recentIds: [] }
  }
}

function writePrefs(prefs: CharacterLibraryPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
}

export function getCharacterLibraryPrefs(): CharacterLibraryPrefs {
  return readPrefs()
}

export function isFavoriteCharacter(id: string): boolean {
  return readPrefs().favoriteIds.includes(id)
}

export function toggleFavoriteCharacter(id: string): boolean {
  const prefs = readPrefs()
  const set = new Set(prefs.favoriteIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  const favoriteIds = [...set]
  writePrefs({ ...prefs, favoriteIds })
  return favoriteIds.includes(id)
}

export function touchRecentCharacter(id: string): void {
  const prefs = readPrefs()
  const recentIds = [id, ...prefs.recentIds.filter((item) => item !== id)].slice(0, 24)
  writePrefs({ ...prefs, recentIds })
}
