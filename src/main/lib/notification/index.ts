import { app, ipcMain, Notification } from 'electron'

export function registerNotificationHandlers(): void {
  ipcMain.handle('notification:send', (_event, payload: { title: string; body: string }) => {
    if (!Notification.isSupported()) {
      return { success: false, error: '当前系统不支持桌面通知' }
    }
    try {
      const notification = new Notification({
        title: payload.title || app.getName() || 'mntools',
        body: payload.body || '',
        silent: false,
      })
      notification.show()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
