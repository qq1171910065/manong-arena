import { buildWerewolfRolePlan } from './werewolf-role-plan'

export type WerewolfExpansionRoleId =
  | 'knight'
  | 'idiot'
  | 'gravedigger'
  | 'wolf_king'
  | 'wolf_beauty'
  | 'white_wolf_king'

export type WerewolfRuleModuleId = 'day_vote_last_words' | 'night_last_words' | 'poison_last_words'

export type WerewolfLastWordsReason = 'day-vote' | 'night' | 'poison'

export interface WerewolfExpansionRole {
  id: WerewolfExpansionRoleId
  name: string
  desc: string
  minPlayers: number
  camp: 'god' | 'wolf'
  group: string
}

export interface WerewolfRuleModule {
  id: WerewolfRuleModuleId
  name: string
  desc: string
  group: string
}

export const WEREWOLF_RULE_MODULES: WerewolfRuleModule[] = [
  { id: 'day_vote_last_words', name: '放逐遗言', desc: '被白天投票放逐者可发表遗言（标准规则下无遗言）', group: '规则扩展' },
  { id: 'night_last_words', name: '夜间遗言', desc: '第二夜及以后夜间出局者也可发表遗言（标准规则仅首夜）', group: '规则扩展' },
  { id: 'poison_last_words', name: '毒杀遗言', desc: '被女巫毒杀者可发表遗言', group: '规则扩展' },
]

export const WEREWOLF_EXPANSION_ROLES: WerewolfExpansionRole[] = [
  { id: 'knight', name: '骑士', desc: '放逐投票前可决斗一次', minPlayers: 10, camp: 'god', group: '神职扩展' },
  { id: 'idiot', name: '白痴', desc: '被投票放逐时翻牌免死', minPlayers: 11, camp: 'god', group: '神职扩展' },
  { id: 'gravedigger', name: '守墓人', desc: '知晓上一夜出局者阵营', minPlayers: 11, camp: 'god', group: '神职扩展' },
  { id: 'wolf_king', name: '狼王', desc: '出局时可自爆带走一人', minPlayers: 10, camp: 'wolf', group: '狼族扩展' },
  { id: 'wolf_beauty', name: '狼美人', desc: '每晚魅惑，死亡时殉情', minPlayers: 12, camp: 'wolf', group: '狼族扩展' },
  { id: 'white_wolf_king', name: '白狼王', desc: '出局时可自爆带走一人', minPlayers: 12, camp: 'wolf', group: '狼族扩展' },
]

const WOLF_EXPANSION_IDS = new Set<WerewolfExpansionRoleId>(['wolf_king', 'wolf_beauty', 'white_wolf_king'])
const EXPANSION_ROLE_IDS = new Set<string>(WEREWOLF_EXPANSION_ROLES.map((role) => role.id))

const LEGACY_PACK_ROLE_IDS: Record<string, WerewolfExpansionRoleId[]> = {
  'god-pack': ['knight', 'idiot', 'gravedigger'],
  'wolf-pack': ['wolf_king', 'wolf_beauty', 'white_wolf_king'],
}

export function normalizeWerewolfExpansions(raw: string[] | undefined, playerCount: number): WerewolfExpansionRoleId[] {
  if (!raw?.length) return defaultWerewolfExpansionsForCount(playerCount)
  const ids = new Set<WerewolfExpansionRoleId>()
  for (const item of raw) {
    if (LEGACY_PACK_ROLE_IDS[item]) {
      LEGACY_PACK_ROLE_IDS[item].forEach((roleId) => ids.add(roleId))
      continue
    }
    const role = WEREWOLF_EXPANSION_ROLES.find((entry) => entry.id === item)
    if (role && playerCount >= role.minPlayers) ids.add(role.id)
  }
  return [...ids]
}

export function defaultWerewolfExpansionsForCount(playerCount: number): WerewolfExpansionRoleId[] {
  const base = buildWerewolfRolePlan(playerCount)
  return WEREWOLF_EXPANSION_ROLES.filter(
    (role) => playerCount >= role.minPlayers && base.includes(role.id)
  ).map((role) => role.id)
}

export function buildWerewolfRolePlanWithExpansions(
  playerCount: number,
  enabledExpansions: WerewolfExpansionRoleId[] = []
): string[] {
  const base = buildWerewolfRolePlan(playerCount)
  const allowed = new Set(
    enabledExpansions.filter((roleId) => {
      const role = WEREWOLF_EXPANSION_ROLES.find((entry) => entry.id === roleId)
      return role && playerCount >= role.minPlayers
    })
  )
  return base.map((roleId) => {
    if (!EXPANSION_ROLE_IDS.has(roleId)) return roleId
    if (allowed.has(roleId as WerewolfExpansionRoleId)) return roleId
    return WOLF_EXPANSION_IDS.has(roleId as WerewolfExpansionRoleId) ? 'werewolf' : 'villager'
  })
}

/** @deprecated 使用 buildWerewolfRolePlanWithExpansions */
export function buildWerewolfRolePlanWithDlc(playerCount: number, enabled: string[] = []): string[] {
  return buildWerewolfRolePlanWithExpansions(playerCount, normalizeWerewolfExpansions(enabled, playerCount))
}

/** @deprecated 使用 defaultWerewolfExpansionsForCount */
export function defaultWerewolfDlcsForCount(playerCount: number): WerewolfExpansionRoleId[] {
  return defaultWerewolfExpansionsForCount(playerCount)
}

export function werewolfExpansionGroups(): Array<{ label: string; roles: WerewolfExpansionRole[] }> {
  const groups = new Map<string, WerewolfExpansionRole[]>()
  for (const role of WEREWOLF_EXPANSION_ROLES) {
    const list = groups.get(role.group) || []
    list.push(role)
    groups.set(role.group, list)
  }
  return [...groups.entries()].map(([label, roles]) => ({ label, roles }))
}

export function werewolfRuleModuleGroups(): Array<{ label: string; modules: WerewolfRuleModule[] }> {
  const groups = new Map<string, WerewolfRuleModule[]>()
  for (const module of WEREWOLF_RULE_MODULES) {
    const list = groups.get(module.group) || []
    list.push(module)
    groups.set(module.group, list)
  }
  return [...groups.entries()].map(([label, modules]) => ({ label, modules }))
}

export function normalizeWerewolfRuleModules(raw: string[] | undefined): WerewolfRuleModuleId[] {
  if (!raw?.length) return []
  const allowed = new Set(WEREWOLF_RULE_MODULES.map((item) => item.id))
  return raw.filter((item): item is WerewolfRuleModuleId => allowed.has(item as WerewolfRuleModuleId))
}

export function hasWerewolfRuleModule(
  modules: WerewolfRuleModuleId[] | undefined,
  id: WerewolfRuleModuleId
): boolean {
  return Boolean(modules?.includes(id))
}
