import { randomUUID } from '@renderer/utils/id'
import { arenaLog } from './logger'
import { ArenaError } from './errors'
import { billingService } from './billing-service'
import { gameModeService, characterService } from './character-service'
import { gameScenarioService } from './game-scenario-service'
import { resolvePromptFromPack } from './prompt-resolver'
import { getFallbackModelId } from './settings-runtime'
import { gatewayChatCompletion, gatewayChatStream } from '../gateway-api'
import { detectPlainTextStream, previewSpeechFromStreamBuffer } from './speech-stream-preview'
import { buildWerewolfSpeechPromptContext } from './werewolf-speech-context'
import { getSheriffCandidateParticipants, isSheriffCandidate, normalizeSheriffVote } from './werewolf-sheriff'
import type { GatewayTokenUsage } from '../gateway-api'
import type { Match, MatchParticipant, MatchVoteRecord, MessageStreamStatus, ModelCallRecord } from '@shared/arena/types'
import type { SystemRoleKind } from '@shared/arena/game-scenario'

const RETRY_ONCE = 1
/** 仅匹配内心推理/格式泄露，不含「我认为/我觉得」等正常发言用语 */
const LEAK_PATTERNS = /内心|thought|推理过程|上帝视角|JSON|\"speech\"|\"thought\"/i
const INNER_MONOLOGUE = /^(我)?(认为|觉得|怀疑|猜测|内心)(?!.*[号位人])/
const IDENTITY_EXPOSURE_WARNING =
  /(?:泄露|暴露|公开|透露|披露).{0,8}身份|身份.{0,6}(?:泄露|暴露)|跳身份|悍跳|认神|认狼|身份自述|不应.{0,6}身份|不要.{0,6}身份/i

function isIdentityExposureOnlyWarning(warning: string): boolean {
  const text = warning.trim()
  if (!text) return false
  if (!IDENTITY_EXPOSURE_WARNING.test(text)) return false
  return !/上帝视角|私有|隐藏信息|thought|内心|JSON|刀口|查验结果|夜间|未公开/.test(text)
}

function normalizeJudgeWarning(warning: string): string {
  return isIdentityExposureOnlyWarning(warning) ? '' : warning.trim()
}

type ModelAction = 'speech' | 'vote' | 'judge'

let activeSpeechCancel: (() => void) | null = null
let activeSpeechAborted = false

export function cancelActiveSpeechStream(): void {
  activeSpeechAborted = true
  activeSpeechCancel?.()
  activeSpeechCancel = null
  void window.api.cancelSSE()
}

function clearActiveSpeechStream(): void {
  activeSpeechAborted = false
  activeSpeechCancel = null
}

function throwIfSpeechAborted(): void {
  if (activeSpeechAborted) {
    throw new ArenaError('ENGINE_ABORTED', '模型调用已取消', 'model')
  }
}

const SYSTEM_ROLE_NAMES: Record<SystemRoleKind, string> = {
  judge: '裁判',
  narrator: '解说',
  host: '主持人',
  commentator: '评论员',
}

async function resolveSystemRoleModelId(match: Match, kind: SystemRoleKind): Promise<string> {
  const snapshotted = match.runtime.systemRoleModels?.[kind]
  if (snapshotted) return snapshotted

  await gameScenarioService.refresh()
  const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
  const role = scenario?.systemRoles.find((item) => item.kind === kind)
  const fallback = getFallbackModelId()
  return role?.modelId || fallback
}

async function buildSystemRoleParticipant(match: Match, kind: SystemRoleKind): Promise<MatchParticipant> {
  return {
    characterId: 'system:' + kind,
    characterName: SYSTEM_ROLE_NAMES[kind] || kind,
    avatarUrl: '',
    accentColor: '#7a85b0',
    modelId: await resolveSystemRoleModelId(match, kind),
    seatOrder: 0,
    roleId: null,
    roleName: null,
    roleCamp: null,
    alive: 'alive',
    isSpeaking: false,
  }
}

export type SpeechStreamDelta = {
  content: string
  thought: string
  streamStatus: MessageStreamStatus
}

function publicRoleLabel(match: Match, participant: MatchParticipant): string | null {
  const mode = gameModeService.get(match.gameModeId)
  const role = mode?.roles.find((r) => r.id === participant.roleId)
  if (!role || role.hidden) return null
  if (participant.roleCamp === 'wolf') return null
  return participant.roleName
}

function isWolfTeamRevealed(match: Match): boolean {
  const state = match.runtime.werewolfState
  if (state?.wolfTeamRevealed) return true
  if (match.runtime.currentRound > 1) return true
  return ['day-discuss', 'day-vote', 'result', 'last-words'].includes(match.runtime.currentPhaseId)
}

function formatWolfSeat(participant: MatchParticipant, alive: boolean): string {
  const roleSuffix =
    participant.roleName && participant.roleName !== '狼人' ? '（' + participant.roleName + '）' : ''
  const statusSuffix = alive ? '' : '（已出局）'
  return participant.seatOrder + '号' + participant.characterName + roleSuffix + statusSuffix
}

function wolfTeammateContext(match: Match, participant: MatchParticipant): string {
  if (participant.roleCamp !== 'wolf') return ''
  if (!isWolfTeamRevealed(match)) {
    return '第一夜行动前，你尚未与其他狼人队友相认；警上阶段不要假设已知狼坑或队友身份。'
  }
  const teammates = match.participants.filter(
    (p) => p.roleCamp === 'wolf' && p.characterId !== participant.characterId
  )
  if (!teammates.length) return '狼队友：本局除你之外没有其他狼人。'
  const alive = teammates.filter((p) => p.alive === 'alive').map((p) => formatWolfSeat(p, true))
  const dead = teammates.filter((p) => p.alive !== 'alive').map((p) => formatWolfSeat(p, false))
  const lines = ['狼队友（仅你可见，公开频道勿直接暴露）：']
  if (alive.length) lines.push('存活：' + alive.join('、'))
  if (dead.length) lines.push('已出局：' + dead.join('、'))
  lines.push('白天发言与投票时可与队友配合，但不要明牌暴露狼队信息。')
  return lines.join('\n')
}

function roleContext(match: Match, participant: MatchParticipant): string {
  const state = match.runtime.werewolfState
  const sheriffId = state?.sheriffId || match.runtime.sheriffId
  const isSheriff = sheriffId === participant.characterId
  const isSheriffSpeech = match.runtime.currentPhaseId === 'sheriff-speech'
  const seerChecks = state?.seerChecks.filter((item) => item.seerId === participant.characterId) || []
  const checks = seerChecks.map((item) => {
    const target = match.participants.find((p) => p.characterId === item.targetId)
    return '第 ' + item.round + ' 夜查验：' + (target?.characterName || '未知') + ' 是' + (item.camp === 'wolf' ? '狼人阵营' : '好人阵营')
  })
  const gravediggerNote =
    participant.roleId === 'gravedigger' && state?.gravediggerLastDeathCamp
      ? '守墓人视角：上一夜出局者属于' + (state.gravediggerLastDeathCamp === 'wolf' ? '狼人阵营' : '好人阵营') + '。'
      : ''
  return [
    participant.roleName ? '你的身份：' + participant.roleName + '（' + (participant.roleCamp === 'wolf' ? '狼人阵营' : participant.roleCamp === 'good' ? '好人阵营' : '中立') + '）' : '',
    wolfTeammateContext(match, participant),
    isSheriff ? '你是警长，白天可组织归票，你的投票按 1.5 票计算。' : sheriffId ? '当前警长：' + (match.participants.find((p) => p.characterId === sheriffId)?.characterName || '未知') : '本局暂时没有警长。',
    isSheriffSpeech
      ? participant.roleId === 'seer'
        ? '当前为警上阶段（首夜之前）：你尚未进行任何查验，若跳预言家只能说明身份与警徽流，无法公布验人。'
        : '当前为警上阶段（首夜之前）：此阶段预言家尚未查验，警上跳预言家无法报验人属正常，勿仅因缺少查验就质疑其为假预言家。'
      : '',
    gravediggerNote,
    ...checks,
    ...match.anomalies.filter((item) => item.type === 'judge_warning' && item.characterId === participant.characterId && !item.resolved).slice(-3).map((item) => '裁判警告：' + item.message),
  ].filter(Boolean).join('\n')
}

function parseJsonLike(raw: string): Record<string, unknown> | null {
  const text = raw.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim()
  try { return JSON.parse(text) as Record<string, unknown> } catch {}
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
}

function normalizeReasoningThought(value: unknown): string {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.length > 2400 ? text.slice(0, 2400) + '…' : text
}

function extractStreamingFields(buffer: string): { speech: string; thought: string } {
  const speech = extractJsonStringField(buffer, 'speech')
  const thought = extractJsonStringField(buffer, 'thought')
  return { speech, thought }
}

function previewSpeechFromBuffer(buffer: string, plainTextMode: boolean | null = null): string {
  return previewSpeechFromStreamBuffer(buffer, plainTextMode)
}

function extractJsonStringField(buffer: string, field: string): string {
  const key = '"' + field + '"'
  const idx = buffer.indexOf(key)
  if (idx < 0) return ''
  let i = idx + key.length
  while (i < buffer.length && /[\s:]/.test(buffer[i]!)) i++
  if (buffer[i] !== '"') return ''
  i++
  let out = ''
  while (i < buffer.length) {
    const ch = buffer[i]!
    if (ch === '\\') {
      const next = buffer[i + 1]
      if (next === 'n') out += '\n'
      else if (next === 't') out += '\t'
      else if (next === '"') out += '"'
      else if (next === '\\') out += '\\'
      else if (next) out += next
      i += 2
      continue
    }
    if (ch === '"') break
    out += ch
    i++
  }
  return out
}

function stripLeakPatterns(text: string): string {
  return text
    .replace(/\{[\s\S]*?"thought"[\s\S]*?\}/gi, '')
    .replace(/"thought"\s*:\s*"[^"]*"/gi, '')
    .replace(LEAK_PATTERNS, '')
    .trim()
}

function buildPromptContext(match: Match, participant: MatchParticipant, character?: { bio: string; speechStyle: string; commonPhrases: string[]; behaviorPrinciples: string[]; gameSkills?: import('@shared/arena/types').CharacterGameSkill[] }): import('@shared/arena/game-scenario').PromptRenderContext {
  const werewolfCtx = buildWerewolfSpeechPromptContext(match, participant, character)
  const scenario = gameScenarioService.getByGameModeId(match.gameModeId)
  const gameMode = gameModeService.get(match.gameModeId)
  const skill = character?.gameSkills?.find((s) => s.scenarioId === scenario?.id)
  const phase = match.runtime
  const phaseDef = gameMode?.phases?.find((p) => p.id === phase.currentPhaseId)
  return {
    characterName: participant.characterName,
    characterBio: character?.bio || '',
    speechStyle: character?.speechStyle || '',
    commonPhrases: character?.commonPhrases || [],
    behaviorPrinciples: character?.behaviorPrinciples || [],
    gameModeName: match.gameModeName,
    phaseName: phase.currentPhaseName,
    phaseDescription: phaseDef?.description || '',
    roleContext: roleContext(match, participant),
    recentMessages: werewolfCtx.recentMessages,
    thisRoundMessages: werewolfCtx.thisRoundMessages,
    lastRoundTail: werewolfCtx.lastRoundTail,
    mentionedBy: werewolfCtx.mentionedBy,
    replyBrief: werewolfCtx.replyBrief,
    aliveList: werewolfCtx.aliveList,
    discussionTopic: match.runtime.roundtableState?.discussionTopic || scenario?.discussionTopic || '',
    round: phase.currentRound,
    initialUnderstanding: skill?.initialUnderstanding || '',
    gameRulesDocument: scenario?.contentDocument || '',
  }
}

function tryResolvePrompt(match: Match, participant: MatchParticipant, slotId: import('@shared/arena/game-scenario').PromptSlotId, character?: Parameters<typeof buildPromptContext>[2]): { system: string; user: string } | null {
  const packId = match.runtime.promptPackId
  if (!packId) return null
  const pack = gameScenarioService.getPromptPack(packId)
  if (!pack) return null
  const rulesTpl = pack.templates.find((t) => t.slotId === 'game_rules')
  const context = buildPromptContext(match, participant, character)
  context.gameRules = rulesTpl ? rulesTpl.systemTemplate : ''
  const resolved = resolvePromptFromPack(pack, slotId, context)
  if (!resolved) return null
  return { system: resolved.system, user: resolved.user }
}

function buildSpeechPrompt(match: Match, participant: MatchParticipant, character?: Parameters<typeof buildPromptContext>[2]): { system: string; user: string } {
  const fromPack = tryResolvePrompt(match, participant, 'speech', character)
  if (match.runtime.currentPhaseId === 'last-words') {
    const lastWordsLead =
      '你已按规则出局，请发表遗言。这是最后一次公开发言，可总结站边、点狼、留信息或回应质疑；不要重复整段投票唱票内容。标准规则下多为首夜出局。'
    if (fromPack) {
      return {
        system: fromPack.system + '\n' + lastWordsLead,
        user: fromPack.user || '请发表遗言。',
      }
    }
  } else if (fromPack) {
    return fromPack
  }
  const ctx = buildWerewolfSpeechPromptContext(match, participant, character)
  const isSheriffSpeech = match.runtime.currentPhaseId === 'sheriff-speech'
  const isLastWords = match.runtime.currentPhaseId === 'last-words'
  const phaseInstruction = isLastWords
    ? '遗言：总结你的判断与站边，可 @ 关键对象，不要空话。'
    : isSheriffSpeech
      ? ctx.replyBrief
      : '白天发言：给出站边、怀疑对象，自然回应前文争议。'
  const sheriffSpeechRules = isSheriffSpeech
    ? '警上位于首夜之前：预言家尚未查验，跳预言家无法报验人属正常；勿仅因缺少查验就质疑假预言家。'
    : ''
  const system = [
    '你是狼人杀对局角色「' + participant.characterName + '」。',
    '当前：' + match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮',
    roleContext(match, participant),
    sheriffSpeechRules,
    isLastWords ? '你已被放逐/出局，正在发表遗言。' : isSheriffSpeech ? '' : ctx.replyBrief,
    '发言风格：口语化、直接、有信息量。禁止空话套话（如「值得警惕」「局势复杂」「有待观察」「我会持续关注」等不能直接当结论）。',
    '主体内容要有实质推理与站边；仅在回应他人时自然 @对方（@3号 或 @角色名），不要为 @ 而 @，@ 不占主要篇幅。',
    '200-350 字，关键轮可到 400 字。',
    '发言须严格按席位顺序，被 @ 不会提前你的顺位。',
    '只输出面向全场的公开发言正文，禁止 JSON、禁止字段名、禁止内心独白与推理过程（思考由模型内部完成，不要写出来）。',
    '跳身份、悍跳、公开站边神职或阵营立场均为正常玩法，按阶段与策略自行选择。',
    phaseInstruction,
  ].filter(Boolean).join('\n')
  const user = [
    '本轮前面发言：\n' + ctx.thisRoundMessages,
    '',
    '上一轮尾盘：\n' + ctx.lastRoundTail,
    '',
    '有人@你：\n' + ctx.mentionedBy,
    '',
    '存活：' + ctx.aliveList,
    '',
    '近期公开频道：\n' + ctx.recentMessages,
    '',
    isLastWords ? '轮到你发表遗言。' : isSheriffSpeech ? '轮到你警上发言。结合竞选意向与前文组织内容，勿机械质疑缺少验人的预言家。' : '轮到你发言。',
  ].join('\n')
  return { system, user }
}

function buildVotePrompt(match: Match, participant: MatchParticipant, character?: Parameters<typeof buildPromptContext>[2], strict = false): { system: string; user: string } {
  const fromPack = tryResolvePrompt(match, participant, 'vote', character)
  const isSheriffVote = match.runtime.currentPhaseId === 'sheriff-vote'
  const sheriffCandidates = isSheriffVote ? getSheriffCandidateParticipants(match) : []
  const candidates = isSheriffVote
    ? sheriffCandidates.map((p) => p.seatOrder + '号' + p.characterName)
    : match.participants
        .filter((p) => p.alive === 'alive' && p.characterId !== participant.characterId)
        .map((p) => p.seatOrder + '号' + p.characterName + (p.isSheriff ? '（警长）' : ''))
  const candidateLine = candidates.join('、') || (isSheriffVote ? '（无人竞选，请弃权）' : '无')
  const recentMessages = match.messages.filter((m) => m.kind === 'speech' && m.confirmed).slice(-8).map((m) => m.participantName + ': ' + m.content).join('\n')
  const voteInstruction = isSheriffVote
    ? '警长投票：必须从下方竞选者中选一人授予警徽（不是放逐）。若你是竞选者，请投自己（格式：投票：你的席位号）。若非竞选者，选出最可信的竞选者。只要有人竞选，禁止弃权。'
    : '放逐投票：根据公开发言与身份目标，必须投出一名怀疑对象。'
  let system = fromPack?.system || [
    '你是「' + participant.characterName + '」。',
    '阶段：' + match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮',
    roleContext(match, participant),
    voteInstruction,
    isSheriffVote
      ? '只输出一行：投票：X号（X 为竞选者席位数字）。禁止弃权。'
      : '只输出一行：投票：X号。仅在完全无法判断时输出：弃权。',
  ].filter(Boolean).join('\n')
  if (strict) {
    system += isSheriffVote
      ? '\n【格式】只输出一行：投票：X号（X 为竞选者席位数字）。禁止弃权、禁止 JSON、禁止解释。'
      : '\n【格式】只输出一行：投票：X号（X 为席位数字）。禁止 JSON、禁止解释。除非完全无法判断，否则禁止弃权。'
  }
  const user = (fromPack?.user || '') + [
    fromPack?.user ? '' : '近期发言：\n' + (recentMessages || '暂无'),
    '可投对象：' + candidateLine,
    isSheriffVote && isSheriffCandidate(match, participant.characterId)
      ? '你是竞选者，请投自己：投票：' + participant.seatOrder + '号。'
      : isSheriffVote
        ? '请从竞选者中选出一人：投票：X号。'
        : '请给出投票决定。',
  ].filter(Boolean).join('\n\n')
  return { system, user }
}

function isExplicitAbstain(text: string): boolean {
  const compact = text.trim().replace(/\s+/g, '')
  return (
    /^弃权[。.!]?$/.test(compact) ||
    /^弃票[。.!]?$/.test(compact) ||
    /^不投(?:票)?[。.!]?$/.test(compact) ||
    /投票[：:]\s*弃权/.test(text) ||
    /投[：:]\s*弃权/.test(text)
  )
}

function resolveVoteTarget(
  raw: string,
  match: Match,
  voterId: string
): { targetId: string | null; targetName: string | null; explicitAbstain: boolean } {
  let text = raw.trim()
  const isSheriffVote = match.runtime.currentPhaseId === 'sheriff-vote'
  const sheriffCandidateIds = new Set(getSheriffCandidateParticipants(match).map((p) => p.characterId))
  const canSelect = (p: MatchParticipant) => {
    if (p.alive !== 'alive') return false
    if (isSheriffVote) return sheriffCandidateIds.has(p.characterId)
    return p.characterId !== voterId
  }

  if (isExplicitAbstain(text)) {
    return { targetId: null, targetName: null, explicitAbstain: true }
  }

  const parsed = parseJsonLike(text)
  if (parsed) {
    const voteVal = parsed.vote ?? parsed.target ?? parsed.targetId ?? parsed.seat ?? parsed.choice ?? parsed.name
    if (typeof voteVal === 'string' && isExplicitAbstain(voteVal)) {
      return { targetId: null, targetName: null, explicitAbstain: true }
    }
    if (typeof voteVal === 'number' && Number.isFinite(voteVal)) {
      text = `投票：${voteVal}号`
    } else if (typeof voteVal === 'string' && voteVal.trim()) {
      text = voteVal.trim()
    }
  }

  const seatPatterns = [/投票[：:]\s*(\d+)\s*号?/, /投[给：:]\s*(\d+)\s*号?/, /票投\s*(\d+)\s*号?/, /选择\s*(\d+)\s*号?/, /^(\d+)\s*号$/]
  for (const pattern of seatPatterns) {
    const m = text.match(pattern)
    if (!m?.[1]) continue
    const seat = Number(m[1])
    const target = match.participants.find((p) => p.seatOrder === seat && canSelect(p))
    if (target) return { targetId: target.characterId, targetName: target.characterName, explicitAbstain: false }
  }

  const nameMatch = match.participants.find((p) => canSelect(p) && text.includes(p.characterName))
  if (nameMatch) {
    return { targetId: nameMatch.characterId, targetName: nameMatch.characterName, explicitAbstain: false }
  }

  return { targetId: null, targetName: null, explicitAbstain: false }
}

function fallbackVoteTarget(match: Match, voterId: string): { targetId: string; targetName: string } | null {
  const isSheriffVote = match.runtime.currentPhaseId === 'sheriff-vote'
  const candidates = isSheriffVote
    ? getSheriffCandidateParticipants(match)
    : match.participants.filter((p) => p.alive === 'alive' && p.characterId !== voterId)
  if (!candidates.length) return null

  const scores = new Map<string, number>()
  for (const msg of match.messages.filter((m) => m.kind === 'speech' && m.confirmed).slice(-12)) {
    for (const p of candidates) {
      if (!msg.content.includes(p.characterName) && !msg.content.includes(`${p.seatOrder}号`)) continue
      const weight = /狼|可疑|怀疑|投|出|查杀|踩|问题/.test(msg.content) ? 2 : 1
      scores.set(p.characterId, (scores.get(p.characterId) || 0) + weight)
    }
  }

  let best = candidates[0]
  let bestScore = -1
  for (const p of candidates) {
    const score = scores.get(p.characterId) || 0
    if (score > bestScore) {
      bestScore = score
      best = p
    }
  }
  return { targetId: best.characterId, targetName: best.characterName }
}

function parseVoteResponse(raw: string, match: Match, voterId: string, options?: { allowFallback?: boolean }): MatchVoteRecord {
  const resolved = resolveVoteTarget(raw, match, voterId)
  let targetId = resolved.targetId
  let targetName = resolved.targetName
  let explicitAbstain = resolved.explicitAbstain
  let abstainReason: MatchVoteRecord['abstainReason'] = null

  if (!targetId && !explicitAbstain && options?.allowFallback) {
    const fallback = fallbackVoteTarget(match, voterId)
    if (fallback) {
      targetId = fallback.targetId
      targetName = fallback.targetName
      abstainReason = null
    }
  }

  const abstain = explicitAbstain || !targetId
  if (abstain) {
    abstainReason = explicitAbstain ? 'explicit' : 'parse_failed'
  }

  const voter = match.participants.find((p) => p.characterId === voterId)
  return {
    id: randomUUID(),
    voterId,
    voterName: voter?.characterName || '未知',
    targetId,
    targetName,
    abstain,
    abstainReason,
    round: match.runtime.currentRound,
    phaseId: match.runtime.currentPhaseId,
    createdAt: new Date().toISOString(),
  }
}

function buildJudgePrompt(match: Match, participant: MatchParticipant, speech: string): { system: string; user: string } {
  const phase = match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮'
  const publicContext = match.messages.filter((m) => m.kind === 'speech' && m.confirmed).slice(-8).map((m) => m.participantName + ': ' + m.content).join('\n')
  const user = [
    '当前阶段：' + phase,
    '角色：' + participant.characterName + ' / ' + (participant.roleName || '未知身份'),
    '',
    '待审阅发言：',
    speech,
    '',
    '近期公开频道：',
    publicContext || '暂无',
  ].join('\n')

  const fromPack = tryResolvePrompt(match, participant, 'judge')
  if (fromPack) {
    return { system: fromPack.system, user }
  }

  const system = [
    '你是 Agent Arena 的狼人杀裁判，负责监听公开发言是否合规。',
    '只判断公开发言，不改变游戏结果。违规包括：明显超出当前阶段、泄露不应知道的私有信息（如未公开的夜间行动、仅神职知晓的查验/用药结果）、将内心推理或 thought 内容复述到公开发言、格式混乱、攻击性内容、同一玩家机械复读无信息刷屏。',
    '跳身份、悍跳、公开声明神职或阵营立场均为正常玩法，不应警告或判违规。',
    match.runtime.currentPhaseId === 'sheriff-speech'
      ? '警上位于首夜之前，预言家尚未查验；警上跳预言家无法报验人、发言偏模糊属正常，不因「缺少查验」或质疑假预言家而警告。'
      : '',
    '注意：150-320 字的正常推理发言不算过长；不同玩家立场相近、好人互相附和、警上说明竞选理由，都不算违规。',
    '请输出 JSON：{"valid":true/false,"warning":"若需要警告，写给玩家的简短提醒；否则为空","severity":"info|warning|error"}。不要输出 JSON 以外内容。',
  ].join('\n')
  return { system, user }
}

function extractSpeechText(raw: string): string {
  const parsed = parseJsonLike(raw)
  if (parsed && typeof parsed.speech === 'string') {
    return String(parsed.speech).trim().replace(/^[\"'“”‘’]+|[\"'“”‘’]+$/g, '')
  }
  return raw.trim().replace(/^```(?:json|text)?\s*/i, '').replace(/```$/i, '').trim()
}

function sanitizeSpeech(raw: string, allowRawFallback = false, reasoningFallback = ''): { content: string; thought: string; needsRetry: boolean } {
  const thought = normalizeReasoningThought(reasoningFallback)
  let text = extractSpeechText(raw)
  if (!text) {
    if (allowRawFallback) {
      const stripped = stripLeakPatterns(raw)
      if (stripped && stripped.length >= 8) {
        return { content: stripped.slice(0, 900), thought, needsRetry: false }
      }
    }
    return { content: '', thought, needsRetry: true }
  }
  if (LEAK_PATTERNS.test(text) || INNER_MONOLOGUE.test(text)) {
    text = stripLeakPatterns(text)
    if (!text || text.length < 8) return { content: '', thought, needsRetry: true }
  }
  const content = text.length > 900 ? text.slice(0, 900) + '...' : text
  return { content, thought, needsRetry: false }
}

function parseJudgeReview(raw: string, speech: string): { valid: boolean; warning: string; severity: 'info' | 'warning' | 'error'; leakDetected: boolean } {
  const parsed = parseJsonLike(raw)
  const leakDetected = /内心|thought|推理过程|上帝视角|JSON|\"speech\"|\"thought\"/i.test(speech)
  const hardWarning = speech.length > 720 ? '发言偏长，请下次收束重点，避免占用过多公共讨论时间。' : ''
  let warning = normalizeJudgeWarning(hardWarning || (typeof parsed?.warning === 'string' ? parsed.warning.trim() : ''))
  if (/内心|thought|推理过程/.test(speech) && !warning) {
    warning = '公开发言中不应包含内心推理，请只陈述面向全场的观点。'
  }
  if (/重复发言|不要重复|重复/.test(warning) && speech.length < 180) warning = ''
  const valid = warning ? false : parsed?.valid !== false
  const severity = parsed?.severity === 'error' ? 'error' : warning ? 'warning' : 'info'
  return { valid, warning, severity, leakDetected: Boolean(warning && /内心|thought|推理/.test(warning)) }
}

function shouldRegenerateAfterReview(
  review: ReturnType<typeof parseJudgeReview>,
  speech: string
): boolean {
  if (review.valid && !review.leakDetected) return false
  if (isIdentityExposureOnlyWarning(review.warning)) return false
  if (review.warning.trim()) return true
  if (review.leakDetected) return true
  return /内心|thought|推理过程|上帝视角|JSON|\"speech\"|\"thought\"/i.test(speech)
}

function buildCallRecord(
  match: Match,
  participant: MatchParticipant,
  action: ModelAction,
  requestAt: string,
  costCents: number,
  retryCount: number
): ModelCallRecord {
  return {
    id: randomUUID(),
    matchId: match.id,
    characterId: participant.characterId,
    characterName: participant.characterName,
    modelId: participant.modelId,
    phaseId: match.runtime.currentPhaseId,
    phaseName: match.runtime.currentPhaseName,
    status: 'success',
    requestAt,
    responseAt: new Date().toISOString(),
    costCents,
    retryCount,
    errorType: null,
    errorMessage: null,
    billed: true,
    rolledBack: false,
    finalResult: action,
  }
}

async function costFromUsage(
  modelId: string,
  usage: GatewayTokenUsage | undefined,
  prompt: { system: string; user: string },
  content: string
): Promise<number> {
  return billingService.estimateCallCostCents(modelId, usage, {
    promptChars: prompt.system.length + prompt.user.length,
    completionChars: content.length,
  })
}

async function callModel(match: Match, participant: MatchParticipant, prompt: { system: string; user: string }, action: ModelAction): Promise<{ content: string; costCents: number; callRecord: ModelCallRecord }> {
  const balance = await billingService.getBalanceCents()
  if (balance !== null && balance <= 0) throw new ArenaError('INSUFFICIENT_BALANCE', '余额不足，对局已暂停。', 'model')
  const requestAt = new Date().toISOString()
  let retryCount = 0
  let lastError: unknown = null
  while (retryCount <= RETRY_ONCE) {
    try {
      const result = await gatewayChatCompletion(participant.modelId, [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ])
      const content = result.content.trim()
      if (!content) throw new ArenaError('MODEL_FAILED', '模型返回为空', 'model')
      const costCents = await costFromUsage(participant.modelId, result.usage, prompt, content)
      return { content, costCents, callRecord: buildCallRecord(match, participant, action, requestAt, costCents, retryCount) }
    } catch (error) {
      lastError = error
      const message = error instanceof Error ? error.message : String(error)
      if (/超时/.test(message)) {
        throw new ArenaError('MODEL_TIMEOUT', message, 'model')
      }
      retryCount += 1
    }
  }
  throw new ArenaError('MODEL_FAILED', lastError instanceof Error ? lastError.message : '模型调用失败', 'model')
}

function rafBatch<T>(fn: (value: T) => void): { push: (value: T) => void; flush: () => void } {
  let pending: T | null = null
  let scheduled = false
  const flush = () => {
    scheduled = false
    if (pending === null) return
    const value = pending
    pending = null
    fn(value)
  }
  return {
    push(value: T) {
      pending = value
      if (!scheduled) {
        scheduled = true
        requestAnimationFrame(flush)
      }
    },
    flush,
  }
}

export const modelCallService = {
  publicRoleLabel,

  async performSpeechStream(
    match: Match,
    speakerId: string,
    onDelta: (delta: SpeechStreamDelta) => void
  ) {
    const participant = match.participants.find((p) => p.characterId === speakerId)
    if (!participant) throw new ArenaError('NOT_FOUND', '发言角色不存在', 'model')
    const balance = await billingService.getBalanceCents()
    if (balance !== null && balance <= 0) throw new ArenaError('INSUFFICIENT_BALANCE', '余额不足，对局已暂停。', 'model')

    const character = await characterService.get(participant.characterId).catch(() => null)
    const prompt = buildSpeechPrompt(match, participant, character || undefined)
    const requestAt = new Date().toISOString()
    let retryCount = 0

    while (retryCount <= RETRY_ONCE) {
      try {
        clearActiveSpeechStream()
        onDelta({ content: '', thought: '', streamStatus: 'pending' })
        let buffer = ''
        let reasoningBuffer = ''
        let plainTextMode: boolean | null = null
        let usage: GatewayTokenUsage | undefined
        const emitBatch = rafBatch((delta: SpeechStreamDelta) => onDelta(delta))
        const emitStream = (content: string, thought: string) => {
          throwIfSpeechAborted()
          emitBatch.push({
            content,
            thought,
            streamStatus: 'streaming',
          })
        }

        const text = await new Promise<string>((resolve, reject) => {
          void gatewayChatStream(
            participant.modelId,
            [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            {
              onChunk: (chunk) => {
                if (activeSpeechAborted) {
                  reject(new ArenaError('ENGINE_ABORTED', '模型调用已取消', 'model'))
                  return
                }
                buffer += chunk
                if (plainTextMode === null) plainTextMode = detectPlainTextStream(buffer)
                const fields = extractStreamingFields(buffer)
                emitStream(
                  previewSpeechFromBuffer(buffer, plainTextMode),
                  reasoningBuffer || fields.thought
                )
              },
              onReasoningChunk: (chunk) => {
                if (activeSpeechAborted) {
                  reject(new ArenaError('ENGINE_ABORTED', '模型调用已取消', 'model'))
                  return
                }
                reasoningBuffer += chunk
                const fields = extractStreamingFields(buffer)
                emitStream(
                  previewSpeechFromBuffer(buffer, plainTextMode),
                  reasoningBuffer || fields.thought
                )
              },
              onUsage: (u) => {
                usage = { ...usage, ...u }
              },
              onEnd: () => {
                if (activeSpeechAborted) {
                  reject(new ArenaError('ENGINE_ABORTED', '模型调用已取消', 'model'))
                  return
                }
                resolve(buffer)
              },
              onError: (err) => reject(new Error(err)),
            }
          ).then((cancel) => {
            activeSpeechCancel = cancel
          })
        })

        emitBatch.flush()
        throwIfSpeechAborted()
        const speech = sanitizeSpeech(text, false, reasoningBuffer)
        if (speech.needsRetry) {
          retryCount += 1
          continue
        }
        const costCents = await costFromUsage(participant.modelId, usage, prompt, text)
        onDelta({ content: speech.content, thought: speech.thought, streamStatus: 'done' })
        await arenaLog('info', 'model', '模型发言成功', speech.content.slice(0, 80), { matchId: match.id, characterId: participant.characterId })
        return {
          match,
          participant,
          content: speech.content,
          thought: speech.thought,
          costCents,
          callRecord: buildCallRecord(match, participant, 'speech', requestAt, costCents, retryCount),
        }
      } catch (error) {
        if (error instanceof ArenaError && error.code === 'ENGINE_ABORTED') throw error
        retryCount += 1
      } finally {
        clearActiveSpeechStream()
      }
    }

    const fallback = participant.characterName + '：我先整理一下当前局势，下一轮再补充具体观点。'
    onDelta({ content: fallback, thought: '', streamStatus: 'done' })
    const costCents = await billingService.estimateCallCostCents(participant.modelId, undefined, {
      promptChars: prompt.system.length + prompt.user.length,
      completionChars: fallback.length,
    })
    return {
      match,
      participant,
      content: fallback,
      thought: '',
      costCents,
      callRecord: buildCallRecord(match, participant, 'speech', requestAt, costCents, RETRY_ONCE + 1),
    }
  },

  async reviewSpeech(match: Match, participant: MatchParticipant, speech: string, thought?: string) {
    const judge = await buildSystemRoleParticipant(match, 'judge')
    await arenaLog('debug', 'model', '裁判审阅', judge.modelId, { matchId: match.id, characterId: participant.characterId })
    const result = await callModel(match, judge, buildJudgePrompt(match, participant, speech), 'judge')
    let review = parseJudgeReview(result.content, speech)
    const callRecords = [result.callRecord]
    let finalContent = speech
    let finalThought = thought
    let totalCost = result.costCents

    if (shouldRegenerateAfterReview(review, speech)) {
      const regenPrompt = buildSpeechPrompt(match, participant)
      regenPrompt.system += '\n上次发言未通过裁判审阅。请重新生成合规公开发言：200-350 字、回应近期发言、面向全场表达站边，只输出发言正文，禁止内心推理与 JSON。'
      const regen = await callModel(match, participant, regenPrompt, 'speech')
      const regenSpeech = sanitizeSpeech(regen.content, false)
      callRecords.push(regen.callRecord)
      totalCost += regen.costCents
      if (!regenSpeech.needsRetry && regenSpeech.content) {
        const retryReview = await callModel(match, judge, buildJudgePrompt(match, participant, regenSpeech.content), 'judge')
        callRecords.push(retryReview.callRecord)
        totalCost += retryReview.costCents
        review = parseJudgeReview(retryReview.content, regenSpeech.content)
        if (review.valid) {
          finalContent = regenSpeech.content
          finalThought = regenSpeech.thought
        } else {
          finalContent = participant.characterName + '：我先听大家说完，再给出明确站边。'
          review = { ...review, warning: review.warning || '公开发言含内心推理，已替换为安全短句。', valid: false, severity: 'warning' }
        }
      } else {
        finalContent = participant.characterName + '：我先听大家说完，再给出明确站边。'
        review = { valid: false, warning: '公开发言含内心推理，已替换为安全短句。', severity: 'warning', leakDetected: true }
      }
    }

    await arenaLog('info', 'model', '裁判审阅完成', review.warning || '通过', { matchId: match.id, characterId: participant.characterId })
    return { review, content: finalContent, thought: finalThought, costCents: totalCost, callRecords }
  },

  async performVote(match: Match, voterId: string) {
    const participant = match.participants.find((p) => p.characterId === voterId)
    if (!participant) throw new ArenaError('NOT_FOUND', '投票角色不存在', 'model')
    const character = await characterService.get(participant.characterId).catch(() => null)
    let result = await callModel(match, participant, buildVotePrompt(match, participant, character || undefined), 'vote')
    let vote = parseVoteResponse(result.content, match, voterId)
    let totalCost = result.costCents
    const callRecords = [result.callRecord]

    let lastRaw = result.content

    if (vote.abstain && vote.abstainReason === 'parse_failed') {
      const retry = await callModel(match, participant, buildVotePrompt(match, participant, character || undefined, true), 'vote')
      lastRaw = retry.content
      vote = parseVoteResponse(retry.content, match, voterId)
      totalCost += retry.costCents
      callRecords.push(retry.callRecord)
    }

    if (vote.abstain && vote.abstainReason === 'parse_failed') {
      vote = parseVoteResponse(lastRaw, match, voterId, { allowFallback: true })
      if (!vote.abstain) {
        await arenaLog('warn', 'model', '投票解析失败，已按发言嫌疑自动补票', vote.targetName || '', {
          matchId: match.id,
          characterId: participant.characterId,
        })
      }
    }

    vote = normalizeSheriffVote(vote, match, voterId)

    const logLabel = vote.abstain
      ? vote.abstainReason === 'explicit'
        ? '主动弃权'
        : '未识别(计弃权)'
      : vote.targetName || ''
    await arenaLog('info', 'model', '模型投票成功', logLabel, { matchId: match.id, characterId: participant.characterId })
    return { match, participant, vote, costCents: totalCost, callRecords }
  },
}
