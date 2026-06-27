import { BookOpen, Crown, Home, Settings, Swords } from 'lucide-vue-next'
import type { FeatureRegistry } from '@renderer/types/registry'

export const featureRegistry: FeatureRegistry = [
  {
    key: 'home',
    route: 'home',
    path: '/home',
    label: '首页',
    group: 'main',
    order: 1,
    icon: Home,
  },
  {
    key: 'characters',
    route: 'characters',
    path: '/characters',
    label: '角色库',
    group: 'main',
    order: 2,
    icon: Crown,
  },
  {
    key: 'game-modes',
    route: 'game-modes',
    path: '/game-modes',
    label: '玩法场景',
    group: 'main',
    order: 3,
    icon: Swords,
  },
  {
    key: 'match-records',
    route: 'match-records',
    path: '/match-records',
    label: '对局记录',
    group: 'main',
    order: 4,
    icon: BookOpen,
  },
  {
    key: 'settings-center',
    route: 'settings',
    path: '/settings/display',
    label: '设置中心',
    group: 'main',
    order: 5,
    icon: Settings,
  },
]
