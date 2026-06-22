import { app, ipcMain, protocol, net } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

export function findDeeplinkInArgv(argv: string[]): string | null {
  for (const arg of argv) {
    if (arg.startsWith('mntools://')) {
      return arg
    }
  }
  return null
}

export function handleDeeplinkUrl(url: string, getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow()
  if (win) {
    win.webContents.send('deeplink:url', url)
  }
}

export function initDeeplinkProtocol(protocolName: string): void {
  protocol.handle(`${protocolName}`, (request) => {
    const url = request.url
    return net.fetch(url)
  })
}

export function registerDeeplinkHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.removeHandler('deeplink:register')
  ipcMain.handle('deeplink:register', (_event, protocolName: string): void => {
    initDeeplinkProtocol(protocolName)
  })
}
