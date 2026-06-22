/** 平台钱包「元」→ 应用展示「积分」换算（×10000） */
export const FEE_YUAN_TO_POINTS = 10000

export function yuanToPoints(yuan: number): number {
  const x = Number(yuan)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * FEE_YUAN_TO_POINTS)
}

export function tierAppPoints(
  tier: { yuan?: number; appPoints?: number },
  pointsPerYuan = FEE_YUAN_TO_POINTS
): number {
  const points = Number(tier.appPoints)
  if (Number.isFinite(points) && points > 0) return Math.round(points)
  const yuan = Number(tier.yuan)
  if (!Number.isFinite(yuan)) return 0
  return Math.round(yuan * pointsPerYuan)
}
