import { BrowserWindow, ipcMain, app, dialog } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { hasStoredSession, setStoredSession } from './auth-session'
import { registerAuthHandlers } from './auth-ipc'
import { registerRequestHandlers } from './request'
import { registerSseHandlers } from './sse'
import { registerFileHandlers } from './file'
import { registerNotificationHandlers } from './notification'
import { registerStorageHandlers } from './storage'
import { registerDatabaseHandlers, closeDatabase } from './database'
import { registerBusHandlers } from './bus'
import { registerClipboardHandlers } from './clipboard'
import { registerShellHandlers } from './shell'
import { registerShortcutHandlers, unregisterAllShortcuts } from './shortcut'
import { registerAppSettingsHandlers } from './app-settings'
import { registerWindowExtraHandlers } from './window-extra'
import { registerScreenshotHandlers } from './screenshot'
import { registerPrintHandlers } from './print'
import { registerWorkerHandlers } from './worker'
import { registerTrayHandlers, shouldHideMainWindowOnClose, destroyTray } from './tray'
import { registerUpdaterHandlers } from './updater'
import { registerDeeplinkHandlers, initDeeplinkProtocol } from './deeplink'
import { closeDebugProbe, registerDebugProbe } from './debug-probe'
import { registerArenaHandlers, flushArenaStore } from './arena/ipc'
import {
  registerMatchRoomWindowHandlers,
  tagWindowKind,
} from './match-room-window'
import type { MntoolsAppConfig, MntoolsModuleId, PortalSession } from '../shared/types'

export type WindowPhase = 'login' | 'main'

let loginWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
let appConfig: MntoolsAppConfig | null = null
let onLoginSuccessCallback: ((session: PortalSession) => void) | null = null

export function getMainWindow(): BrowserWindow | null {
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : null
}

export function getLoginWindow(): BrowserWindow | null {
  return loginWindow && !loginWindow.isDestroyed() ? loginWindow : null
}

export function getActiveRendererWindow(): BrowserWindow | null {
  return getMainWindow() ?? getLoginWindow()
}

function preloadPath(): string {
  const resolved = join(__dirname, '../preload/index.js')
  if (!existsSync(resolved)) {
    console.error(`[mntools] preload not found: ${resolved}. Please restart dev after rebuilding preload.`)
  }
  return resolved
}

function loadRenderer(win: BrowserWindow, hash = ''): void {
  const hashPart = hash ? `#${hash.startsWith('/') ? hash : `/${hash}`}` : ''
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hashPart}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.replace(/^#?\/?/, '') })
  }
}

function registerWindowControls(): void {
  ipcMain.removeHandler('window:minimize')
  ipcMain.handle('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.removeHandler('window:maximize')
  ipcMain.handle('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return false
    if (win.isMaximizable()) {
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    }
    return win.isMaximized()
  })

  ipcMain.removeHandler('window:is-maximized')
  ipcMain.handle('window:is-maximized', (event) =>
    Boolean(BrowserWindow.fromWebContents(event.sender)?.isMaximized())
  )

  ipcMain.removeHandler('window:close')
  ipcMain.handle('window:close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win === loginWindow) {
      app.quit()
      return
    }
    if (win === mainWindow && shouldHideMainWindowOnClose()) {
      win.hide()
      return
    }
    win.close()
  })

  ipcMain.removeHandler('window:hide')
  ipcMain.handle('window:hide', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.hide()
  })

  ipcMain.removeHandler('window:quit')
  ipcMain.handle('window:quit', () => {
    app.quit()
  })

  ipcMain.removeHandler('window:getPhase')
  ipcMain.handle('window:getPhase', (event): WindowPhase => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win === loginWindow) return 'login'
    return 'main'
  })
}

async function confirmMainWindowClose(): Promise<boolean> {
  const win = getMainWindow()
  if (!win) return true
  const hideToTray = shouldHideMainWindowOnClose()
  const result = await dialog.showMessageBox(win, {
    type: 'question',
    buttons: ["取消", hideToTray ? "隐藏到托盘" : "关闭"],
    defaultId: 0,
    cancelId: 0,
    title: "关闭 Agent Arena",
    message: "确认关闭主窗口？",
    detail: hideToTray
      ? "应用会继续在托盘运行，正在进行的对局窗口不会被强制关闭。"
      : "主窗口将关闭，正在进行的对局窗口不会被强制关闭。",
    noLink: true,
  })
  return result.response === 1
}

async function requestMainWindowClose(): Promise<void> {
  const win = getMainWindow()
  if (!win) return
  if (!(await confirmMainWindowClose())) return
  if (shouldHideMainWindowOnClose()) {
    win.hide()
    return
  }
  mainWindowCloseConfirmed = true
  win.close()
}

function closeMainWindowWithoutConfirm(): void {
  const win = getMainWindow()
  if (!win) return
  mainWindowCloseConfirmed = true
  win.close()
}

export function createLoginWindow(): BrowserWindow {
  if (getLoginWindow()) return getLoginWindow()!

  loginWindow = new BrowserWindow({
    width: 780,
    height: 560,
    resizable: false,
    maximizable: false,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f1edff',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
    },
  })

  loginWindow.on('ready-to-show', () => loginWindow?.show())
  loginWindow.on('closed', () => {
    loginWindow = null
    if (!getMainWindow()) app.quit()
  })

  loadRenderer(loginWindow, '/login')
  tagWindowKind(loginWindow, 'login')
  return loginWindow
}

export function createMainWindow(): BrowserWindow {
  if (getMainWindow()) return getMainWindow()!

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1600,
    minHeight: 1000,
    maxWidth: 1600,
    maxHeight: 1000,
    resizable: false,
    maximizable: false,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
    },
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  const notifyMaximized = (): void => {
    const win = getMainWindow()
    if (!win) return
    win.webContents.send('window:maximized-changed', win.isMaximized())
  }
  mainWindow.on('maximize', notifyMaximized)
  mainWindow.on('unmaximize', notifyMaximized)

  mainWindow.on('close', (event) => {
    if (shouldHideMainWindowOnClose()) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
    void flushArenaStore()
    closeDatabase()
  })

  const home = appConfig?.defaultHomePath || '/home'
  loadRenderer(mainWindow, home)
  tagWindowKind(mainWindow, 'main')
  return mainWindow
}

export function openMainAfterLogin(session: PortalSession): void {
  setStoredSession(session)
  onLoginSuccessCallback?.(session)

  const login = getLoginWindow()
  createMainWindow()
  if (login && !login.isDestroyed()) login.close()
}

export function registerLoginSuccessHandler(): void {
  ipcMain.removeHandler('auth:openMain')
  ipcMain.handle('auth:openMain', (_event, session: PortalSession) => {
    openMainAfterLogin(session)
    return { ok: true }
  })

  ipcMain.removeHandler('auth:logout')
  ipcMain.handle('auth:logout', () => {
    setStoredSession(null)
    const main = getMainWindow()
    if (main && !main.isDestroyed()) main.close()
    createLoginWindow()
    return { ok: true }
  })
}

export function registerModules(config: MntoolsAppConfig): void {
  const modules = new Set<MntoolsModuleId>(config.modules)
  registerAuthHandlers()
  registerLoginSuccessHandler()
  registerWindowControls()
  registerAppSettingsHandlers()
  registerArenaHandlers(config.appId)
  registerMatchRoomWindowHandlers(() => getMainWindow())
  registerDebugProbe(() => getActiveRendererWindow())

  if (modules.has('request') || modules.has('sse') || true) {
    registerRequestHandlers()
  }
  if (modules.has('sse')) {
    registerSseHandlers(() => getActiveRendererWindow())
  }
  if (modules.has('file')) {
    registerFileHandlers(() => getMainWindow())
  }
  if (modules.has('notification')) {
    registerNotificationHandlers()
  }
  if (modules.has('storage')) {
    registerStorageHandlers(config.appId)
  }
  if (modules.has('database')) {
    registerDatabaseHandlers(config.appId)
  }
  if (modules.has('bus')) {
    registerBusHandlers()
  }
  if (modules.has('clipboard')) {
    registerClipboardHandlers()
  }
  if (modules.has('shell')) {
    registerShellHandlers()
  }
  if (modules.has('shortcut')) {
    registerShortcutHandlers(() => getMainWindow())
  }
  if (modules.has('window')) {
    registerWindowExtraHandlers()
  }
  if (modules.has('screenshot')) {
    registerScreenshotHandlers()
  }
  if (modules.has('print')) {
    registerPrintHandlers()
  }
  if (modules.has('worker')) {
    registerWorkerHandlers()
  }
  if (modules.has('tray') || config.features?.tray) {
    registerTrayHandlers(() => getMainWindow())
  }
  if (modules.has('updater') || config.features?.autoUpdate) {
    registerUpdaterHandlers()
  }
  if (modules.has('deeplink') || config.features?.deeplink) {
    const protocol = config.deeplinkProtocol || config.appId.split('.').pop() || 'mntools'
    initDeeplinkProtocol(protocol)
    registerDeeplinkHandlers(() => getMainWindow())
  }
}

export function cleanupModules(): void {
  unregisterAllShortcuts()
  closeDebugProbe()
  destroyTray()
}

export function bootstrapWindows(): void {
  if (hasStoredSession()) createMainWindow()
  else createLoginWindow()
}

export function setAppConfig(config: MntoolsAppConfig): void {
  appConfig = config
}

export function getAppConfig(): MntoolsAppConfig | null {
  return appConfig
}

export function onLoginSuccess(cb: (session: PortalSession) => void): void {
  onLoginSuccessCallback = cb
}
