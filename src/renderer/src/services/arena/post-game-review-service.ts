import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion } from '../gateway-api'
import { gameScenarioService } from './game-scenario-service'
import { resolvePromptFromPack } from './prompt-resolver'
import { characterService } from './character-service'
import { characterGrowthService } from './character-growth-service'
import { recordPostMatchSkillLearning } from './character-learning-service'
import { settingsService } from './settings-service'
import { arenaInvoke, ensureArenaReady } from './client'
import { arenaLog } from './logger'
import type { BehaviorChangeRecord, Character, Match } from '@shared/arena/types'
import type { PromptRenderContext } from '@shared/arena/game-scenario'

function parseJsonLike(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try {
    return JSON.parse(text) as Record<string, unknown>
  } catch {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0]) as Record<string, unknown>
    } catch {
      return null
    }
  }
}

function buildReviewContext(match: Match, character: Character): PromptRenderContext {
  const participant = match.participants.find((p) => p.characterId === character.id)
  const speeches = match.messages.filter((m) => m.kind === 'speech' && m.confirmed)
  const mySpeeches = speeches.filter((m) => m.participantId === character.id)
  const recentOthers = speeches.filter((m) => m.participantId !== character.id).slice(-12)

  const participantLines = match.participants.map((p) => {
    const alive = p.alive === 'alive' ? '存活' : '出局'
    const role = p.roleName ? `，${p.roleName}` : ''
    return `${p.seatOrder}号 ${p.characterName}（${alive}${role}）`
  })

  let outcomeForSelf = '对局已结束'
  let myRoleContext = '参与者'
  if (participant) {
    if (participant.roleName) {
      const campLabel =
        participant.roleCamp === 'wolf' ? '狼人阵营' : participant.roleCamp === 'good' ? '好人阵营' : participant.roleCamp || '未知阵营'
      myRoleContext = `${participant.roleName}（${campLabel}）`
    }
    const alive = participant.alive === 'alive' ? '存活' : '出局'
    if (match.winnerCamp && participant.roleCamp) {
      const won = match.winnerCamp === participant.roleCamp
      outcomeForSelf = won
        ? `你的阵营获胜，你${alive}。胜局也要反思决策中险些失误之处。`
        : `你的阵营落败，你${alive}。请认真总结失败教训，不要写成对局日记。`
    } else if (match.gameModeId === 'roundtable' || match.runtime.roundtableState) {
      outcomeForSelf = `圆桌讨论结束，共 ${match.runtime.currentRound || '?'} 轮。反思你的论证策略与表达是否达到预期。`
    } else {
      outcomeForSelf = `对局结束，你${alive}。`
    }
  }

  const matchSummary = [
    `对局：${match.title}`,
    `玩法：${match.gameModeName}`,
    `公开结果：${match.resultSummary || '已结束'}`,
    '',
    '参与者概况：',
    ...participantLines,
    '',
    '你的发言（节选）：',
    ...(mySpeeches.length
      ? mySpeeches.slice(-8).map((m) => `第${m.round}轮：${m.content}`)
      : ['（本局公开发言较少）']),
    '',
    '他人近期发言（节选）：',
    ...(recentOthers.length
      ? recentOthers.map(
          (m) =>
            `${m.participantName}：${m.content.slice(0, 160)}${m.content.length > 160 ? '…' : ''}`
        )
      : ['（无）']),
  ].join('\n')

  return {
    characterName: character.name,
    characterBio: character.bio,
    gameModeName: match.gameModeName,
    behaviorPrinciples: character.behaviorPrinciples,
    matchSummary,
    myRoleContext,
    outcomeForSelf,
    discussionTopic: match.runtime.roundtableState?.discussionTopic || '',
  }
}

function formatPostMatchUnderstanding(parsed: Record<string, unknown>): string {
  const parts: string[] = []
  const outcome = String(parsed.outcomeReflection || '').trim()
  if (outcome) parts.push(`【得失】${outcome}`)
  const strategy = String(parsed.strategyReflection || '').trim()
  if (strategy) parts.push(`【策略反思】${strategy}`)

  const peers = Array.isArray(parsed.peerObservations) ? parsed.peerObservations : []
  for (const item of peers) {
    if (typeof item !== 'object' || item === null) continue
    const peer = item as Record<string, unknown>
    const name = String(peer.name || '').trim()
    const impression = String(peer.impression || '').trim()
    const trust = String(peer.trustLevel || '').trim()
    if (name && impression) {
      parts.push(`【${name}】${impression}${trust ? `（信任${trust}）` : ''}`)
    }
  }

  const lessons = Array.isArray(parsed.lessonsFromFailure) ? parsed.lessonsFromFailure.map(String).filter(Boolean) : []
  if (lessons.length) parts.push(`【失败教训】${lessons.join('；')}`)

  const next = Array.isArray(parsed.nextTimeAdjustments) ? parsed.nextTimeAdjustments.map(String).filter(Boolean) : []
  if (next.length) parts.push(`【下局调整】${next.join('；')}`)

  const highlights = Array.isArray(parsed.highlights) ? parsed.highlights.map(String).filter(Boolean) : []
  const improvements = Array.isArray(parsed.improvements) ? parsed.improvements.map(String).filter(Boolean) : []
  if (highlights.length) parts.push(`【做对的】${highlights.join('；')}`)
  if (improvements.length) parts.push(`【待改进】${improvements.join('；')}`)

  return parts.join('\n')
}

async function appendBehaviorChange(record: BehaviorChangeRecord): Promise<void> {
  await ensureArenaReady()
  await arenaInvoke('storage', 'appendBehaviorChange', () => window.api.appendBehaviorChange(record))
}

export const postGameReviewService = {
  async listBehaviorChanges(characterId: string): Promise<BehaviorChangeRecord[]> {
    await ensureArenaReady()
    const all = await arenaInvoke('storage', 'listBehaviorChanges', () => window.api.listBehaviorChanges())
    return all.filter((r) => r.characterId === characterId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async reviewMatchForCharacter(match: Match, characterId: string): Promise<{ summary: string; change?: BehaviorChangeRecord } | null> {
    const settings = await settingsService.get()
    if (!settings.characterEvolution?.postGameReviewEnabled) return null

    const character = await characterService.get(characterId)
    const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
    if (!scenario) return null

    const packId = match.runtime.promptPackId || scenario.defaultPromptPackId
    const pack = gameScenarioService.getPromptPack(packId)
    if (!pack) return null

    const context = buildReviewContext(match, character)
    const matchSummary = String(context.matchSummary || '')

    const reviewPrompt = resolvePromptFromPack(pack, 'post_game_review', context)
    if (!reviewPrompt) return null

    const reviewRes = await gatewayChatCompletion(character.modelId, [
      { role: 'system', content: reviewPrompt.system },
      { role: 'user', content: reviewPrompt.user || '请以第一人称完成赛后复盘，重点在反思与认知沉淀，不要写对局流水账。' },
    ])

    const reviewParsed = parseJsonLike(reviewRes.content || '') || {}
    const summary = String(reviewParsed.summary || reviewRes.content || '').trim()
    const reviewUnderstanding = formatPostMatchUnderstanding(reviewParsed)
    const legacyHighlights = Array.isArray(reviewParsed.highlights) ? reviewParsed.highlights.map(String).filter(Boolean) : []
    const legacyImprovements = Array.isArray(reviewParsed.improvements) ? reviewParsed.improvements.map(String).filter(Boolean) : []
    const skillInsight =
      reviewUnderstanding ||
      [...legacyHighlights, ...legacyImprovements].join('；') ||
      undefined

    recordPostMatchSkillLearning(character, scenario.id, scenario.name, match.id, summary, skillInsight)
    await characterService.save(character)
    await characterGrowthService
      .awardFromModelOutput(character.id, reviewRes.usage, reviewRes.content, {
        source: 'review',
        summary: `赛后复盘「${match.gameModeName}」`,
        matchId: match.id,
      })
      .catch(() => undefined)

    const fullReviewForAdjust = [summary, reviewUnderstanding].filter(Boolean).join('\n\n')
    const adjustPrompt = resolvePromptFromPack(pack, 'behavior_adjust', {
      ...context,
      matchSummary: fullReviewForAdjust || matchSummary,
    })
    if (!adjustPrompt) return { summary }

    const adjustRes = await gatewayChatCompletion(character.modelId, [
      { role: 'system', content: adjustPrompt.system },
      { role: 'user', content: adjustPrompt.user || '请根据复盘中的策略反思与失败教训，提出行为准则微调建议。' },
    ])

    const adjustParsed = parseJsonLike(adjustRes.content || '') || {}
    const added = Array.isArray(adjustParsed.added) ? adjustParsed.added.map(String).filter(Boolean) : []
    const removed = Array.isArray(adjustParsed.removed) ? adjustParsed.removed.map(String).filter(Boolean) : []

    if (!added.length && !removed.length) return { summary }

    await characterGrowthService
      .awardFromModelOutput(character.id, adjustRes.usage, adjustRes.content, {
        source: 'review',
        summary: `行为准则调整「${match.gameModeName}」`,
        matchId: match.id,
      })
      .catch(() => undefined)

    const previous = [...character.behaviorPrinciples]
    const next = [...previous.filter((p) => !removed.includes(p)), ...added.filter((p) => !previous.includes(p))]

    const record: BehaviorChangeRecord = {
      id: randomUUID(),
      characterId: character.id,
      matchId: match.id,
      scenarioId: scenario.id,
      createdAt: new Date().toISOString(),
      summary: summary || String(adjustParsed.reason || '赛后复盘'),
      previousPrinciples: previous,
      newPrinciples: next,
      addedPrinciples: added,
      removedPrinciples: removed,
      trigger: 'post_game_review',
      reviewPromptId: reviewPrompt.templateId,
      applied: false,
    }

    if (settings.characterEvolution.autoApplyBehaviorChanges) {
      character.behaviorPrinciples = next
      record.applied = true
      await characterService.save(character)
    }

    await appendBehaviorChange(record)
    arenaLog('info', 'character', `角色 ${character.name} 赛后复盘完成`, summary)
    return { summary, change: record }
  },

  async reviewMatchForAll(match: Match): Promise<void> {
    for (const p of match.participants) {
      await this.reviewMatchForCharacter(match, p.characterId).catch(() => undefined)
    }
  },

  async applyBehaviorChange(recordId: string): Promise<Character> {
    await ensureArenaReady()
    const all = await arenaInvoke('storage', 'listBehaviorChanges', () => window.api.listBehaviorChanges())
    const record = all.find((r) => r.id === recordId)
    if (!record || record.applied) throw new Error('记录不存在或已应用')

    const character = await characterService.get(record.characterId)
    character.behaviorPrinciples = [...record.newPrinciples]
    record.applied = true
    await characterService.save(character)
    await arenaInvoke('storage', 'updateBehaviorChange', () => window.api.updateBehaviorChange(record))
    return character
  },
}
