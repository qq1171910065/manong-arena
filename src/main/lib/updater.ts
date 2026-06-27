import { app, ipcMain } from 'electron'
import { registerClientUpdateHandlers } from './client-update'

export function registerUpdaterHandlers(): void {
  ipcMain.removeHandler('app:get-runtime-meta')
  ipcMain.handle('app:get-runtime-meta', () => ({
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
  }))

  registerClientUpdateHandlers(() => {
    app.quit()
  })
}
