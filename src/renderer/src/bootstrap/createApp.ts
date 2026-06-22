import { Loader2 } from 'lucide-vue-next'
import { defineComponent, h, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import ImmersiveShell from '../layouts/ImmersiveShell.vue'
import PageViewHost from '../components/arena/PageViewHost.vue'
import LoginPage from '../pages/login/LoginPage.vue'
import UiProvider from '../ui/UiProvider.vue'
import { route, navigate } from '../router'
import { applyTheme, getStoredThemeId } from '../composables/useTheme'
import { refreshSessionFromStorage, ensureGatewayKey, getAppKeyName } from '../services'
import { resolveAuthPhase } from '../services/auth-session'
import { matchWindowService, settingsService, unlockArenaAudio, loadGameModeOverrides } from '../services/arena'
import { isWebRuntime } from '../composables/useRuntime'
import { configureRuntime } from '../composables/runtime-config'
import { applyGeneralSettingsEffects } from '../composables/useGeneralSettings'
import { setupAppShortcuts } from './setupAppShortcuts'
import type { FeatureRegistry, RouteName } from '../types/registry'
import type { LoginCapabilities, ShellLayout, ShellStyle, ThemeId } from '@shared/types'
import type { ExampleModuleId } from '../composables/runtime-config'

export interface MntoolsRendererConfig {
  appName: string
  themeId: ThemeId
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
    displayName: config.appName,
    description: config.description ?? '',
    themeId: config.themeId,
    shellLayout: config.shellLayout ?? 'sidebar',
    exampleModules: config.exampleModules,
    features: config.features,
  })

  const defaultHomePath = config.defaultHomePath ?? '/home'

  return defineComponent({
    name: 'MntoolsRoot',
    setup() {
      const phase = ref<'boot' | 'login' | 'main'>('boot')
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
        if (pathname.startsWith('/character-edit/')) return 'character-edit'
        if (pathname.startsWith('/game-mode-detail/')) return 'game-mode-detail'
        if (pathname.startsWith('/game-mode-edit/')) return 'game-mode-edit'
        if (pathname.startsWith('/match-detail/')) return 'match-detail'
        if (pathname.startsWith('/match-room/')) return 'match-room'
        return (pathname.split('/').filter(Boolean)[0] || 'home') as RouteName
      }

      async function enterMainShell() {
        if (route.value.name === 'login') navigate(defaultHomePath)
        await loadGameModeOverrides().catch((error) => console.warn('[game-modes] overrides load failed', error))
        await loadPage(resolvePageLoaderName(route.value.path))
        void ensureGatewayKey(getAppKeyName()).catch((error) =>
          console.warn('[app-key] ensure failed', error)
        )
        if (!teardownShortcuts) teardownShortcuts = setupAppShortcuts()
      }

      async function syncAuthPhase() {
        phase.value = await resolveAuthPhase()
        if (phase.value === 'login') {
          navigate('/login')
        }
      }

      onMounted(async () => {
        applyGeneralSettingsEffects()
        try {
          await settingsService.get()
        } catch (error) {
          console.warn('[arena-settings] load failed', error)
          applyTheme(getStoredThemeId(config.themeId), config.themeId)
        }
        window.addEventListener('pointerdown', unlockArenaAudio, { once: true })
        window.addEventListener('keydown', unlockArenaAudio, { once: true })

        windowKind.value = (await matchWindowService.getKind()) === 'match-room' ? 'match-room' : 'main'
        if (windowKind.value === 'match-room') {
          phase.value = 'main'
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
          await window.api.logout()
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
        await enterMainShell()
      })

      if (isWebRuntime()) {
        window.addEventListener('mntools:auth-phase', (ev) => {
          const next = (ev as CustomEvent<'login' | 'main'>).detail
          phase.value = next
          if (next === 'main') {
            void enterMainShell()
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
        () => {
          if (phase.value === 'main' && route.value.name !== 'login') {
            void loadPage(resolvePageLoaderName(route.value.path))
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


