import { app, ipcMain } from 'electron'
import { getAppHomePaths } from '../app-home'

export function registerAppSettingsHandlers(appId = 'com.agentarena'): void {
  ipcMain.handle('app:get-login-item-settings', () => {
    try {
      const settings = app.getLoginItemSettings()
      return { ok: true, openAtLogin: settings.openAtLogin, openAsHidden: settings.openAsHidden }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('app:set-login-item-settings', (_event, openAtLogin?: boolean) => {
    try {
      app.setLoginItemSettings({ openAtLogin: Boolean(openAtLogin), openAsHidden: false })
      const settings = app.getLoginItemSettings()
      return { ok: true, openAtLogin: settings.openAtLogin }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('app:get-version', () => ({ ok: true, version: app.getVersion() }))

  ipcMain.handle('app:get-data-dirs', () => {
    try {
      return { ok: true, dirs: getAppHomePaths(appId) }
    } catch (err) {
      return { ok: false, error: (err as Error).message }
    }
  })
}
