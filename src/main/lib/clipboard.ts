import { ipcMain, clipboard } from 'electron'

export function registerClipboardHandlers(): void {
  ipcMain.removeHandler('clipboard:read')
  ipcMain.handle('clipboard:read', (): string => {
    return clipboard.readText()
  })

  ipcMain.removeHandler('clipboard:write')
  ipcMain.handle('clipboard:write', (_event, text: string): void => {
    clipboard.writeText(text)
  })
}
