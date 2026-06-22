import { app, BrowserWindow } from 'electron'
import { electronApp, optimizer } from '@electron-toolkit/utils'
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

export type { MntoolsAppConfig, MntoolsModuleId, ThemeId, LoginCapabilities } from '../shared/types'

export function createMntoolsApp(config: MntoolsAppConfig): void {
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

  app.whenReady().then(() => {
    electronApp.setAppUserModelId(`com.manongai.mntools.${config.appId}`)
    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerModules(config)
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

