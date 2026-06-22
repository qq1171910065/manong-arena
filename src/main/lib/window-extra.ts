import { BrowserWindow, ipcMain } from 'electron'

function senderWindow(event: Electron.IpcMainInvokeEvent): BrowserWindow | null {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win && !win.isDestroyed() ? win : null
}

export function registerWindowExtraHandlers(): void {
  ipcMain.removeHandler('window:set-always-on-top')
  ipcMain.handle('window:set-always-on-top', (event, flag?: boolean) => {
    const win = senderWindow(event)
    if (!win) return false
    win.setAlwaysOnTop(Boolean(flag))
    return win.isAlwaysOnTop()
  })

  ipcMain.removeHandler('window:set-opacity')
  ipcMain.handle('window:set-opacity', (event, opacity?: number) => {
    const win = senderWindow(event)
    if (!win) return false
    const value = Math.min(1, Math.max(0.1, Number(opacity) || 1))
    win.setOpacity(value)
    return true
  })

  ipcMain.removeHandler('window:get-bounds')
  ipcMain.handle('window:get-bounds', (event) => {
    const win = senderWindow(event)
    return win?.getBounds() ?? null
  })

  ipcMain.removeHandler('window:center')
  ipcMain.handle('window:center', (event) => {
    const win = senderWindow(event)
    if (!win) return false
    win.center()
    return true
  })
}
