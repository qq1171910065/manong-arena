import { app, BrowserWindow, ipcMain } from 'electron'

export function focusDevToolsWindow(parent: BrowserWindow): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win === parent || win.isDestroyed()) continue
    const url = win.webContents.getURL()
    if (url.startsWith('devtools://')) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
      return
    }
  }
}

export function toggleWindowDevTools(win: BrowserWindow | null | undefined): boolean {
  if (!win || win.isDestroyed() || app.isPackaged) return false
  if (win.webContents.isDevToolsOpened()) {
    win.webContents.closeDevTools()
    return false
  }
  win.webContents.openDevTools({ mode: 'detach', activate: true })
  win.webContents.once('devtools-opened', () => focusDevToolsWindow(win))
  return true
}

export function registerWindowDevToolsShortcut(win: BrowserWindow): void {
  if (app.isPackaged) return
  const { webContents } = win
  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    const isF12 = input.code === 'F12'
    const isCtrlShiftI = input.code === 'KeyI' && (input.control || input.meta) && input.shift
    if (isF12 || isCtrlShiftI) {
      event.preventDefault()
      toggleWindowDevTools(win)
      return
    }
    if (input.code === 'KeyR' && (input.control || input.meta)) event.preventDefault()
    if (input.code === 'Minus' && (input.control || input.meta)) event.preventDefault()
    if (input.code === 'Equal' && input.shift && (input.control || input.meta)) event.preventDefault()
  })
}

export function registerDevToolsIpc(): void {
  ipcMain.removeHandler('window:toggleDevTools')
  ipcMain.handle('window:toggleDevTools', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const opened = toggleWindowDevTools(win)
    return { ok: true, opened }
  })
}
