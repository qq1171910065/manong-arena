import { randomUUID } from '@renderer/utils/id'
import { arenaLog } from './logger'
import { ArenaError } from './errors'
import { billingService } from './billing-service'
import { gameModeService } from './character-service'
import { gatewayChatCompletion, gatewayChatStream } from '../gateway-api'
import type { GatewayTokenUsage } from '../gateway-api'
import type { Match, MatchParticipant, MatchVoteRecord, MessageStreamStatus, ModelCallRecord } from '@shared/arena/types'

const RETRY_ONCE = 1
const LEAK_PATTERNS = /内心|我认为|我觉得|thought|推理过程|上帝视角|身份目标|可信度排序|JSON|\"speech\"|\"thought\"/i
const INNER_MONOLOGUE = /^(我)?(认为|觉得|怀疑|猜测|内心)/

type ModelAction = 'speech' | 'vote' | 'judge'

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

function roleContext(match: Match, participant: MatchParticipant): string {
  const state = match.runtime.werewolfState
  const sheriffId = state?.sheriffId || match.runtime.sheriffId
  const isSheriff = sheriffId === participant.characterId
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
    isSheriff ? '你是警长，白天可组织归票，你的投票按 1.5 票计算。' : sheriffId ? '当前警长：' + (match.participants.find((p) => p.characterId === sheriffId)?.characterName || '未知') : '本局暂时没有警长。',
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

function normalizePublicThought(value: unknown): string {
  const text = String(value || '').trim().replace(/\s+/g, ' ')
  if (!text) return '正在结合公开发言、身份目标和当前阶段整理判断。'
  return text
}

function extractStreamingFields(buffer: string): { speech: string; thought: string } {
  const speech = extractJsonStringField(buffer, 'speech')
  const thought = extractJsonStringField(buffer, 'thought')
  return { speech, thought }
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

function overlapRatio(a: string, b: string): number {
  if (!a || !b) return 0
  const short = a.length <= b.length ? a : b
  const long = short === a ? b : a
  if (long.includes(short)) return short.length / Math.max(long.length, 1)
  return 0
}

function stripLeakPatterns(text: string): string {
  return text
    .replace(/\{[\s\S]*?"thought"[\s\S]*?\}/gi, '')
    .replace(/"thought"\s*:\s*"[^"]*"/gi, '')
    .replace(LEAK_PATTERNS, '')
    .trim()
}

function buildSpeechPrompt(match: Match, participant: MatchParticipant): { system: string; user: string } {
  const recentMessages = match.messages
    .filter((m) => m.kind === 'speech' && m.confirmed && m.streamStatus !== 'pending')
    .slice(-10)
    .map((m) => m.participantName + ': ' + m.content)
    .join('\n')
  const alive = match.participants.filter((p) => p.alive === 'alive').map((p) => p.seatOrder + '号' + p.characterName + (p.isSheriff ? '（警长）' : '')).join('、')
  const isSheriffSpeech = match.runtime.currentPhaseId === 'sheriff-speech'
  const phaseInstruction = isSheriffSpeech
    ? '这是警上发言。请明确说明你是否竞选警长，并给出警徽流、归票思路或不竞选理由。不要宣布投票结果。'
    : '请给出你的判断、怀疑对象、守护信息或归票建议。'
  const system = [
    '你是 Agent Arena 中的社交推理游戏 AI 角色「' + participant.characterName + '」。',
    '当前玩法：' + match.gameModeName,
    '当前阶段：' + match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮',
    roleContext(match, participant),
    '公开发言只能基于你可见的信息、公开发言、公开事件和你的身份能力。不要泄露你不应知道的隐藏信息。',
    'speech 字段必须是面向全场的正式发言，80-200字。禁止出现内心独白、推理过程、「我认为/我觉得」式自我分析、thought 字段措辞、JSON 结构或身份自述（狼人绝不能承认自己是狼）。',
    'thought 字段仅供上帝视角，可写身份目标与策略，180-320字。',
    phaseInstruction,
    '请输出 JSON：{"thought":"...","speech":"..."}。不要输出 JSON 以外的内容。',
  ].filter(Boolean).join('\n')
  const user = (recentMessages ? '近期公开频道：\n' + recentMessages + '\n\n' : '') + '存活玩家：' + alive + '\n轮到你发言。'
  return { system, user }
}

function buildVotePrompt(match: Match, participant: MatchParticipant): { system: string; user: string } {
  const isSheriffVote = match.runtime.currentPhaseId === 'sheriff-vote'
  const candidates = match.participants
    .filter((p) => p.alive === 'alive' && (isSheriffVote || p.characterId !== participant.characterId))
    .map((p) => p.seatOrder + '号' + p.characterName + (p.isSheriff ? '（警长）' : ''))
    .join('、')
  const recentMessages = match.messages.filter((m) => m.kind === 'speech' && m.confirmed).slice(-8).map((m) => m.participantName + ': ' + m.content).join('\n')
  const voteInstruction = isSheriffVote
    ? '现在进行警长投票。请根据警上发言选择最适合带队归票的玩家；这是授予警徽，不是放逐。'
    : '现在进行放逐投票。请根据公开发言、票型和你的身份目标做决定。'
  const system = [
    '你是社交推理游戏角色「' + participant.characterName + '」。',
    '当前阶段：' + match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮',
    roleContext(match, participant),
    voteInstruction,
    '只输出以下格式之一：投票：X号；或：弃权。不要输出解释。',
  ].filter(Boolean).join('\n')
  const user = '近期公开频道：\n' + (recentMessages || '暂无公开发言') + '\n\n可投票对象：' + (candidates || '无其他存活玩家') + '。请给出投票决定。'
  return { system, user }
}

function buildJudgePrompt(match: Match, participant: MatchParticipant, speech: string): { system: string; user: string } {
  const phase = match.runtime.currentPhaseName + ' · 第 ' + match.runtime.currentRound + '轮'
  const publicContext = match.messages.filter((m) => m.kind === 'speech' && m.confirmed).slice(-8).map((m) => m.participantName + ': ' + m.content).join('\n')
  const system = [
    '你是 Agent Arena 的狼人杀裁判，负责监听公开发言是否合规。',
    '只判断公开发言，不改变游戏结果。违规包括：明显超出当前阶段、泄露不应知道的隐藏信息、发言明显过长、同一玩家短时间复制或近乎复制自己已说过的话、格式混乱、攻击性内容、将内心推理或 thought 内容复述到公开发言。',
    '注意：不同玩家表达相似立场、好人阵营互相附和、警上重复说明竞选或不竞选，都不算重复发言。只有同一玩家机械复读或无信息刷屏才警告。',
    '请输出 JSON：{"valid":true/false,"warning":"若需要警告，写给玩家的简短提醒；否则为空","severity":"info|warning|error"}。不要输出 JSON 以外内容。',
  ].join('\n')
  const user = '当前阶段：' + phase + '\n角色：' + participant.characterName + ' / ' + (participant.roleName || '未知身份') + '\n近期公开内容：\n' + (publicContext || '暂无') + '\n\n待审阅发言：\n' + speech
  return { system, user }
}

function sanitizeSpeech(raw: string, allowRawFallback = false): { content: string; thought: string; needsRetry: boolean } {
  const parsed = parseJsonLike(raw)
  if (!parsed || typeof parsed.speech !== 'string') {
    if (allowRawFallback) {
      const stripped = stripLeakPatterns(raw)
      if (stripped && stripped.length >= 8) return { content: stripped.slice(0, 900), thought: normalizePublicThought(parsed?.thought), needsRetry: false }
    }
    return { content: '', thought: '', needsRetry: true }
  }
  let text = String(parsed.speech).trim().replace(/^[\"'“”‘’]+|[\"'“”‘’]+$/g, '')
  const thought = normalizePublicThought(parsed.thought)
  if (!text) return { content: '', thought, needsRetry: true }
  if (LEAK_PATTERNS.test(text) || INNER_MONOLOGUE.test(text)) {
    text = stripLeakPatterns(text)
    if (!text || text.length < 8) return { content: '', thought, needsRetry: true }
  }
  if (overlapRatio(text, thought) > 0.7) {
    text = text.slice(0, Math.min(text.length, Math.max(40, Math.floor(text.length * 0.45))))
  }
  const content = text.length > 900 ? text.slice(0, 900) + '...' : text
  return { content, thought, needsRetry: false }
}

function parseJudgeReview(raw: string, speech: string): { valid: boolean; warning: string; severity: 'info' | 'warning' | 'error'; leakDetected: boolean } {
  const parsed = parseJsonLike(raw)
  const leakDetected = LEAK_PATTERNS.test(speech)
  const hardWarning = speech.length > 680 ? '发言偏长，请下次收束重点，避免占用过多公共讨论时间。' : ''
  let warning = hardWarning || (typeof parsed?.warning === 'string' ? parsed.warning.trim() : '')
  if ((leakDetected || /内心|thought|推理过程|我认为/.test(speech)) && !warning) warning = '公开发言中不应包含内心推理，请只陈述面向全场的观点。'
  if (/重复发言|不要重复|重复/.test(warning) && speech.length < 420) warning = ''
  const valid = warning ? false : parsed?.valid !== false
  const severity = parsed?.severity === 'error' ? 'error' : warning ? 'warning' : 'info'
  return { valid, warning, severity, leakDetected: Boolean(warning && /内心|thought|推理/.test(warning)) }
}

function parseVoteResponse(raw: string, match: Match, voterId: string): MatchVoteRecord {
  const text = raw.trim()
  const abstain = /弃权|弃票|不投/.test(text)
  const isSheriffVote = match.runtime.currentPhaseId === 'sheriff-vote'
  const canSelect = (p: MatchParticipant) => p.alive === 'alive' && (isSheriffVote || p.characterId !== voterId)
  let targetId: string | null = null
  let targetName: string | null = null
  if (!abstain) {
    const seatMatch = text.match(/(\d+)\s*号/)
    const nameMatch = match.participants.find((p) => canSelect(p) && text.includes(p.characterName))
    if (seatMatch) {
      const seat = Number(seatMatch[1])
      const target = match.participants.find((p) => p.seatOrder === seat && canSelect(p))
      targetId = target?.characterId ?? null
      targetName = target?.characterName ?? null
    } else if (nameMatch) {
      targetId = nameMatch.characterId
      targetName = nameMatch.characterName
    }
  }
  const voter = match.participants.find((p) => p.characterId === voterId)
  return {
    id: randomUUID(),
    voterId,
    voterName: voter?.characterName || '未知',
    targetId,
    targetName,
    abstain: abstain || !targetId,
    round: match.runtime.currentRound,
    phaseId: match.runtime.currentPhaseId,
    createdAt: new Date().toISOString(),
  }
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

function costFromUsage(
  usage: GatewayTokenUsage | undefined,
  prompt: { system: string; user: string },
  content: string
): number {
  return billingService.estimateCallCostCents(usage, {
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
      const costCents = costFromUsage(result.usage, prompt, content)
      return { content, costCents, callRecord: buildCallRecord(match, participant, action, requestAt, costCents, retryCount) }
    } catch (error) {
      lastError = error
      retryCount += 1
    }
  }
  throw new ArenaError('MODEL_FAILED', lastError instanceof Error ? lastError.message : '模型调用失败', 'model')
}

function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: Parameters<T> | null = null
  return ((...args: Parameters<T>) => {
    pending = args
    const now = Date.now()
    const run = () => {
      last = Date.now()
      if (pending) fn(...pending)
      pending = null
      timer = null
    }
    if (now - last >= ms) run()
    else if (!timer) timer = setTimeout(run, ms - (now - last))
  }) as T
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

    const prompt = buildSpeechPrompt(match, participant)
    const requestAt = new Date().toISOString()
    let retryCount = 0

    while (retryCount <= RETRY_ONCE) {
      try {
        onDelta({ content: '', thought: '', streamStatus: 'pending' })
        let buffer = ''
        let usage: GatewayTokenUsage | undefined
        const emit = throttle((delta: SpeechStreamDelta) => onDelta(delta), 50)

        const text = await new Promise<string>((resolve, reject) => {
          void gatewayChatStream(
            participant.modelId,
            [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
            {
              onChunk: (chunk) => {
                buffer += chunk
                const fields = extractStreamingFields(buffer)
                emit({ content: fields.speech, thought: fields.thought, streamStatus: 'streaming' })
              },
              onUsage: (u) => {
                usage = { ...usage, ...u }
              },
              onEnd: () => resolve(buffer),
              onError: (err) => reject(new Error(err)),
            }
          )
        })

        const speech = sanitizeSpeech(text, false)
        if (speech.needsRetry) {
          retryCount += 1
          continue
        }
        const costCents = costFromUsage(usage, prompt, text)
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
      } catch {
        retryCount += 1
      }
    }

    const fallback = participant.characterName + '：我先整理一下当前局势，下一轮再补充具体观点。'
    onDelta({ content: fallback, thought: '', streamStatus: 'done' })
    const costCents = billingService.estimateCallCostCents(undefined, {
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
    const result = await callModel(match, participant, buildJudgePrompt(match, participant, speech), 'judge')
    let review = parseJudgeReview(result.content, speech)
    const callRecords = [result.callRecord]
    let finalContent = speech
    let finalThought = thought
    let totalCost = result.costCents

    if (!review.valid || review.leakDetected || LEAK_PATTERNS.test(speech)) {
      const regenPrompt = buildSpeechPrompt(match, participant)
      regenPrompt.system += '\n上次发言违规，请重新生成更短、更面向全场的 JSON 发言，禁止任何内心推理。'
      const regen = await callModel(match, participant, regenPrompt, 'speech')
      const regenSpeech = sanitizeSpeech(regen.content, false)
      callRecords.push(regen.callRecord)
      totalCost += regen.costCents
      if (!regenSpeech.needsRetry && regenSpeech.content) {
        const retryReview = await callModel(match, participant, buildJudgePrompt(match, participant, regenSpeech.content), 'judge')
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
    const result = await callModel(match, participant, buildVotePrompt(match, participant), 'vote')
    const vote = parseVoteResponse(result.content, match, voterId)
    await arenaLog('info', 'model', '模型投票成功', vote.abstain ? '弃权' : vote.targetName || '', { matchId: match.id, characterId: participant.characterId })
    return { match, participant, vote, costCents: result.costCents, callRecord: result.callRecord }
  },
}
