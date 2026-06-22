import { Tray, Menu } from 'electron'
import type { BrowserWindow } from 'electron'
import { join } from 'node:path'

let tray: Tray | null = null
let hideOnClose = false

export function registerTrayHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Placeholder for tray handlers
}

export function shouldHideMainWindowOnClose(): boolean {
  return hideOnClose
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
