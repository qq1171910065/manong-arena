import type { ExampleModuleId } from '@renderer/composables/runtime-config'
import type { LoginCapabilities, ShellLayout, ShellStyle, ThemeId } from '@shared/types'

export const appConfig = {
  appId: 'com.agentarena',
  displayName: 'Agent Arena',
  description: '养成你的 AI 角色，让他们一起玩规则化社交游戏',
  themeId: 'enterprise-light' as ThemeId,
  shellLayout: 'compact' as ShellLayout,
  shellStyle: 'grouped' as ShellStyle,
  defaultHomePath: '/home',
  exampleModules: ["stream-demo","file-demo","notify-demo"] as ExampleModuleId[],
  features: {
    "showcase": false,
    "platform": true,
    "tray": false,
    "autoUpdate": false,
    "i18n": false,
    "deeplink": false
  } as const,
  login: {
    emailCode: true,
    password: true,
    wechatOAuth: true,
  } satisfies LoginCapabilities,
}
