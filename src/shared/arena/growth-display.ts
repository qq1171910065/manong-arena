/** 角色成长/沉淀展示 — 面向养成 UI，过滤对局流水与 token 细节 */

import type { CharacterGrowthSnapshot } from './character-growth'
import type { CharacterGrowthRecord, BehaviorChangeRecord } from './types'

export interface CharacterGrowthLogItem {
  id: string
  createdAt: string
  source: string
  summary: string
}

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

/** 成长记录时间线 — 只要有摘要就展示，涵盖对局/私聊/复盘/学习等全部交互 */
export function isGrowthLogSnapshot(snapshot: CharacterGrowthSnapshot): boolean {
  return Boolean(sanitizeGrowthSummary(snapshot.summary))
}

export function growthRecordSourceLabel(source: CharacterGrowthRecord['source']): string {
  return source === 'chat' ? '私聊沉淀' : '复盘领悟'
}

export function buildCharacterGrowthLogItems(
  snapshots: CharacterGrowthSnapshot[],
  records: CharacterGrowthRecord[] = [],
  behaviorChanges: BehaviorChangeRecord[] = [],
): CharacterGrowthLogItem[] {
  const items: CharacterGrowthLogItem[] = []

  for (const snapshot of snapshots.filter(isGrowthLogSnapshot)) {
    items.push({
      id: `snap-${snapshot.id}`,
      createdAt: snapshot.createdAt,
      source: growthSourceLabel(snapshot.source),
      summary: formatLessonFromSnapshot(snapshot),
    })
  }

  for (const record of records) {
    const summary = sanitizeGrowthSummary(record.summary)
    if (!summary) continue
    items.push({
      id: `rec-${record.id}`,
      createdAt: record.createdAt,
      source: growthRecordSourceLabel(record.source),
      summary,
    })
  }

  for (const change of behaviorChanges) {
    const summary = sanitizeGrowthSummary(change.summary)
    if (!summary) continue
    items.push({
      id: `beh-${change.id}`,
      createdAt: change.createdAt,
      source: '行为调整',
      summary,
    })
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
