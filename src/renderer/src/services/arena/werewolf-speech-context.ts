import type { Match, MatchMessage, MatchParticipant, StrategyTendency } from '@shared/arena/types'

export interface WerewolfSpeechPromptContext {
  recentMessages: string
  thisRoundMessages: string
  lastRoundTail: string
  mentionedBy: string
  replyBrief: string
  aliveList: string
  identityConsistency: string
  publicClaimsTable: string
  readingGuide: string
}

type CharacterSpeechProfile = {
  behaviorPrinciples?: string[]
  strategy?: StrategyTendency
}

const ROLE_CLAIM_PATTERNS: Array<{ role: string; re: RegExp }> = [
  { role: '预言家', re: /(?:我是|作为|本局)?(?:真|假)?预言家|跳预|上警.*预|我预|悍跳.*预/ },
  { role: '女巫', re: /(?:我是|作为)?女巫|跳女巫|悍跳.*女巫/ },
  { role: '守卫', re: /(?:我是|作为)?守卫|跳守卫|悍跳.*守卫/ },
  { role: '猎人', re: /(?:我是|作为)?猎人|跳猎人|悍跳.*猎人/ },
  { role: '村民', re: /(?:我是|作为)?(?:普通)?村民|闭眼村民|铁民/ },
  { role: '狼人', re: /(?:我是|自曝)?狼人|认狼|拍刀/ },
]

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

function extractRoleClaims(content: string): string[] {
  const found: string[] = []
  for (const { role, re } of ROLE_CLAIM_PATTERNS) {
    if (re.test(content)) found.push(role)
  }
  return found
}

function extractMainPoint(content: string): string {
  const text = content.trim()
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /查杀|验.*(?:查杀|狼|金|银)|(?:金|银)水/, label: '查杀/验人' },
    { re: /(?:我是|作为|跳|悍跳).*(?:预言家|女巫|守卫|猎人)/, label: '跳身份' },
    { re: /(?:站边|信|跟).*(?:预|警长|\d+号)/, label: '站边' },
    { re: /(?:出|投|归票).*\d+号/, label: '归票' },
    { re: /(?:怀疑|踩|打).*\d+号/, label: '怀疑' },
  ]
  for (const { re } of patterns) {
    const m = text.match(re)
    if (m) {
      const idx = text.indexOf(m[0])
      const start = Math.max(0, idx - 12)
      return truncate(text.slice(start, idx + m[0].length + 40), 72)
    }
  }
  const first = text.split(/[。！？\n]/).find((s) => s.trim().length >= 8)
  return truncate(first || text, 72)
}

function extractSecondaryNote(content: string, main: string): string {
  const text = content.trim()
  if (text.length <= main.length + 20) return ''
  const rest = text.replace(main, '').trim()
  if (rest.length < 10) return ''
  if (/顺便|另外|随口|也许|可能|感觉|观望|再看看/.test(rest)) {
    return truncate(rest, 48)
  }
  return ''
}

function roleIdForClaim(claim: string): string | null {
  const map: Record<string, string> = {
    预言家: 'seer',
    女巫: 'witch',
    守卫: 'guard',
    猎人: 'hunter',
    村民: 'villager',
    狼人: 'werewolf',
  }
  return map[claim] ?? null
}

export function buildOwnIdentityConsistencyBrief(match: Match, participant: MatchParticipant): string {
  const speeches = speechMessages(match).filter((m) => m.participantId === participant.characterId)
  if (!speeches.length) return ''

  const claims: Array<{ role: string; round: number; quote: string }> = []
  for (const msg of speeches) {
    for (const role of extractRoleClaims(msg.content)) {
      claims.push({ role, round: msg.round, quote: truncate(msg.content, 64) })
    }
  }
  if (!claims.length) return ''

  const latestByRole = new Map<string, { role: string; round: number; quote: string }>()
  for (const item of claims) {
    latestByRole.set(item.role, item)
  }
  const lines = [...latestByRole.values()].map(
    (c) => `第 ${c.round} 轮你公开认领/悍跳「${c.role}」：「${c.quote}」`
  )

  const claimedRoles = [...latestByRole.keys()]
  const trueRoleName = participant.roleName || ''
  const claimedNonTrue = claimedRoles.filter((r) => {
    const id = roleIdForClaim(r)
    return id && id !== participant.roleId
  })

  const parts = ['【身份自洽·你必须记住】', ...lines]

  if (claimedNonTrue.length) {
    parts.push(
      '你此前在公开场合的跳点仍有效：后续发言须与此一致，禁止下轮否认、改口或「忘记」悍跳；若坚持所跳神职，叙事须符合该身份视角（勿泄露仅真神职知晓的夜间信息）。'
    )
  } else if (participant.roleId === 'seer' && claimedRoles.includes('预言家')) {
    parts.push('你是真预言家且已公开：后续须与已报验人、警徽流、站边一致，查验叙事不可前后矛盾。')
  } else if (participant.roleCamp === 'wolf') {
    parts.push('若曾悍跳或占坑，须维持同一套说辞与站边，勿轻易自爆前后逻辑。')
  } else if (trueRoleName && claimedRoles.some((r) => r === trueRoleName.replace(/^(狼人|白狼王|狼王|狼美人)$/, '狼人'))) {
    parts.push('你的公开身份声明须与真实身份一致，技能相关表述勿越界。')
  } else {
    parts.push('本轮须呼应你此前的公开立场与站边，避免自相矛盾。')
  }

  return parts.join('\n')
}

export function buildPublicClaimsTable(match: Match): string {
  const rows: string[] = []
  const seen = new Set<string>()

  for (const msg of speechMessages(match)) {
    const roles = extractRoleClaims(msg.content)
    if (!roles.length) continue
    const speaker = match.participants.find((p) => p.characterId === msg.participantId)
    if (!speaker) continue
    const key = `${speaker.characterId}:${roles.join(',')}:${msg.round}`
    if (seen.has(key)) continue
    seen.add(key)
    rows.push(
      `${speaker.seatOrder}号${speaker.characterName}（第${msg.round}轮）：声称 ${roles.join('、')} — ${truncate(msg.content, 56)}`
    )
  }

  if (!rows.length) return ''
  return '场上公开身份声明（仅据公开发言，供核对）：\n' + rows.slice(-8).join('\n')
}

function buildSpeechReadingGuide(match: Match, beforeMe: MatchMessage[]): string {
  if (!beforeMe.length) return ''

  const lines = beforeMe.map((msg) => {
    const speaker = match.participants.find((p) => p.characterId === msg.participantId)
    if (!speaker) return ''
    const main = extractMainPoint(msg.content)
    const secondary = extractSecondaryNote(msg.content, main)
    return secondary
      ? `${speaker.seatOrder}号${speaker.characterName}【核心】${main} 【次要/勿放大】${secondary}`
      : `${speaker.seatOrder}号${speaker.characterName}【核心】${main}`
  })

  return [
    '阅读他人发言时先抓核心论点，区分「主要攻防/站边/跳身份」与「随口提及、观望、铺垫」；勿把次要一句当成对方主立场。',
    ...lines.filter(Boolean),
  ].join('\n')
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
  const readingNote =
    '回应前先识别对方核心论点（查杀/站边/跳身份/归票），勿把随口一句或次要铺垫当成主立场。'
  const replyBrief = isSheriffSpeech
    ? buildSheriffCampaignBrief(participant, character, beforeMe)
    : replyTargets.length
      ? `${orderNote}\n${readingNote}\n若前文有人质疑你或与你相关，先回应其核心指控，再展开站边与推理（@ 对方可选）。\n${replyTargets.join('\n')}`
      : beforeMe.length
        ? `${orderNote}\n${readingNote}\n本轮前面已有 ${beforeMe.length} 人按序发言，请承接其核心观点再给出判断，避免自说自话。`
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
    identityConsistency: buildOwnIdentityConsistencyBrief(match, participant),
    publicClaimsTable: buildPublicClaimsTable(match),
    readingGuide: buildSpeechReadingGuide(match, beforeMe),
  }
}

function truncate(text: string, max: number): string {
  const t = text.trim()
  return t.length > max ? t.slice(0, max) + '…' : t
}
