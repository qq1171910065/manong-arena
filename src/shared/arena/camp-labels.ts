const WINNER_CAMP_LABELS: Record<string, string> = {
  good: '好人阵营',
  wolf: '狼人阵营',
  evil: '邪恶阵营',
  loyal: '正义阵营',
}

const ROLE_CAMP_LABELS: Record<string, string> = {
  good: '好人',
  wolf: '狼人',
  evil: '邪恶',
  loyal: '正义',
  villager: '平民',
}

/** 对局胜负阵营（winnerCamp: good | wolf …） */
export function formatWinnerCampLabel(camp: string | null | undefined): string {
  if (!camp) return '未知阵营'
  const key = camp.trim().toLowerCase().replace(/\s+/g, '_')
  if (key === 'good_wolf') return '好人阵营'
  return WINNER_CAMP_LABELS[key] || WINNER_CAMP_LABELS[camp] || camp
}

/** 参与者阵营标签（roleCamp） */
export function formatRoleCampLabel(camp: string | null | undefined): string {
  if (!camp) return '未知'
  const key = camp.trim().toLowerCase()
  return ROLE_CAMP_LABELS[key] || camp
}
