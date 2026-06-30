import type { Component } from 'vue'
import type { MntoolsModuleId } from '@shared/types'

export type RouteName =
  | 'home'
  | 'login'
  | 'profile'
  | 'settings'
  | 'examples'
  | 'showcase'
  | 'characters'
  | 'character-detail'
  | 'game-modes'
  | 'game-mode-detail'
  | 'create-match'
  | 'match-room'
  | 'match-records'
  | 'match-detail'
  | 'collection'
  | 'dev-assets'

export type FeatureGroupId = 'main' | 'design' | 'examples' | 'account' | 'settings'

export interface FeatureRegistryItem {
  key: string
  route: RouteName
  path: string
  label: string
  group: FeatureGroupId
  order: number
  icon?: Component
  badge?: string | number
  module?: MntoolsModuleId
}

export interface FeatureRegistryGroup {
  id: FeatureGroupId
  label: string
  items: FeatureRegistryItem[]
}

export type FeatureRegistry = FeatureRegistryItem[]

/** 侧栏底部固定分组 */
export const SIDEBAR_FOOTER_GROUPS: FeatureGroupId[] = ['settings']

export function isSidebarFooterGroup(id: FeatureGroupId): boolean {
  return SIDEBAR_FOOTER_GROUPS.includes(id)
}

const GROUP_LABELS: Record<FeatureGroupId, string> = {
  main: '主功能',
  design: '设计系统',
  examples: '功能示例',
  account: '账户',
  settings: '设置',
}

export function groupRegistry(items: FeatureRegistry): FeatureRegistryGroup[] {
  const order: FeatureGroupId[] = ['main', 'design', 'examples', 'account', 'settings']
  const groups: FeatureRegistryGroup[] = order.map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: [],
  }))
  for (const item of [...items].sort((a, b) => a.order - b.order)) {
    const g = groups.find((x) => x.id === item.group)
    if (g) g.items.push(item)
  }
  return groups.filter((g) => g.items.length > 0)
}

export function findRegistryItem(items: FeatureRegistry, path: string): FeatureRegistryItem | undefined {
  const pathname = path.split('?')[0]
  return items.find((i) => i.path === pathname || i.path === pathname.replace(/\/$/, ''))
}
