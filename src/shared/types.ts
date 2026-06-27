export type MntoolsModuleId =
  | 'request'
  | 'sse'
  | 'file'
  | 'notification'
  | 'storage'
  | 'database'
  | 'bus'
  | 'clipboard'
  | 'shell'
  | 'shortcut'
  | 'window'
  | 'screenshot'
  | 'print'
  | 'worker'
  | 'tray'
  | 'updater'
  | 'deeplink'

export interface AppFeatures {
  tray?: boolean
  autoUpdate?: boolean
  i18n?: boolean
  deeplink?: boolean
}

export type ShellLayout = 'compact' | 'sidebar'

export type ShellStyle = 'flat' | 'grouped'

export interface LoginCapabilities {
  emailCode: boolean
  password: boolean
  wechatOAuth: boolean
}

export interface MntoolsAppConfig {
  appId: string
  appName: string
  modules: MntoolsModuleId[]
  login: LoginCapabilities
  shellLayout?: ShellLayout
  shellStyle?: ShellStyle
  defaultHomePath?: string
  features?: AppFeatures
  deeplinkProtocol?: string
}

export interface PortalSession {
  token: string
  refreshToken: string
  expire: number
  refreshExpire: number
  name: string
  username: string
  email: string
  customerId: number | null
  needsEmailBind?: boolean
  emailVerified?: boolean
  gatewayReady?: boolean
}
