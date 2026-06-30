import { formatWinnerCampLabel } from '@shared/arena/camp-labels'
import { isDiscussionGameModeId } from '@shared/arena/discussion-mode'
import type { Match, MatchRecap, MatchRecapMoment, MatchRecapMvp } from '@shared/arena/types'
import { randomUUID } from '@renderer/utils/id'
import { gatewayChatCompletion } from '../gateway-api'
import { gameScenarioService } from './game-scenario-service'
import { resolvePromptFromPack } from './prompt-resolver'
import { getFallbackModelId } from './settings-runtime'
import { matchService } from './match-service'
import { arenaLog } from './logger'

const generating = new Set<string>()

const HIGHLIGHT_PATTERN = /预言家|骑士|女巫|猎人|狼王|白狼王|警长|警徽|查验|解药|毒药|守护|开枪|自爆|殉情|翻牌|决斗|归票|刀口/
const REVERSAL_PATTERN = /反转|翻盘|改票|平票|自爆|殉情|翻牌|决斗|毒|救|带走|流失|改投|站边|悍跳/

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

function normalizeMoments(raw: unknown, type: MatchRecapMoment['type'], fallbackRound = 1): MatchRecapMoment[] {
  if (!Array.isArray(raw)) return []
  const items: MatchRecapMoment[] = []
  for (const entry of raw) {
    if (typeof entry === 'string') {
      const text = entry.trim()
      if (!text) continue
      items.push({
        id: randomUUID(),
        round: fallbackRound,
        type,
        title: text.slice(0, 16),
        description: text,
      })
      continue
    }
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    const description = String(row.description || row.text || '').trim()
    const title = String(row.title || description.slice(0, 16) || '关键节点').trim()
    if (!description && !title) continue
    items.push({
      id: randomUUID(),
      round: Math.max(1, Number(row.round) || fallbackRound),
      type,
      title: title.slice(0, 20),
      description: description || title,
    })
  }
  return items.slice(0, 6)
}

function normalizeMvp(raw: unknown, match: Match): MatchRecapMvp | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const reason = String(row.reason || row.comment || row.description || '').trim()
  const characterName = String(row.characterName || row.name || '').trim()
  const seatOrder = Number(row.seatOrder ?? row.seat ?? 0)
  const characterId = String(row.characterId || '').trim()

  let participant = characterId ? match.participants.find((p) => p.characterId === characterId) : undefined
  if (!participant && characterName) {
    participant = match.participants.find((p) => p.characterName === characterName)
  }
  if (!participant && seatOrder > 0) {
    participant = match.participants.find((p) => p.seatOrder === seatOrder)
  }
  if (!participant) return null

  return {
    characterId: participant.characterId,
    characterName: participant.characterName,
    seatOrder: participant.seatOrder,
    reason: reason || '本局表现最为突出，关键决策与发言影响战局走向。',
  }
}

function eventToMoment(event: Match['events'][number], type: MatchRecapMoment['type']): MatchRecapMoment {
  const text = event.text.trim()
  return {
    id: event.id,
    round: event.round || 1,
    type,
    title: text.length > 18 ? `${text.slice(0, 16)}…` : text,
    description: text,
  }
}

export function buildFallbackRecap(match: Match): MatchRecap {
  const winner = formatWinnerCampLabel(match.winnerCamp)
  const summary =
    match.resultSummary?.trim() ||
    `${winner}取得胜利，共进行 ${match.runtime.currentRound || 1} 轮。`

  const highlights: MatchRecapMoment[] = []
  const reversals: MatchRecapMoment[] = []

  for (const event of match.events) {
    if (event.icon === '🏆') {
      highlights.unshift(eventToMoment(event, 'highlight'))
      continue
    }
    if (REVERSAL_PATTERN.test(event.text)) {
      reversals.push(eventToMoment(event, 'reversal'))
    } else if (HIGHLIGHT_PATTERN.test(event.text)) {
      highlights.push(eventToMoment(event, 'highlight'))
    }
  }

  const topSpeeches = match.messages
    .filter((msg) => msg.kind === 'speech' && msg.confirmed)
    .slice(-3)
  for (const speech of topSpeeches) {
    if (highlights.length >= 4) break
    highlights.push({
      id: speech.id,
      round: speech.round || 1,
      type: 'highlight',
      title: `${speech.participantName}发言`,
      description: speech.content.slice(0, 96) + (speech.content.length > 96 ? '…' : ''),
    })
  }

  if (!highlights.length) {
    highlights.push({
      id: randomUUID(),
      round: match.runtime.currentRound || 1,
      type: 'highlight',
      title: '对局收官',
      description: summary,
    })
  }

  if (!reversals.length && match.votes.length > 1) {
    const lastVote = match.votes[match.votes.length - 1]
    reversals.push({
      id: lastVote.id,
      round: lastVote.round || 1,
      type: 'reversal',
      title: '票型落定',
      description: lastVote.abstain
        ? `${lastVote.voterName} 选择弃权`
        : `${lastVote.voterName} 投票给 ${lastVote.targetName || '未知目标'}`,
    })
  }

  return {
    summary,
    highlights: highlights.slice(0, 4),
    reversals: reversals.slice(0, 3),
    generatedAt: new Date().toISOString(),
    source: 'fallback',
  }
}

function buildRecapContext(match: Match): Record<string, string | number | undefined> {
  const participantLines = match.participants.map((p) => {
    const role = match.status === 'completed' && p.roleName ? ` · ${p.roleName}` : ''
    const alive = p.alive === 'alive' ? '存活' : '出局'
    return `${p.seatOrder}号 ${p.characterName}${role}（${alive}）`
  })

  const eventLines = match.events.map((event) => `第${event.round}轮：${event.text}`)
  const speechLines = match.messages
    .filter((msg) => msg.kind === 'speech' && msg.confirmed)
    .slice(-16)
    .map((msg) => `${msg.participantName}：${msg.content.slice(0, 140)}${msg.content.length > 140 ? '…' : ''}`)

  const voteLines = match.votes
    .slice(-12)
    .map((vote) =>
      vote.abstain
        ? `第${vote.round}轮 ${vote.voterName} 弃权`
        : `第${vote.round}轮 ${vote.voterName} → ${vote.targetName || '未知'}`
    )

  return {
    gameModeName: match.gameModeName,
    phaseName: '赛后',
    round: match.runtime.currentRound || 1,
    discussionTopic: match.runtime.roundtableState?.discussionTopic || '',
    matchSummary: [
      `对局：${match.title}`,
      `玩法：${match.gameModeName}`,
      `结果：${match.resultSummary || `${formatWinnerCampLabel(match.winnerCamp)}胜利`}`,
      `轮次：${match.runtime.currentRound || 1}`,
      '',
      '参与者：',
      ...participantLines,
      '',
      '公开事件：',
      ...(eventLines.length ? eventLines : ['（无）']),
      '',
      '投票记录：',
      ...(voteLines.length ? voteLines : ['（无）']),
      '',
      '发言节选：',
      ...(speechLines.length ? speechLines : ['（无）']),
    ].join('\n'),
    recentMessages: eventLines.slice(-12).join('\n'),
  }
}

async function resolveNarratorModelId(match: Match): Promise<string> {
  const snapshotted = match.runtime.systemRoleModels?.narrator
  if (snapshotted) return snapshotted
  await gameScenarioService.refresh()
  const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
  const role = scenario?.systemRoles.find((item) => item.kind === 'narrator')
  return role?.modelId || getFallbackModelId()
}

async function generateNarratorRecap(match: Match): Promise<MatchRecap | null> {
  await gameScenarioService.refresh()
  const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
  if (!scenario) return null

  const packId = match.runtime.promptPackId || scenario.defaultPromptPackId
  const pack = gameScenarioService.getPromptPack(packId)
  if (!pack) return null

  const prompt = resolvePromptFromPack(pack, 'match_recap', buildRecapContext(match))
  if (!prompt) return null

  const modelId = await resolveNarratorModelId(match)
  const res = await gatewayChatCompletion(modelId, [
    { role: 'system', content: prompt.system },
    { role: 'user', content: prompt.user || '请撰写本场对局的赛后战报。' },
  ])

  const parsed = parseJsonLike(res.content || '')
  if (!parsed) return null

  const summary = String(parsed.summary || '').trim()
  if (!summary) return null

  const highlights = normalizeMoments(parsed.highlights, 'highlight', match.runtime.currentRound || 1)
  const reversals = normalizeMoments(parsed.reversals, 'reversal', match.runtime.currentRound || 1)
  const fallback = buildFallbackRecap(match)

  return {
    summary,
    highlights: highlights.length ? highlights : fallback.highlights,
    reversals: reversals.length ? reversals : fallback.reversals,
    mvp: normalizeMvp(parsed.mvp, match),
    generatedAt: new Date().toISOString(),
    source: 'narrator',
  }
}

async function produceRecap(match: Match, preferNarrator: boolean): Promise<MatchRecap> {
  let recap = buildFallbackRecap(match)
  if (isDiscussionGameModeId(match.gameModeId)) {
    const artifact = match.runtime.roundtableState?.artifact
    if (artifact?.summary) {
      recap.summary = artifact.summary
      recap.highlights = artifact.sections.slice(0, 3).map((section) => ({
        id: randomUUID(),
        round: match.runtime.currentRound || 1,
        type: 'highlight' as const,
        title: section.heading,
        description: section.bullets.join('；'),
      }))
    }
    return recap
  }
  if (!preferNarrator) return recap
  try {
    const generated = await generateNarratorRecap(match)
    if (generated) recap = generated
  } catch (err) {
    arenaLog('warn', 'match', '解说战报生成失败，使用本地摘要', err instanceof Error ? err.message : String(err))
  }
  return recap
}

export const matchRecapService = {
  buildFallbackRecap,

  async ensureRecap(matchId: string): Promise<Match> {
    const match = await matchService.get(matchId)
    if (match.recap?.summary) return match
    if (match.status !== 'completed') return match
    if (generating.has(matchId)) return match

    generating.add(matchId)
    try {
      const recap = await produceRecap(match, true)
      return matchService.updateRecap(matchId, recap)
    } finally {
      generating.delete(matchId)
    }
  },

  async regenerateRecap(matchId: string): Promise<Match> {
    const match = await matchService.get(matchId)
    if (match.status !== 'completed') return match
    if (generating.has(matchId)) return match

    generating.add(matchId)
    try {
      const recap = await produceRecap(match, true)
      return matchService.updateRecap(matchId, recap)
    } finally {
      generating.delete(matchId)
    }
  },
}
