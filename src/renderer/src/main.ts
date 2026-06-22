import { createApp } from 'vue'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@renderer/styles/tokens.css'
import '@renderer/styles/shell.css'
import '@renderer/styles/themes-bundle.css'
import './styles/theme-overrides.css'
import './styles/app.css'
import './styles/agent-arena.css'
import './styles/login-arena.css'

import { createMntoolsApp as createRoot } from '@renderer/bootstrap/createApp'
import { applyTheme, getStoredThemeId } from '@renderer/composables/useTheme'
import { appConfig } from './app.config'
import { featureRegistry } from './data/feature-registry'
import { pageLoaders } from './data/page-loaders'
import HomePage from './pages/HomePage.vue'

applyTheme(getStoredThemeId(appConfig.themeId), appConfig.themeId)

const Root = createRoot({
  appName: appConfig.displayName,
  appId: appConfig.appId,
  description: appConfig.description,
  themeId: appConfig.themeId,
  login: appConfig.login,
  shellLayout: appConfig.shellLayout,
  shellStyle: appConfig.shellStyle,
  defaultHomePath: appConfig.defaultHomePath,
  features: appConfig.features,
  exampleModules: appConfig.exampleModules,
  registry: featureRegistry,
  pageLoaders,
  homeComponent: HomePage,
})

createApp(Root).mount('#app')
