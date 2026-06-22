import type { RouteName } from '@renderer/types/registry'
import type { Component } from 'vue'

export const pageLoaders: Partial<Record<RouteName, () => Promise<Component>>> = {
  home: () => import('@renderer/pages/HomePage.vue'),
  characters: () => import('@renderer/pages/CharactersPage.vue'),
  'character-detail': () => import('@renderer/pages/CharacterDetailPage.vue'),
  'character-edit': () => import('@renderer/pages/CharacterEditPage.vue'),
  'game-modes': () => import('@renderer/pages/GameModesPage.vue'),
  'game-mode-detail': () => import('@renderer/pages/GameModeDetailPage.vue'),
  'game-mode-edit': () => import('@renderer/pages/GameModeEditPage.vue'),
  'create-match': () => import('@renderer/pages/CreateMatchPage.vue'),
  'match-room': () => import('@renderer/pages/MatchRoomPage.vue'),
  'match-records': () => import('@renderer/pages/MatchRecordsPage.vue'),
  'match-detail': () => import('@renderer/pages/MatchDetailPage.vue'),
  profile: () => import('@renderer/pages/settings/ProfilePage.vue'),
  settings: () => import('@renderer/pages/settings/ProfilePage.vue'),
}
