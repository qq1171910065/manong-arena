import { join } from 'node:path'
import { BrowserWindow, ipcMain, app } from 'electron'
import { appIconOptions } from './app-icon'

export type AppWindowKind = 'login' | 'main' | 'match-room'

const windowKinds = new WeakMap<BrowserWindow, AppWindowKind>()
const matchRoomWindows = new Map<string, BrowserWindow>()

function preloadPath(): string {
  return join(__dirname, '../preload/index.js')
}

function loadRenderer(win: BrowserWindow, hash = ''): void {
  const hashPart = hash ? `#${hash.startsWith('/') ? hash : `/${hash}`}` : ''
  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hashPart}`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'), { hash: hash.replace(/^#?\/?/, '') })
  }
}

export function tagWindowKind(win: BrowserWindow, kind: AppWindowKind): void {
  windowKinds.set(win, kind)
}

export function getWindowKind(win: BrowserWindow | null): AppWindowKind {
  if (!win) return 'main'
  return windowKinds.get(win) || 'main'
}

export function getMatchRoomWindow(matchId: string): BrowserWindow | null {
  const win = matchRoomWindows.get(matchId)
  return win && !win.isDestroyed() ? win : null
}

export function closeMatchRoomWindow(matchId: string): void {
  const win = getMatchRoomWindow(matchId)
  if (win && !win.isDestroyed()) win.close()
}

export function closeAllMatchRoomWindows(): void {
  for (const matchId of [...matchRoomWindows.keys()]) {
    closeMatchRoomWindow(matchId)
  }
}

export function createMatchRoomWindow(
  matchId: string,
  opts?: { onLastClosed?: () => void }
): BrowserWindow {
  const existing = getMatchRoomWindow(matchId)
  if (existing) {
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1200,
    minHeight: 720,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#eef0ff',
    autoHideMenuBar: true,
    ...appIconOptions(),
    webPreferences: {
      preload: preloadPath(),
      sandbox: false,
      contextIsolation: true,
    },
  })

  tagWindowKind(win, 'match-room')
  matchRoomWindows.set(matchId, win)

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    matchRoomWindows.delete(matchId)
    if (matchRoomWindows.size === 0) opts?.onLastClosed?.()
  })

  loadRenderer(win, `/match-room/${matchId}`)
  return win
}

export function registerMatchRoomWindowHandlers(deps: {
  hideMainWindowForMatch: () => void
  restoreMainWindowToHome: () => void
}): void {
  ipcMain.removeHandler('window:getKind')
  ipcMain.handle('window:getKind', (event): AppWindowKind => {
    const win = BrowserWindow.fromWebContents(event.sender)
    return getWindowKind(win)
  })

  ipcMain.removeHandler('arena:matchWindow:open')
  ipcMain.handle('arena:matchWindow:open', (_event, matchId: string) => {
    if (!matchId) return { ok: false, error: '缺少对局 ID' }
    createMatchRoomWindow(matchId, { onLastClosed: deps.restoreMainWindowToHome })
    deps.hideMainWindowForMatch()
    return { ok: true }
  })

  ipcMain.removeHandler('arena:matchWindow:close')
  ipcMain.handle('arena:matchWindow:close', (_event, matchId: string) => {
    closeMatchRoomWindow(matchId)
    return { ok: true }
  })

  ipcMain.removeHandler('arena:matchWindow:focusMain')
  ipcMain.handle('arena:matchWindow:focusMain', () => {
    deps.restoreMainWindowToHome()
    return { ok: true }
  })
}
