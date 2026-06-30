import {
  BUILTIN_ACHIEVEMENTS,
  BUILTIN_PERSONALITY_CATALOG,
  BUILTIN_SKILL_CATALOG,
  COLLECTION_CATEGORIES,
  isAchievementUnlocked,
  type CollectionAggregateStats,
  type CollectionCategoryId,
} from '@shared/arena/builtin-collection'
import { resolveCharacterGrowth } from '@shared/arena/character-growth'
import {
  ensureCharacterAssetPackCatalog,
  type CharacterAssetPackOption,
} from '@renderer/data/character-asset-catalog'
import { characterService } from './character-service'
import { characterChatService } from './character-chat-service'

export async function loadCollectionAggregateStats(): Promise<CollectionAggregateStats> {
  const characters = await characterService.list({ status: 'all' })
  const enabled = characters.filter((c) => c.status === 'enabled')
  let maxLevel = 0
  let totalMatches = 0
  let totalWins = 0
  for (const char of characters) {
    maxLevel = Math.max(maxLevel, resolveCharacterGrowth(char).level)
    totalMatches += char.stats.matchCount || 0
    totalWins += char.stats.winCount || 0
  }

  let totalChatMessages = 0
  await Promise.all(
    characters.slice(0, 24).map(async (char) => {
      const messages = await characterChatService.listMessages(char.id).catch(() => [])
      totalChatMessages += messages.length
    })
  )

  return {
    characterCount: enabled.length,
    maxLevel,
    totalMatches,
    totalWins,
    totalChatMessages,
  }
}

export async function loadAssetPackCatalog(): Promise<CharacterAssetPackOption[]> {
  return ensureCharacterAssetPackCatalog()
}

export function listCollectionCategories() {
  return COLLECTION_CATEGORIES
}

export function listAchievementCatalog(stats: CollectionAggregateStats) {
  return BUILTIN_ACHIEVEMENTS.map((item) => ({
    ...item,
    unlocked: isAchievementUnlocked(item.id, stats),
  }))
}

export function listSkillCatalog() {
  return BUILTIN_SKILL_CATALOG
}

export function listPersonalityCatalog() {
  return BUILTIN_PERSONALITY_CATALOG
}

export type CollectionCategoryIdExport = CollectionCategoryId
