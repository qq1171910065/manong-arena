/**
 * 狼人杀身份结构模板（与 match-service 开局分配一致）。
 *
 * 设计原则（无 DLC 时的实际阵营，扩展位会降级为 villager / werewolf）：
 * - 狼人：6–8 人 2 狼，9–11 人 3 狼，12 人 4 狼（约 1/3）
 * - 神职：6 人预女；7 人 +猎；8 人 +守；9 人起不再叠更多基础神
 * - 扩展位（knight / idiot / wolf_king 等）仅在对应人数作占位，未启用 DLC 时替换为民/狼
 */
export const WEREWOLF_ROLE_PLANS: Record<number, string[]> = {
  // 2 狼 · 预女 · 2 民
  6: ['werewolf', 'werewolf', 'seer', 'witch', 'villager', 'villager'],
  // 2 狼 · 预女猎 · 2 民
  7: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager'],
  // 2 狼 · 预女猎守 · 2 民
  8: ['werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'villager', 'villager'],
  // 3 狼 · 预女猎 · 3 民
  9: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'villager', 'villager', 'villager'],
  // 3 狼 · 预女猎守 · 骑士(DLC→民) · 2 民
  10: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'knight', 'villager', 'villager'],
  // 3 狼 · 预女猎守 · 白痴/骑士(DLC→民) · 2 民
  11: ['werewolf', 'werewolf', 'werewolf', 'seer', 'witch', 'hunter', 'guard', 'idiot', 'knight', 'villager', 'villager'],
  // 4 狼(含狼王DLC→狼) · 预女猎守 · 守墓(DLC→民) · 3 民
  12: ['werewolf', 'werewolf', 'werewolf', 'wolf_king', 'seer', 'witch', 'hunter', 'guard', 'gravedigger', 'villager', 'villager', 'villager'],
}

/** 超过 12 人时按人数估算目标狼数 */
function targetWolfCount(playerCount: number): number {
  if (playerCount <= 8) return 2
  if (playerCount <= 11) return 3
  return Math.max(4, Math.round(playerCount / 3))
}

export function buildWerewolfRolePlan(playerCount: number): string[] {
  const count = Math.max(0, Math.floor(playerCount))
  if (count === 0) return []
  if (count <= 12) {
    const template = WEREWOLF_ROLE_PLANS[count] || WEREWOLF_ROLE_PLANS[12]
    return template.slice(0, count)
  }

  const base = [...WEREWOLF_ROLE_PLANS[12]]
  while (base.length < count) {
    const wolfCount = base.filter((id) => id === 'werewolf').length
    if (wolfCount < targetWolfCount(count)) base.push('werewolf')
    else base.push('villager')
  }
  return base.slice(0, count)
}
