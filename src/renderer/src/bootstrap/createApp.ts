import { Loader2 } from 'lucide-vue-next'
import { defineComponent, h, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import ImmersiveShell from '../layouts/ImmersiveShell.vue'
import PageViewHost from '../components/arena/PageViewHost.vue'
import LoginPage from '../pages/login/LoginPage.vue'
import StarterInitPage from '../pages/starter/StarterInitPage.vue'
import UserProfileSetupPage from '../pages/starter/UserProfileSetupPage.vue'
import UiProvider from '../ui/UiProvider.vue'
import { route, navigate } from '../router'
import { isPortalPath } from '../pages/settings/portal-routes'
import { refreshSessionFromStorage, ensureGatewayKey, getAppKeyName } from '../services'
import { resolveAuthPhase } from '../services/auth-session'
import { matchWindowService, settingsService, setArenaAudioHostWindow, unlockArenaAudio, loadGameModeOverrides, loadGameScenarios, needsStarterInit } from '../services/arena'
import { needsUserProfileSetup } from '../services/arena/user-profile-service'
import { isWebRuntime } from '../composables/useRuntime'
import { configureRuntime } from '../composables/runtime-config'
import { applyGeneralSettingsEffects } from '../composables/useGeneralSettings'
import { setupAppShortcuts } from './setupAppShortcuts'
import type { FeatureRegistry, RouteName } from '../types/registry'
import type { LoginCapabilities, ShellLayout, ShellStyle } from '@shared/types'
import type { ExampleModuleId } from '../composables/runtime-config'

export interface MntoolsRendererConfig {
  appName: string
  productCode?: string
  login: LoginCapabilities
  shellLayout?: ShellLayout
  shellStyle?: ShellStyle
  defaultHomePath?: string
  registry: FeatureRegistry
  pageLoaders: Partial<Record<RouteName, () => Promise<Component>>>
  homeComponent?: Component
  exampleModules?: ExampleModuleId[]
  appId?: string
  description?: string
  features?: Partial<import('../composables/runtime-config').AppFeatures>
}

export function createMntoolsApp(config: MntoolsRendererConfig) {
  configureRuntime({
    appId: config.appId ?? 'mntools-app',
    productCode: config.productCode ?? 'arena',
    displayName: config.appName,
    description: config.description ?? '',
    shellLayout: config.shellLayout ?? 'sidebar',
    exampleModules: config.exampleModules,
    features: config.features,
  })

  const defaultHomePath = config.defaultHomePath ?? '/home'

  return defineComponent({
    name: 'MntoolsRoot',
    setup() {
      const phase = ref<'boot' | 'login' | 'init' | 'profile' | 'main'>('boot')
      const windowKind = ref<'main' | 'match-room'>('main')
      const pageComponent = ref<Component | null>(null)
      const pageError = ref<string | null>(null)
      const pageLoading = ref(true)
      const pageKey = ref(route.value.path)
      const PAGE_REVEAL_MS = 320

      let teardownShortcuts: (() => void) | undefined

      function resolvePageLoaderName(path: string): RouteName {
        const pathname = path.split('?')[0] || '/home'
        if (pathname.startsWith('/character-detail/')) return 'character-detail'
        if (pathname.startsWith('/game-mode-detail/')) return 'game-mode-detail'
        if (pathname.startsWith('/match-detail/')) return 'match-detail'
        if (pathname.startsWith('/match-room/')) return 'match-room'
        if (pathname === '/profile' || pathname.startsWith('/profile/')) return 'profile'
        if (pathname === '/settings' || pathname.startsWith('/settings/')) return 'settings'
        return (pathname.split('/').filter(Boolean)[0] || 'home') as RouteName
      }

      async function enterMainShell() {
        if (route.value.name === 'login') navigate(defaultHomePath)
        await loadGameModeOverrides().catch((error) => console.warn('[game-modes] overrides load failed', error))
        await loadGameScenarios().catch((error) => console.warn('[game-scenarios] load failed', error))
        await loadPage(resolvePageLoaderName(route.value.path))
        void ensureGatewayKey(getAppKeyName()).catch((error) =>
          console.warn('[app-key] ensure failed', error)
        )
        if (!teardownShortcuts) teardownShortcuts = setupAppShortcuts()
      }

      async function maybeEnterMainShell() {
        if (await needsStarterInit()) {
          phase.value = 'init'
          return
        }
        if (await needsUserProfileSetup()) {
          phase.value = 'profile'
          return
        }
        await enterMainShell()
      }

      async function onStarterInitComplete() {
        if (await needsUserProfileSetup()) {
          phase.value = 'profile'
          return
        }
        phase.value = 'main'
        await loadGameModeOverrides().catch((error) => console.warn('[game-modes] overrides load failed', error))
        await loadGameScenarios().catch((error) => console.warn('[game-scenarios] load failed', error))
        await enterMainShell()
      }

      async function onUserProfileComplete() {
        phase.value = 'main'
        await enterMainShell()
      }

      async function syncAuthPhase() {
        phase.value = await resolveAuthPhase()
        if (phase.value === 'login') {
          navigate('/login')
        }
      }

      onMounted(async () => {
        applyGeneralSettingsEffects()
        windowKind.value = (await matchWindowService.getKind()) === 'match-room' ? 'match-room' : 'main'
        setArenaAudioHostWindow(windowKind.value)
        try {
          await settingsService.get()
        } catch (error) {
          console.warn('[arena-settings] load failed', error)
        }
        window.addEventListener('pointerdown', unlockArenaAudio, { once: true })
        window.addEventListener('keydown', unlockArenaAudio, { once: true })

        if (windowKind.value === 'match-room') {
          phase.value = 'main'
          await loadGameModeOverrides().catch((error) => console.warn('[game-modes] overrides load failed', error))
          await loadGameScenarios().catch((error) => console.warn('[game-scenarios] load failed', error))
          await loadPage(resolvePageLoaderName(route.value.path))
          return
        }

        await syncAuthPhase()

        if (phase.value === 'login') {
          navigate('/login')
          return
        }

        const refresh = await refreshSessionFromStorage()
        if (refresh === 'invalid') {
          const { handleAuthFailure } = await import('../services/auth-session')
          await handleAuthFailure()
          return
        }
        if (refresh === 'no_refresh_token') {
          if (isWebRuntime()) {
            await syncAuthPhase()
            if (phase.value === 'login') {
              navigate('/login')
              return
            }
          }
          return
        }
        await maybeEnterMainShell()
      })

      if (isWebRuntime()) {
        window.addEventListener('mntools:auth-phase', (ev) => {
          const next = (ev as CustomEvent<'login' | 'main'>).detail
          phase.value = next
          if (next === 'main') {
            void maybeEnterMainShell()
          } else {
            navigate('/login')
          }
        })
      }

      onUnmounted(() => {
        teardownShortcuts?.()
        window.removeEventListener('pointerdown', unlockArenaAudio)
        window.removeEventListener('keydown', unlockArenaAudio)
      })

      watch(
        () => route.value.path,
        (newPath, oldPath) => {
          if (phase.value === 'main' && route.value.name !== 'login') {
            const newPathname = newPath.split('?')[0]
            const oldPathname = oldPath?.split('?')[0] ?? ''
            if (
              pageComponent.value &&
              isPortalPath(newPathname) &&
              isPortalPath(oldPathname)
            ) {
              return
            }
            void loadPage(resolvePageLoaderName(newPath))
          }
        }
      )

      async function loadPage(name: RouteName) {
        if (name === 'login') return
        const startedAt = Date.now()
        const nextKey = route.value.path
        pageError.value = null
        pageLoading.value = true
        try {
          const loader = config.pageLoaders[name]
          if (loader) {
            const mod = await loader()
            pageComponent.value =
              mod && typeof mod === 'object' && 'default' in mod
                ? ((mod as { default: Component }).default ?? null)
                : (mod as Component)
          } else if (name === 'home' && config.homeComponent) {
            pageComponent.value = config.homeComponent
          } else {
            pageComponent.value = {
              render: () => h('div', { class: 'page empty-state' }, `\u9875\u9762 ${name} \u672a\u6ce8\u518c`),
            }
          }
          pageKey.value = nextKey
        } catch (error) {
          pageComponent.value = null
          pageError.value = error instanceof Error ? error.message : '\u9875\u9762\u52a0\u8f7d\u5931\u8d25'
        } finally {
          const elapsed = Date.now() - startedAt
          if (elapsed < PAGE_REVEAL_MS) {
            await new Promise((resolve) => window.setTimeout(resolve, PAGE_REVEAL_MS - elapsed))
          }
          pageLoading.value = false
        }
      }

      function renderPageHost() {
        return h(PageViewHost, {
          pageComponent: pageComponent.value,
          pageError: pageError.value,
          pageLoading: pageLoading.value,
          pageKey: pageKey.value,
          onRetry: () => void loadPage(resolvePageLoaderName(route.value.path)),
        })
      }

      return () =>
        h(UiProvider, null, () => {
          if (phase.value === 'boot') {
            return h('div', { class: 'page page-loading auth-boot', role: 'status', 'aria-live': 'polite' }, [
              h(Loader2, { size: 20, class: 'spin' }),
            ])
          }

          if (phase.value === 'login') {
            return h(LoginPage, {
              appName: config.appName,
              login: config.login,
              defaultHomePath,
            })
          }

          if (phase.value === 'init') {
            return h(StarterInitPage, {
              appName: config.appName,
              onComplete: () => void onStarterInitComplete(),
            })
          }

          if (phase.value === 'profile') {
            return h(UserProfileSetupPage, {
              appName: config.appName,
              onComplete: () => void onUserProfileComplete(),
            })
          }

          const pageContent = renderPageHost()

          if (windowKind.value === 'match-room') {
            return h('div', { class: 'match-room-root' }, [pageContent])
          }

          return h(
            ImmersiveShell,
            { appName: config.appName, registry: config.registry },
            { default: () => pageContent }
          )
        })
    },
  })
}

export { navigate, route }


