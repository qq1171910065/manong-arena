import type { Match, MatchMessage, MatchParticipant, StrategyTendency } from '@shared/arena/types'

export interface WerewolfSpeechPromptContext {
  recentMessages: string
  thisRoundMessages: string
  lastRoundTail: string
  mentionedBy: string
  replyBrief: string
  aliveList: string
}

type CharacterSpeechProfile = {
  behaviorPrinciples?: string[]
  strategy?: StrategyTendency
}

function formatSpeechLine(msg: MatchMessage, participants: MatchParticipant[]): string {
  const p = participants.find((item) => item.characterId === msg.participantId)
  const seat = p?.seatOrder ?? '?'
  return `${seat}号${msg.participantName}：${msg.content}`
}

function speechMessages(match: Match): MatchMessage[] {
  return match.messages.filter((m) => m.kind === 'speech' && m.confirmed && m.streamStatus !== 'pending')
}

export function extractMentionedParticipantIds(match: Match, text: string): string[] {
  const found = new Set<string>()
  for (const p of match.participants) {
    if (p.alive !== 'alive') continue
    const patterns = [
      new RegExp(`@${p.seatOrder}\\s*号`, 'i'),
      new RegExp(`@${p.seatOrder}号${escapeRegExp(p.characterName)}`, 'i'),
      new RegExp(`@${escapeRegExp(p.characterName)}`, 'i'),
    ]
    if (patterns.some((re) => re.test(text))) found.add(p.characterId)
  }
  return [...found]
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isMentioningParticipant(match: Match, text: string, participant: MatchParticipant): boolean {
  return extractMentionedParticipantIds(match, text).includes(participant.characterId)
}

function accusesParticipant(text: string, participant: MatchParticipant): boolean {
  if (!text.includes(participant.characterName) && !text.includes(`${participant.seatOrder}号`)) return false
  return /狼|可疑|怀疑|出|投|查杀|踩|有问题|不对|撒谎|假预|悍跳/.test(text)
}

function claimedSeerOnSheriffSpeech(messages: MatchMessage[]): boolean {
  return messages.some((m) => /预言家|真预|我是预|上警.*预|跳预/.test(m.content))
}

export function buildSheriffCampaignBrief(
  participant: MatchParticipant,
  character?: CharacterSpeechProfile,
  earlierSpeeches: MatchMessage[] = []
): string {
  const bold = character?.strategy?.cautiousVsBold ?? 0
  const lead = character?.strategy?.leadVsFollow ?? 0
  const isGod = participant.roleCamp === 'good' && participant.roleId !== 'villager'
  const isWolf = participant.roleCamp === 'wolf'

  let tendency = '结合身份目标与人设决定是否竞选，不要全员退缩、集体认怂。'
  if (bold >= 0.25 || lead >= 0.25) {
    tendency = '你的人设偏主动、敢带队：若有站边或信息优势，应积极考虑竞选警长，不要一味怕死。'
  } else if (bold <= -0.25) {
    tendency = '你的人设偏谨慎：可不竞选，但若逻辑链完整仍应敢于上警表达，勿无意义退水。'
  }
  if (isGod) tendency += ' 神职在有把握时不必躲警，可用警徽流为好人带队。'
  if (isWolf) tendency += ' 狼人可视局势悍跳或占坑，不必集体退缩。'
  if (participant.roleId === 'seer') {
    tendency += ' 你是预言家：警上在首夜查验之前，此阶段没有任何查验结果可报；若跳预言家，只能说明身份与警徽流意向，不要编造验人信息。'
  }

  const seerClaimed = claimedSeerOnSheriffSpeech(earlierSpeeches)
  const listenerNote = seerClaimed && participant.roleId !== 'seer'
    ? ' 此前有人警上跳预言家但未报验人：这是正常现象（警上在首夜之前），不要仅因「缺少查验」就判定假预言家或带头质疑。'
    : ''

  const principles = character?.behaviorPrinciples?.slice(0, 2).filter(Boolean).join('、')
  return [
    '警上位于首夜行动之前：此阶段预言家尚未查验，跳预言家只能谈身份与警徽流，发言偏模糊属正常。',
    '不要仅因警上预言家缺少验人信息就集体质疑或扣「假预言家」。',
    '警上发言须严格按席位顺序，不要插队。',
    tendency + listenerNote,
    '竞选者开头声明竞选并说明警徽流；不竞选者直接进入观点，勿机械复读「退水」。',
    principles ? `行为原则：${principles}` : '',
  ]
    .filter(Boolean)
    .join(' ')
}

export function buildWerewolfSpeechPromptContext(
  match: Match,
  participant: MatchParticipant,
  character?: CharacterSpeechProfile
): WerewolfSpeechPromptContext {
  const speeches = speechMessages(match)
  const currentRound = match.runtime.currentRound
  const currentPhaseId = match.runtime.currentPhaseId

  const thisRound = speeches.filter((m) => m.round === currentRound && m.phaseId === currentPhaseId)
  const beforeMe = thisRound.filter((m) => m.participantId !== participant.characterId)

  const lastRoundSpeeches = speeches.filter((m) => m.round === currentRound - 1)
  const lastRoundTail = lastRoundSpeeches.slice(-3)

  const mentionedByLines: string[] = []
  const accusationLines: string[] = []
  for (const msg of [...beforeMe, ...lastRoundTail]) {
    const speaker = match.participants.find((p) => p.characterId === msg.participantId)
    if (!speaker) continue
    if (isMentioningParticipant(match, msg.content, participant)) {
      mentionedByLines.push(`${speaker.seatOrder}号${speaker.characterName} @了你：${truncate(msg.content, 80)}`)
    } else if (accusesParticipant(msg.content, participant)) {
      accusationLines.push(`${speaker.seatOrder}号${speaker.characterName} 指控/质疑你：${truncate(msg.content, 80)}`)
    }
  }

  const replyTargets = [...mentionedByLines, ...accusationLines]
  const isSheriffSpeech = match.runtime.currentPhaseId === 'sheriff-speech'
  const orderNote = '发言须严格按席位顺序，被 @ 不会提前你的顺位。'
  const replyBrief = isSheriffSpeech
    ? buildSheriffCampaignBrief(participant, character, beforeMe)
    : replyTargets.length
      ? `${orderNote}\n若前文有人质疑你或与你相关，请用一两句话回应，再展开站边与推理（@ 对方可选）。\n${replyTargets.join('\n')}`
      : beforeMe.length
        ? `${orderNote}\n本轮前面已有 ${beforeMe.length} 人按序发言，请承接其具体观点再给出判断，避免自说自话。`
        : lastRoundTail.length
          ? `${orderNote}\n上一轮尾盘仍有争议，请承接未决问题。`
          : `${orderNote}\n给出明确站边或怀疑对象，避免空泛套话。`

  const aliveList = match.participants
    .filter((p) => p.alive === 'alive')
    .map((p) => `${p.seatOrder}号${p.characterName}${p.isSheriff ? '（警长）' : ''}`)
    .join('、')

  return {
    recentMessages: speeches.slice(-10).map((m) => formatSpeechLine(m, match.participants)).join('\n') || '（暂无公开发言）',
    thisRoundMessages: beforeMe.map((m) => formatSpeechLine(m, match.participants)).join('\n') || '（你是本轮第一位发言）',
    lastRoundTail: lastRoundTail.map((m) => formatSpeechLine(m, match.participants)).join('\n') || '（无）',
    mentionedBy: mentionedByLines.join('\n') || '（无人 @你）',
    replyBrief,
    aliveList,
  }
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}
