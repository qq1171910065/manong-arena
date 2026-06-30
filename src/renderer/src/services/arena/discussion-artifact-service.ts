import {
  formatDiscussionArtifactLabel,
  resolveDiscussionArtifactKind,
  type DiscussionArtifact,
  type DiscussionArtifactSection,
} from '@shared/arena/discussion-mode'
import type { Match } from '@shared/arena/types'
import { gatewayChatCompletion } from '../gateway-api'
import { gameScenarioService } from './game-scenario-service'
import { resolvePromptFromPack } from './prompt-resolver'
import { getFallbackModelId } from './settings-runtime'
import { matchService } from './match-service'
import { isBrainstormMode } from './roundtable-engine'
import { arenaLog } from './logger'

const generating = new Set<string>()

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

function normalizeSections(raw: unknown): DiscussionArtifactSection[] {
  if (!Array.isArray(raw)) return []
  const sections: DiscussionArtifactSection[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const row = entry as Record<string, unknown>
    const heading = String(row.heading || row.title || '').trim()
    const bulletsRaw = row.bullets || row.items || row.points
    const bullets = Array.isArray(bulletsRaw)
      ? bulletsRaw.map((item) => String(item).trim()).filter(Boolean)
      : []
    if (!heading && !bullets.length) continue
    sections.push({ heading: heading || '要点', bullets })
  }
  return sections.slice(0, 8)
}

function buildDiscussionContext(match: Match): Record<string, string | number | undefined> {
  const state = match.runtime.roundtableState
  const speechLines = match.messages
    .filter((msg) => msg.kind === 'speech' && msg.confirmed)
    .map((msg) => `第${msg.round || 1}轮 ${msg.participantName}：${msg.content}`)
  const bridgeLines = (state?.refereeBridges || []).map(
    (item) => `第${item.round}轮裁判${item.mode === 'live_commentary' ? '解说' : '引导'}：${item.content}`
  )

  return {
    gameModeName: match.gameModeName,
    phaseName: '产物归纳',
    round: match.runtime.currentRound || 1,
    discussionTopic: state?.discussionTopic || '',
    designTarget: state?.designTarget?.trim() || '',
    matchSummary: [
      `对局：${match.title}`,
      `玩法：${match.gameModeName}`,
      `议题：${state?.discussionTopic || '（未设置）'}`,
      state?.designTarget ? `设计焦点：${state.designTarget}` : '',
      `轮数：${state?.totalRounds || 1}`,
      '',
      '裁判轮间引导：',
      ...(bridgeLines.length ? bridgeLines : ['（无）']),
      '',
      '发言记录：',
      ...(speechLines.length ? speechLines : ['（无）']),
    ]
      .filter(Boolean)
      .join('\n'),
    recentMessages: speechLines.slice(-12).join('\n'),
  }
}

function buildFallbackArtifact(match: Match): DiscussionArtifact {
  const state = match.runtime.roundtableState
  const kind = resolveDiscussionArtifactKind(match.gameModeId)
  const topic = state?.discussionTopic || match.gameModeName
  const speeches = match.messages.filter((msg) => msg.kind === 'speech' && msg.confirmed)
  const highlights = speeches.slice(-3).map((msg) => `${msg.participantName}：${msg.content.slice(0, 48)}…`)

  return {
    kind,
    title: `${formatDiscussionArtifactLabel(kind)} · ${topic}`,
    summary: `${match.gameModeName}「${topic}」共 ${state?.totalRounds || 1} 轮，${speeches.length} 条发言。`,
    sections: highlights.length
      ? [{ heading: '发言摘录', bullets: highlights }]
      : [{ heading: '讨论概况', bullets: ['本场讨论已结束，可在对局记录中查看完整发言。'] }],
    openQuestions: [],
    generatedAt: new Date().toISOString(),
    source: 'fallback',
  }
}

function normalizeArtifact(parsed: Record<string, unknown>, match: Match): DiscussionArtifact | null {
  const kind = resolveDiscussionArtifactKind(match.gameModeId)
  const summary = String(parsed.summary || parsed.artifact || '').trim()
  if (!summary) return null

  const title =
    String(parsed.title || '').trim() ||
    `${formatDiscussionArtifactLabel(kind)} · ${match.runtime.roundtableState?.discussionTopic || match.gameModeName}`

  const sections = normalizeSections(parsed.sections)
  const artifactText = String(parsed.artifact || '').trim()
  if (!sections.length && artifactText) {
    sections.push({
      heading: formatDiscussionArtifactLabel(kind),
      bullets: artifactText.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 12),
    })
  }

  const openQuestions = Array.isArray(parsed.openQuestions)
    ? parsed.openQuestions.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
    : []

  return {
    kind,
    title,
    summary: summary.slice(0, 240),
    sections: sections.length ? sections : [{ heading: '结论', bullets: [summary] }],
    openQuestions,
    generatedAt: new Date().toISOString(),
    source: 'ai',
  }
}

async function resolveJudgeModelId(match: Match): Promise<string> {
  const snapshotted = match.runtime.systemRoleModels?.judge
  if (snapshotted) return snapshotted
  await gameScenarioService.refresh()
  const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
  const role = scenario?.systemRoles.find((item) => item.kind === 'judge')
  return role?.modelId || getFallbackModelId()
}

async function generateArtifact(match: Match): Promise<DiscussionArtifact> {
  const fallback = buildFallbackArtifact(match)
  try {
    await gameScenarioService.refresh()
    const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
    if (!scenario) return fallback

    const packId = match.runtime.promptPackId || scenario.defaultPromptPackId
    const pack = gameScenarioService.getPromptPack(packId)
    if (!pack) return fallback

    const prompt = resolvePromptFromPack(pack, 'match_recap', buildDiscussionContext(match))
    if (!prompt) return fallback

    const modelId = await resolveJudgeModelId(match)
    const res = await gatewayChatCompletion(modelId, [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user || '请归纳本场讨论产物。' },
    ])

    const parsed = parseJsonLike(res.content || '')
    if (!parsed) return fallback
    return normalizeArtifact(parsed, match) || fallback
  } catch (err) {
    await arenaLog(
      'warn',
      'match',
      '讨论产物生成失败，使用本地摘要',
      err instanceof Error ? err.message : String(err)
    )
    return fallback
  }
}

function applyArtifact(match: Match, artifact: DiscussionArtifact): Match {
  if (!match.runtime.roundtableState) return match
  match.runtime.roundtableState.artifact = artifact
  match.runtime.roundtableState.artifactSummary = artifact.summary
  return match
}

export const discussionArtifactService = {
  buildFallbackArtifact,

  async ensureArtifact(match: Match): Promise<Match> {
    if (match.runtime.roundtableState?.artifact?.summary) return match
    if (generating.has(match.id)) return match

    generating.add(match.id)
    try {
      const artifact = await generateArtifact(match)
      const next = applyArtifact({ ...match }, artifact)
      return matchService.save(next)
    } finally {
      generating.delete(match.id)
    }
  },

  buildResultSummary(match: Match): string {
    const state = match.runtime.roundtableState
    const topic = state?.discussionTopic || match.gameModeName
    const artifact = state?.artifact
    if (isBrainstormMode({ id: match.gameModeId, engineKind: 'brainstorm' } as import('@shared/arena/types').GameMode)) {
      return artifact
        ? `头脑风暴「${topic}」已结束。${formatDiscussionArtifactLabel(artifact.kind)}：${state?.artifactSummary || artifact.summary}`
        : `头脑风暴「${topic}」已结束，共 ${state?.totalRounds || 1} 轮讨论。`
    }
    return artifact
      ? `圆桌讨论「${topic}」已结束。${formatDiscussionArtifactLabel(artifact.kind)}：${state?.artifactSummary || artifact.summary}`
      : `圆桌讨论「${topic}」已结束，共 ${state?.totalRounds || 1} 轮发言。`
  },
}
