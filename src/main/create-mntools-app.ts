import { app, BrowserWindow } from 'electron'
import { electronApp } from '@electron-toolkit/utils'
import { registerDevToolsIpc, registerWindowDevToolsShortcut } from './lib/devtools'
import { registerAssetPackScheme } from './lib/asset-pack'
import { ensureAppHomeDir } from './lib/app-home'
import {
  bootstrapWindows,
  registerModules,
  setAppConfig,
  getMainWindow,
  createMainWindow,
  createLoginWindow,
  cleanupModules,
} from './lib/window-manager'
import { findDeeplinkInArgv, handleDeeplinkUrl } from './lib/deeplink'
import type { MntoolsAppConfig } from '../shared/types'

export type { MntoolsAppConfig, MntoolsModuleId, LoginCapabilities } from '../shared/types'

export function createMntoolsApp(config: MntoolsAppConfig): void {
  registerAssetPackScheme()
  setAppConfig(config)

  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return
  }

  app.on('second-instance', (_event, argv) => {
    const deeplink = findDeeplinkInArgv(argv)
    if (deeplink) handleDeeplinkUrl(deeplink, getMainWindow)
    const win = getMainWindow() ?? createLoginWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  app.whenReady().then(async () => {
    electronApp.setAppUserModelId(`com.manongai.mntools.${config.appId}`)
    registerDevToolsIpc()
    app.on('browser-window-created', (_, window) => {
      registerWindowDevToolsShortcut(window)
    })

    registerModules(config)

    const appHome = ensureAppHomeDir(config.appId)
    console.log(`[app-home] ready: ${appHome}`)

    bootstrapWindows()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        bootstrapWindows()
      }
    })
  })

  app.on('window-all-closed', () => {
    cleanupModules()
    if (process.platform !== 'darwin') app.quit()
  })
}

