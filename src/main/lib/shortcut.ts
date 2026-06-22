import { globalShortcut } from 'electron'
import type { BrowserWindow } from 'electron'

export function registerShortcutHandlers(getMainWindow: () => BrowserWindow | null): void {
  // Placeholder for global shortcuts
}

export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll()
}
