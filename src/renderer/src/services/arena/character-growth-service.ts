import { randomUUID } from '@renderer/utils/id'
import {
  attributeDeltaText,
  computeCharacterAttributes,
  createDefaultGrowthState,
  estimateMatchBonusExp,
  expFromCompletionTokens,
  growthStateFromTotalExp,
  resolveCharacterGrowth,
  resolveCompletionTokens,
  retroactiveTotalExp,
} from '@shared/arena/character-growth'
import type { TokenUsageLike } from '@shared/arena/character-growth'
import { arenaInvoke, ensureArenaReady } from './client'
import { characterService } from './character-service'
import type { Character, CharacterGrowthSnapshot, Match } from '@shared/arena/types'

export async function listGrowthSnapshots(characterId: string): Promise<CharacterGrowthSnapshot[]> {
  await ensureArenaReady()
  return arenaInvoke('storage', 'listCharacterGrowthSnapshots', () =>
    window.api.listCharacterGrowthSnapshots(characterId)
  )
}

async function appendGrowthSnapshot(snapshot: CharacterGrowthSnapshot): Promise<void> {
  await ensureArenaReady()
  await arenaInvoke('storage', 'appendCharacterGrowthSnapshot', () =>
    window.api.appendCharacterGrowthSnapshot(snapshot)
  )
}

function participantWon(match: Match, characterId: string): boolean {
  if (!match.winnerCamp) return false
  const participant = match.participants.find((item) => item.characterId === characterId)
  if (!participant?.roleCamp) return false
  return participant.roleCamp === match.winnerCamp
}

async function awardExp(
  character: Character,
  expGain: number,
  options: {
    source: CharacterGrowthSnapshot['source']
    summary: string
    matchId?: string
    levelDeltaHint?: number
    completionTokens?: number
  }
): Promise<Character> {
  const beforeGrowth = resolveCharacterGrowth(character)
  const beforeAttrs = computeCharacterAttributes(character)
  const totalExp = beforeGrowth.totalExp + expGain
  const nextGrowth = growthStateFromTotalExp(totalExp)
  character.growth = nextGrowth

  const saved = await characterService.save(character)
  const afterAttrs = computeCharacterAttributes(saved)
  const levelDelta = nextGrowth.level - beforeGrowth.level
  const summaryParts = [options.summary, `+${expGain} EXP`]
  if (options.completionTokens) summaryParts.push(`${options.completionTokens} output tokens`)
  if (levelDelta > 0) summaryParts.push(`升至 Lv.${nextGrowth.level}`)
  const attrText = attributeDeltaText(beforeAttrs, afterAttrs)
  if (attrText) summaryParts.push(attrText)

  await appendGrowthSnapshot({
    id: randomUUID(),
    characterId: character.id,
    createdAt: new Date().toISOString(),
    source: options.source,
    matchId: options.matchId,
    summary: summaryParts.join(' · '),
    level: nextGrowth.level,
    exp: nextGrowth.exp,
    attributes: afterAttrs,
    expDelta: expGain,
    levelDelta: levelDelta || options.levelDeltaHint || undefined,
  })

  return saved
}

export async function awardFromModelOutput(
  characterId: string,
  usage: TokenUsageLike | undefined,
  contentFallback: string,
  options: {
    source: CharacterGrowthSnapshot['source']
    summary: string
    matchId?: string
  }
): Promise<Character | null> {
  if (!characterId || characterId.startsWith('system:')) return null
  const character = await characterService.get(characterId).catch(() => null)
  if (!character || character.status !== 'enabled') return null

  const completionTokens = resolveCompletionTokens(usage, contentFallback)
  const expGain = expFromCompletionTokens(completionTokens)
  if (expGain <= 0) return character

  return awardExp(character, expGain, {
    ...options,
    completionTokens,
  })
}

export async function applyMatchGrowth(match: Match): Promise<void> {
  if (match.status !== 'completed') return
  const mvpId = match.recap?.mvp?.characterId || null
  const now = match.endedAt || new Date().toISOString()

  for (const participant of match.participants) {
    const character = await characterService.get(participant.characterId).catch(() => null)
    if (!character) continue

    const snapshots = await listGrowthSnapshots(character.id)
    if (snapshots.some((item) => item.source === 'match' && item.matchId === match.id && item.summary.includes('对局奖励'))) {
      continue
    }

    const won = participantWon(match, character.id)
    const expGain = estimateMatchBonusExp({
      won,
      isMvp: mvpId === character.id,
    })

    if (won) character.stats.winCount += 1
    character.stats.lastMatchAt = now

    if (expGain <= 0) {
      await characterService.save(character)
      continue
    }

    const summaryParts = [`对局奖励 · 完成「${match.gameModeName}」`]
    if (won) summaryParts.push('阵营获胜')
    if (mvpId === character.id) summaryParts.push('本局 MVP')

    await awardExp(character, expGain, {
      source: 'match',
      matchId: match.id,
      summary: summaryParts.join(' · '),
    })
  }
}

export async function applyChatGrowthExp(
  character: Character,
  usage: TokenUsageLike | undefined,
  contentFallback: string,
  summary: string
): Promise<Character> {
  const completionTokens = resolveCompletionTokens(usage, contentFallback)
  const expGain = expFromCompletionTokens(completionTokens)
  return awardExp(character, expGain, {
    source: 'chat',
    summary: summary || '私聊成长',
    completionTokens,
  })
}

export async function ensureCharacterGrowthInitialized(character: Character): Promise<Character> {
  let current = character
  const snapshots = await listGrowthSnapshots(character.id)

  if (!current.growth) {
    const totalExp = retroactiveTotalExp(current)
    current = {
      ...current,
      growth: totalExp > 0 ? growthStateFromTotalExp(totalExp) : createDefaultGrowthState(),
    }
    current = await characterService.save(current)
  }

  if (!snapshots.length) {
    const attrs = computeCharacterAttributes(current)
    const growth = resolveCharacterGrowth(current)
    const isMigration = growth.totalExp > 0
    await appendGrowthSnapshot({
      id: randomUUID(),
      characterId: current.id,
      createdAt: current.updatedAt || new Date().toISOString(),
      source: isMigration ? 'migration' : 'initial',
      summary: isMigration
        ? `根据历史对局追溯 ${growth.totalExp} EXP，当前 Lv.${growth.level}`
        : '角色档案建立，成长体系已启用',
      level: growth.level,
      exp: growth.exp,
      attributes: attrs,
    })
  }

  return current
}

export const characterGrowthService = {
  listSnapshots: listGrowthSnapshots,
  applyMatchGrowth,
  applyChatGrowthExp,
  awardFromModelOutput,
  ensureInitialized: ensureCharacterGrowthInitialized,
  resolveGrowth: resolveCharacterGrowth,
  computeAttributes: computeCharacterAttributes,
}
