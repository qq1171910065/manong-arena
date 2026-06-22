import type { ShellLayout, ThemeId } from '@shared/types'

export type ExampleModuleId =
  | 'stream-demo'
  | 'file-demo'
  | 'db-demo'
  | 'notify-demo'
  | 'storage-demo'
  | 'bus-demo'
  | 'clipboard-demo'
  | 'shell-demo'
  | 'shortcut-demo'
  | 'tray-demo'
  | 'window-demo'
  | 'screenshot-demo'
  | 'print-demo'
  | 'worker-demo'
  | 'protocol-demo'

export interface AppFeatures {
  showcase: boolean
  platform: boolean
  tray: boolean
  autoUpdate: boolean
  i18n: boolean
  deeplink: boolean
}

export interface RuntimeConfig {
  appId: string
  displayName: string
  description: string
  themeId: ThemeId
  shellLayout: ShellLayout
  exampleModules: ExampleModuleId[]
  features: AppFeatures
}

export type RuntimeConfigInput = Partial<Omit<RuntimeConfig, 'features'>> & {
  features?: Partial<AppFeatures>
}

const DEFAULT_FEATURES: AppFeatures = {
  showcase: true,
  platform: true,
  tray: false,
  autoUpdate: false,
  i18n: false,
  deeplink: false,
}

const DEFAULT_EXAMPLE_MODULES: ExampleModuleId[] = [
  'stream-demo',
  'file-demo',
  'db-demo',
  'notify-demo',
  'storage-demo',
  'bus-demo',
  'clipboard-demo',
  'shell-demo',
  'shortcut-demo',
  'tray-demo',
  'window-demo',
  'screenshot-demo',
  'print-demo',
  'worker-demo',
  'protocol-demo',
]

let runtimeConfig: RuntimeConfig = {
  appId: 'mntools-app',
  displayName: 'Mntools App',
  description: 'Electron desktop tool',
  themeId: 'enterprise-light',
  shellLayout: 'sidebar',
  exampleModules: DEFAULT_EXAMPLE_MODULES,
  features: { ...DEFAULT_FEATURES },
}

export function configureRuntime(partial: RuntimeConfigInput): void {
  runtimeConfig = {
    ...runtimeConfig,
    ...partial,
    shellLayout: partial.shellLayout ?? runtimeConfig.shellLayout,
    exampleModules:
      partial.exampleModules !== undefined ? partial.exampleModules : runtimeConfig.exampleModules,
    features: partial.features ? { ...runtimeConfig.features, ...partial.features } : runtimeConfig.features,
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  return runtimeConfig
}

export function getAppFeatures(): AppFeatures {
  return runtimeConfig.features
}
