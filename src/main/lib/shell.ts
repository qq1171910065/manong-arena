import { ipcMain, shell } from 'electron'

export function registerShellHandlers(): void {
  ipcMain.removeHandler('shell:open')
  ipcMain.handle('shell:open', (_event, url: string): void => {
    shell.openExternal(url)
  })
}
