/// <reference types="vite/client" />

declare module '*.md?raw' {
  const content: string
  export default content
}

import type { MntoolsApi } from '../../preload/domains'
import type { ArenaApi } from '@renderer/types/arena-api'

declare global {
  interface Window {
    electron: typeof import('@electron-toolkit/preload').electronAPI
    api: MntoolsApi & ArenaApi
    windowControls: {
      minimize: () => Promise<void>
      maximize: () => Promise<boolean>
      isMaximized: () => Promise<boolean>
      close: () => Promise<void>
      hide: () => Promise<void>
      quit: () => Promise<void>
      onMaximizedChanged: (callback: (maximized: boolean) => void) => () => void
    }
  }
}

export {}
