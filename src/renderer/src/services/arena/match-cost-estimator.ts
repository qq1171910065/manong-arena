import { BUILTIN_GAME_MODES } from '@shared/arena/constants'

import { gatewayPricingService } from '../gateway-pricing'

import { arenaInvoke, ensureArenaReady } from './client'
import { getFallbackModelId } from './settings-runtime'

import type { Match } from '@shared/arena/types'



export interface MatchCostEstimate {

  totalCents: number

  perPlayerCents: number

  sampleCount: number

  source: 'pricing' | 'history' | 'default'

}



export interface MatchCostEstimateOptions {

  participantModelIds?: string[]

  systemRoleModelIds?: Record<string, string>

  sheriffEnabled?: boolean

  roundtableRounds?: number

  roundtableHostEnabled?: boolean

  roundtableNarratorEnabled?: boolean

}



interface PlayerCountBucket {

  playerCount: number

  perPlayerTotal: number

  samples: number

}



export interface MatchCostProfile {

  byMode: Record<string, PlayerCountBucket[]>

  refreshedAt: string

}



interface CallSpec {

  assignTo: 'participant' | 'system'

  systemKind?: 'judge' | 'host' | 'narrator'

  count: number

  promptChars: number

  completionChars: number

}



const DEFAULT_PER_PLAYER_CURVE: Record<string, (playerCount: number) => number> = {

  werewolf: (count) => {

    const clamped = Math.min(18, Math.max(6, count))

    const t = (clamped - 6) / 12

    return Math.round(205 - 48 * t)

  },

  roundtable: (count) => {

    const clamped = Math.min(12, Math.max(2, count))

    const t = (clamped - 2) / 10

    return Math.round(108 + 18 * t)

  },

}



function isCompletedMatch(match: Match): boolean {

  return (match.status === 'completed' || match.status === 'archived') && match.totalCostCents > 0

}



export function buildMatchCostProfile(matches: Match[]): MatchCostProfile {

  const byMode: Record<string, Map<number, PlayerCountBucket>> = {}



  for (const match of matches) {

    if (!isCompletedMatch(match)) continue

    const playerCount = match.participants.length

    if (playerCount < 2) continue

    const perPlayer = match.totalCostCents / playerCount

    if (!Number.isFinite(perPlayer) || perPlayer <= 0) continue



    const modeBuckets = byMode[match.gameModeId] || new Map<number, PlayerCountBucket>()

    const bucket = modeBuckets.get(playerCount) || { playerCount, perPlayerTotal: 0, samples: 0 }

    bucket.perPlayerTotal += perPlayer

    bucket.samples += 1

    modeBuckets.set(playerCount, bucket)

    byMode[match.gameModeId] = modeBuckets

  }



  const normalized: MatchCostProfile['byMode'] = {}

  for (const [modeId, bucketMap] of Object.entries(byMode)) {

    normalized[modeId] = [...bucketMap.values()].sort((a, b) => a.playerCount - b.playerCount)

  }



  return { byMode: normalized, refreshedAt: new Date().toISOString() }

}



function interpolatePerPlayer(buckets: PlayerCountBucket[], playerCount: number): { value: number; samples: number } | null {

  if (!buckets.length) return null

  const exact = buckets.find((item) => item.playerCount === playerCount)

  if (exact) {

    return { value: exact.perPlayerTotal / exact.samples, samples: exact.samples }

  }



  const lower = [...buckets].reverse().find((item) => item.playerCount < playerCount)

  const upper = buckets.find((item) => item.playerCount > playerCount)

  if (lower && upper) {

    const lowerPpc = lower.perPlayerTotal / lower.samples

    const upperPpc = upper.perPlayerTotal / upper.samples

    const ratio = (playerCount - lower.playerCount) / (upper.playerCount - lower.playerCount)

    return {

      value: lowerPpc + (upperPpc - lowerPpc) * ratio,

      samples: lower.samples + upper.samples,

    }

  }



  const nearest = buckets.reduce((best, item) => {

    const diff = Math.abs(item.playerCount - playerCount)

    const bestDiff = Math.abs(best.playerCount - playerCount)

    return diff < bestDiff ? item : best

  })

  const distance = Math.abs(nearest.playerCount - playerCount)

  if (distance > 3) return null

  return { value: nearest.perPlayerTotal / nearest.samples, samples: nearest.samples }

}



function defaultPerPlayer(modeId: string, playerCount: number): number {

  const curve = DEFAULT_PER_PLAYER_CURVE[modeId]

  if (curve) return curve(playerCount)

  const mode = BUILTIN_GAME_MODES.find((item) => item.id === modeId)

  if (!mode) return 150

  const scale = 1 - Math.min(0.12, Math.max(0, playerCount - mode.minPlayers) * 0.008)

  return Math.round(mode.estimatedCostPerPlayerCents * scale)

}



/** 估算狼人杀对局的模型调用次数与 token 规模 */

function buildWerewolfCallSpecs(playerCount: number, sheriffEnabled: boolean): CallSpec[] {

  const rounds = Math.min(6, Math.max(3, Math.round(playerCount / 2.5)))

  const specs: CallSpec[] = []



  if (sheriffEnabled) {

    specs.push({ assignTo: 'participant', count: playerCount, promptChars: 4200, completionChars: 320 })

    specs.push({ assignTo: 'participant', count: playerCount, promptChars: 2600, completionChars: 80 })

    specs.push({ assignTo: 'system', systemKind: 'judge', count: Math.ceil(playerCount * 0.4), promptChars: 3000, completionChars: 180 })

  }



  for (let round = 0; round < rounds; round += 1) {

    const alive = Math.max(3, playerCount - round)

    specs.push({ assignTo: 'participant', count: Math.ceil(alive * 0.35), promptChars: 2400, completionChars: 100 })

    specs.push({ assignTo: 'participant', count: alive, promptChars: 4800, completionChars: 380 })

    specs.push({ assignTo: 'system', systemKind: 'judge', count: Math.ceil(alive * 0.35), promptChars: 3200, completionChars: 220 })

    specs.push({ assignTo: 'participant', count: alive, promptChars: 2900, completionChars: 90 })

  }



  specs.push({ assignTo: 'system', systemKind: 'judge', count: rounds * 2, promptChars: 2800, completionChars: 150 })

  return specs

}



/** 估算圆桌讨论对局的模型调用次数与 token 规模 */

function buildRoundtableCallSpecs(

  playerCount: number,

  rounds: number,

  hostEnabled: boolean,

  narratorEnabled: boolean

): CallSpec[] {

  const safeRounds = Math.min(8, Math.max(1, Math.floor(rounds)))

  const specs: CallSpec[] = [

    { assignTo: 'participant', count: playerCount * safeRounds, promptChars: 3600, completionChars: 420 },

  ]

  if (hostEnabled) {

    specs.push({ assignTo: 'system', systemKind: 'host', count: safeRounds + 1, promptChars: 2800, completionChars: 280 })

  }

  if (narratorEnabled) {

    specs.push({ assignTo: 'system', systemKind: 'narrator', count: safeRounds, promptChars: 2400, completionChars: 200 })

  }

  return specs

}



/** 通用玩法：按人数与阶段数估算发言/投票/裁判调用 */

function buildGenericCallSpecs(modeId: string, playerCount: number): CallSpec[] {

  const mode = BUILTIN_GAME_MODES.find((item) => item.id === modeId)

  const phaseCount = Math.max(1, mode?.phases.length || 1)

  const rounds = Math.min(5, Math.max(2, Math.ceil(phaseCount * 0.8)))

  const specs: CallSpec[] = []

  for (let round = 0; round < rounds; round += 1) {

    const alive = Math.max(2, playerCount - Math.floor(round / 2))

    specs.push({ assignTo: 'participant', count: alive, promptChars: 4000, completionChars: 320 })

    specs.push({ assignTo: 'participant', count: Math.ceil(alive * 0.6), promptChars: 2600, completionChars: 90 })

    specs.push({ assignTo: 'system', systemKind: 'judge', count: Math.ceil(alive * 0.25), promptChars: 2800, completionChars: 160 })

  }

  return specs

}



function buildCallSpecs(modeId: string, playerCount: number, options: MatchCostEstimateOptions): CallSpec[] {

  const mode = BUILTIN_GAME_MODES.find((item) => item.id === modeId)

  const engineKind = mode?.engineKind || modeId

  if (engineKind === 'werewolf' || modeId === 'werewolf') {

    return buildWerewolfCallSpecs(playerCount, options.sheriffEnabled !== false)

  }

  if (engineKind === 'roundtable' || modeId === 'roundtable') {

    return buildRoundtableCallSpecs(

      playerCount,

      options.roundtableRounds ?? 3,

      options.roundtableHostEnabled !== false,

      options.roundtableNarratorEnabled !== false

    )

  }

  return buildGenericCallSpecs(modeId, playerCount)

}



async function unitCallCost(

  modelId: string,

  promptChars: number,

  completionChars: number

): Promise<number> {

  return gatewayPricingService.estimateCostCents(modelId, undefined, { promptChars, completionChars })

}



async function costForSpec(

  spec: CallSpec,

  participantModels: string[],

  systemModels: Record<string, string>

): Promise<number> {

  const models = participantModels.filter(Boolean)

  const fallbackModels = models.length ? models : [getFallbackModelId()]



  if (spec.assignTo === 'system') {

    const modelId = systemModels[spec.systemKind || 'judge'] || getFallbackModelId()

    const unit = await unitCallCost(modelId, spec.promptChars, spec.completionChars)

    return unit * spec.count

  }



  const baseCount = Math.floor(spec.count / fallbackModels.length)

  const remainder = spec.count % fallbackModels.length

  let total = 0

  for (let index = 0; index < fallbackModels.length; index += 1) {

    const callCount = baseCount + (index < remainder ? 1 : 0)

    if (callCount <= 0) continue

    const unit = await unitCallCost(fallbackModels[index]!, spec.promptChars, spec.completionChars)

    total += unit * callCount

  }

  return total

}



let cachedProfile: MatchCostProfile | null = null



export function getMatchCostProfile(): MatchCostProfile | null {

  return cachedProfile

}



export async function refreshMatchCostProfile(): Promise<MatchCostProfile> {

  await ensureArenaReady()

  const matches = await arenaInvoke('match', 'listMatches', () => window.api.listMatches())

  cachedProfile = buildMatchCostProfile(matches)

  return cachedProfile

}



export function estimateMatchCost(

  modeId: string,

  playerCount: number,

  profile: MatchCostProfile | null = cachedProfile

): MatchCostEstimate {

  const count = Math.max(1, Math.floor(playerCount))

  const buckets = profile?.byMode[modeId]

  const historical = buckets ? interpolatePerPlayer(buckets, count) : null



  const perPlayerCents = Math.round(historical?.value ?? defaultPerPlayer(modeId, count))

  return {

    totalCents: Math.round(perPlayerCents * count),

    perPlayerCents,

    sampleCount: historical?.samples ?? 0,

    source: historical ? 'history' : 'default',

  }

}



/**

 * 按人数、角色模型与网关单价估算整局费用；网关不可用时回退历史/默认值。

 */

export async function estimateMatchCostAsync(

  modeId: string,

  playerCount: number,

  options: MatchCostEstimateOptions = {},

  profile: MatchCostProfile | null = cachedProfile

): Promise<MatchCostEstimate> {

  const count = Math.max(1, Math.floor(playerCount))



  try {

    await gatewayPricingService.refresh()

    const specs = buildCallSpecs(modeId, count, options)

    let totalCents = 0

    for (const spec of specs) {

      totalCents += await costForSpec(spec, options.participantModelIds || [], options.systemRoleModelIds || {})

    }

    if (totalCents > 0) {

      return {

        totalCents: Math.round(totalCents),

        perPlayerCents: Math.round(totalCents / count),

        sampleCount: 0,

        source: 'pricing',

      }

    }

  } catch {

    // 网关定价不可用时回退

  }



  return estimateMatchCost(modeId, count, profile)

}



export const matchCostEstimator = {

  refresh: refreshMatchCostProfile,

  getProfile: getMatchCostProfile,

  estimate: estimateMatchCost,

  estimateAsync: estimateMatchCostAsync,

}


