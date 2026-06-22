import { app, ipcMain } from 'electron'

export function registerAppSettingsHandlers(): void {
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
}
