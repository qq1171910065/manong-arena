/** 角色成长/沉淀展示 — 面向养成 UI，过滤对局流水与 token 细节 */

import type { CharacterGrowthSnapshot } from './character-growth'

const TOKEN_NOISE = /\s*·\s*\d+\s*output tokens.*$/i
const EXP_NOISE = /\s*·\s*\+\d+\s*EXP.*$/gi
const MATCH_BONUS_NOISE = /^对局奖励\s*·\s*/

export function sanitizeGrowthSummary(raw: string): string {
  let text = (raw || '').trim()
  text = text.replace(TOKEN_NOISE, '')
  text = text.replace(EXP_NOISE, '')
  text = text.replace(MATCH_BONUS_NOISE, '')
  return text.trim()
}

export function growthSourceLabel(source: CharacterGrowthSnapshot['source']): string {
  switch (source) {
    case 'match':
      return '场景历练'
    case 'chat':
      return '私聊沉淀'
    case 'review':
      return '复盘领悟'
    case 'initial':
      return '建档'
    case 'migration':
      return '历史追溯'
    default:
      return '成长'
  }
}

/** 是否适合在「经验沉淀」中展示 — 跳过纯数值/token 类记录 */
export function isLessonLikeSnapshot(snapshot: CharacterGrowthSnapshot): boolean {
  const summary = sanitizeGrowthSummary(snapshot.summary)
  if (!summary) return false
  if (/^完成「/.test(summary) && !/教训|领悟|调整|反思|策略/.test(summary)) return false
  if (/^对局发言|^对局投票|^发言润色|^发言思路/.test(summary)) return false
  if (snapshot.source === 'initial' || snapshot.source === 'migration') return false
  return true
}

export function formatLessonFromSnapshot(snapshot: CharacterGrowthSnapshot): string {
  const summary = sanitizeGrowthSummary(snapshot.summary)
  if (snapshot.levelDelta && snapshot.levelDelta > 0) {
    return `${summary}（升至 Lv.${snapshot.level}）`
  }
  return summary
}
