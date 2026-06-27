import { ipcMain, dialog, BrowserWindow } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

type FileDialogOptions = {
  filters?: Array<{ name: string; extensions: string[] }>
}

export function registerFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('file:open-dialog', async (_event, options?: FileDialogOptions) => {
    const win = getMainWindow()
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openFile'],
      filters: options?.filters,
    })
    if (result.canceled || !result.filePaths[0]) return { success: false, path: null }
    return { success: true, path: result.filePaths[0] }
  })

  ipcMain.handle('file:save-dialog', async (_event, defaultName?: string, options?: FileDialogOptions) => {
    const win = getMainWindow()
    const result = await dialog.showSaveDialog(win ?? undefined, {
      defaultPath: defaultName || 'untitled.txt',
      filters: options?.filters,
    })
    if (result.canceled || !result.filePath) return { success: false, path: null }
    return { success: true, path: result.filePath }
  })

  ipcMain.handle('file:read-text', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf8')
      return { success: true, content, name: path.basename(filePath) }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('file:write-text', async (_event, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf8')
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
