import { Tray, Menu, app, ipcMain, nativeImage } from 'electron'
import type { WebContents } from 'electron'
import type { BrowserWindow } from 'electron'
import { resolveAppIcon } from './app-icon'

export type CloseBehavior = 'ask' | 'tray' | 'quit'

let tray: Tray | null = null
let closeBehavior: CloseBehavior = 'ask'
let isQuitting = false

export function setCloseBehavior(behavior: CloseBehavior): void {
  if (behavior === 'ask' || behavior === 'tray' || behavior === 'quit') {
    closeBehavior = behavior
  }
}

export function getCloseBehavior(): CloseBehavior {
  return closeBehavior
}

export function markAppQuitting(): void {
  isQuitting = true
}

export function isAppQuitting(): boolean {
  return isQuitting
}

/** @deprecated 使用 getCloseBehavior() === 'tray' */
export function shouldHideMainWindowOnClose(): boolean {
  return closeBehavior === 'tray'
}

function buildTrayIcon(): Electron.NativeImage {
  const iconPath = resolveAppIcon()
  if (!iconPath) return nativeImage.createEmpty()
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) return image
  if (process.platform === 'win32') {
    return image.resize({ width: 16, height: 16 })
  }
  if (process.platform === 'darwin') {
    image.setTemplateImage(true)
  }
  return image
}

function showMainWindow(getMainWindow: () => BrowserWindow | null): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  if (!win.isVisible()) win.show()
  if (win.isMinimized()) win.restore()
  win.focus()
}

function updateTrayMenu(getMainWindow: () => BrowserWindow | null): void {
  if (!tray || tray.isDestroyed()) return
  const menu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => showMainWindow(getMainWindow),
    },
    { type: 'separator' },
    {
      label: '退出 Manong Arena',
      click: () => {
        markAppQuitting()
        app.quit()
      },
    },
  ])
  tray.setContextMenu(menu)
}

export function ensureTray(getMainWindow: () => BrowserWindow | null): Tray | null {
  if (tray && !tray.isDestroyed()) {
    updateTrayMenu(getMainWindow)
    return tray
  }

  const icon = buildTrayIcon()
  if (icon.isEmpty()) {
    console.warn('[tray] icon not found, skip tray setup')
    return null
  }

  tray = new Tray(icon)
  tray.setToolTip('Manong Arena')
  updateTrayMenu(getMainWindow)
  tray.on('double-click', () => showMainWindow(getMainWindow))
  return tray
}

export async function handleMainWindowClose(getMainWindow: () => BrowserWindow | null): Promise<void> {
  if (isAppQuitting()) return

  const win = getMainWindow()
  if (!win || win.isDestroyed()) return

  const behavior = getCloseBehavior()

  if (behavior === 'tray') {
    ensureTray(getMainWindow)
    win.hide()
    return
  }

  if (behavior === 'quit') {
    markAppQuitting()
    app.quit()
    return
  }

  const choice = await requestCloseChoiceFromRenderer(win.webContents)
  if (choice === 'cancel') return

  if (choice === 'tray') {
    ensureTray(getMainWindow)
    win.hide()
    return
  }

  markAppQuitting()
  app.quit()
}

type CloseChoice = 'cancel' | 'tray' | 'quit'

function normalizeCloseChoice(raw: unknown): CloseChoice {
  if (raw === 'tray' || raw === 'quit') return raw
  return 'cancel'
}

async function requestCloseChoiceFromRenderer(webContents: WebContents): Promise<CloseChoice> {
  if (webContents.isDestroyed()) return 'cancel'

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      cleanup()
      resolve('cancel')
    }, 60_000)

    const handler = (_event: Electron.IpcMainInvokeEvent, choice: unknown) => {
      cleanup()
      resolve(normalizeCloseChoice(choice))
      return { ok: true }
    }

    function cleanup() {
      clearTimeout(timeout)
      ipcMain.removeHandler('window:close-choice-result')
    }

    ipcMain.handle('window:close-choice-result', handler)
    webContents.send('window:request-close-choice')
  })
}

export function registerTrayHandlers(getMainWindow: () => BrowserWindow | null): void {
  ensureTray(getMainWindow)

  ipcMain.removeHandler('tray:setup')
  ipcMain.handle('tray:setup', () => {
    ensureTray(getMainWindow)
    return { ok: true }
  })

  ipcMain.removeHandler('tray:set-hide-on-close')
  ipcMain.handle('tray:set-hide-on-close', (_event, value?: boolean) => {
    setCloseBehavior(value ? 'tray' : 'ask')
    return { ok: true, hideOnClose: value === true }
  })

  ipcMain.removeHandler('tray:get-hide-on-close')
  ipcMain.handle('tray:get-hide-on-close', () => ({
    ok: true,
    hideOnClose: closeBehavior === 'tray',
  }))

  ipcMain.removeHandler('tray:set-close-behavior')
  ipcMain.handle('tray:set-close-behavior', (_event, behavior: CloseBehavior) => {
    setCloseBehavior(behavior)
    return { ok: true, closeBehavior }
  })

  ipcMain.removeHandler('tray:get-close-behavior')
  ipcMain.handle('tray:get-close-behavior', () => ({
    ok: true,
    closeBehavior,
  }))
}

export function destroyTray(): void {
  if (tray && !tray.isDestroyed()) {
    tray.destroy()
  }
  tray = null
}
