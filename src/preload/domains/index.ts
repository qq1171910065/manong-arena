import { ipcRenderer } from 'electron'

export const requestDomain = {
  fetchUrl: (
    url: string,
    method?: string,
    headers?: Record<string, string>,
    body?: string,
    opts?: { timeoutMs?: number }
  ) =>
    ipcRenderer.invoke('request:fetch', {
      url,
      method,
      headers,
      body,
      timeoutMs: opts?.timeoutMs,
    }),

  fetchSSE: (payload: { url: string; method?: string; body?: string; token?: string; timeoutMs?: number }) =>
    ipcRenderer.invoke('request:fetch-sse', payload),

  cancelSSE: () => ipcRenderer.invoke('request:cancel-sse'),

  onSSEChunk: (callback: (chunk: string) => void) => {
    const handler = (_event: unknown, chunk: string) => callback(chunk)
    ipcRenderer.on('sse:chunk', handler)
    return () => ipcRenderer.removeListener('sse:chunk', handler)
  },

  onSSEEnd: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('sse:end', handler)
    return () => ipcRenderer.removeListener('sse:end', handler)
  },

  onSSEError: (callback: (error: string) => void) => {
    const handler = (_event: unknown, error: string) => callback(error)
    ipcRenderer.on('sse:error', handler)
    return () => ipcRenderer.removeListener('sse:error', handler)
  },
}

export const authDomain = {
  getSession: () => ipcRenderer.invoke('auth:getSession'),
  setSession: (session: unknown) => ipcRenderer.invoke('auth:setSession', session),
  clearSession: () => ipcRenderer.invoke('auth:clearSession'),
  openMain: (session: unknown) => ipcRenderer.invoke('auth:openMain', session),
  logout: () => ipcRenderer.invoke('auth:logout'),
  getPhase: () => ipcRenderer.invoke('window:getPhase') as Promise<'login' | 'main'>,
}

export const appDomain = {
  getLoginItemSettings: () =>
    ipcRenderer.invoke('app:get-login-item-settings') as Promise<{
      ok: boolean
      openAtLogin?: boolean
      openAsHidden?: boolean
      error?: string
    }>,
  setLoginItemSettings: (openAtLogin: boolean) =>
    ipcRenderer.invoke('app:set-login-item-settings', openAtLogin) as Promise<{
      ok: boolean
      openAtLogin?: boolean
      error?: string
    }>,
  getVersion: () => ipcRenderer.invoke('app:get-version') as Promise<{ ok: boolean; version?: string }>,
}

export const fileDomain = {
  openFileDialog: (options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('file:open-dialog', options),
  saveFileDialog: (defaultName?: string, options?: { filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('file:save-dialog', defaultName, options),
  readTextFile: (path: string) => ipcRenderer.invoke('file:read-text', path),
  writeTextFile: (path: string, content: string) => ipcRenderer.invoke('file:write-text', path, content),
}

export const notificationDomain = {
  sendNotification: (title: string, body: string) =>
    ipcRenderer.invoke('notification:send', { title, body }),
}

export const storageDomain = {
  storageInspect: () => ipcRenderer.invoke('storage:inspect'),
  storagePurge: (module: string) => ipcRenderer.invoke('storage:purge', { module }),
}

export const databaseDomain = {
  dbQuery: (sql: string, params?: unknown[]) => ipcRenderer.invoke('database:query', sql, params),
  dbExec: (sql: string, params?: unknown[]) => ipcRenderer.invoke('database:exec', sql, params),
}

export interface BusMessage {
  channel: string
  payload: unknown
  from: number
  timestamp: number
}

export const busDomain = {
  emit: (channel: string, payload: unknown) =>
    ipcRenderer.invoke('bus:emit', channel, payload) as Promise<{ ok: boolean; message?: BusMessage; error?: string }>,
  onMessage: (callback: (message: BusMessage) => void) => {
    const handler = (_event: unknown, message: BusMessage) => callback(message)
    ipcRenderer.on('bus:message', handler)
    return () => ipcRenderer.removeListener('bus:message', handler)
  },
}

export const clipboardDomain = {
  readClipboardText: () => ipcRenderer.invoke('clipboard:read-text') as Promise<{ ok: boolean; text?: string; error?: string }>,
  writeClipboardText: (text: string) => ipcRenderer.invoke('clipboard:write-text', text) as Promise<{ ok: boolean; error?: string }>,
  clipboardFormats: () => ipcRenderer.invoke('clipboard:formats') as Promise<{ ok: boolean; formats?: string[]; error?: string }>,
}

export const shellDomain = {
  openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url) as Promise<{ ok: boolean; error?: string }>,
  showItemInFolder: (path: string) => ipcRenderer.invoke('shell:show-item-in-folder', path) as Promise<{ ok: boolean; error?: string }>,
  openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path) as Promise<{ ok: boolean; error?: string }>,
}

export const clientUpdateDomain = {
  getRuntimeMeta: () =>
    ipcRenderer.invoke('app:get-runtime-meta') as Promise<{
      appVersion: string
      platform: string
      arch: string
      electronVersion: string
    }>,
  downloadAndInstallClientUpdate: (payload: { url: string; suggestedName?: string }) =>
    ipcRenderer.invoke('client-update:download-and-install', payload) as Promise<{
      success: boolean
      error?: string
    }>,
  onClientUpdateProgress: (
    callback: (payload: {
      phase: 'download' | 'install'
      percent?: number
      receivedBytes?: number
      totalBytes?: number | null
    }) => void
  ) => {
    const handler = (
      _event: unknown,
      data: {
        phase: 'download' | 'install'
        percent?: number
        receivedBytes?: number
        totalBytes?: number | null
      }
    ) => callback(data)
    ipcRenderer.on('client-update:progress', handler)
    return () => ipcRenderer.removeListener('client-update:progress', handler)
  },
}

export const shortcutDomain = {
  registerShortcut: (accelerator: string) =>
    ipcRenderer.invoke('shortcut:register', accelerator) as Promise<{ ok: boolean; error?: string }>,
  registerGlobalShortcut: (accelerator: string, action: 'toggle-window' | 'show-window') =>
    ipcRenderer.invoke('shortcut:register-global', { accelerator, action }) as Promise<{ ok: boolean; error?: string }>,
  unregisterGlobalShortcut: (action: 'toggle-window' | 'show-window') =>
    ipcRenderer.invoke('shortcut:unregister-global', action) as Promise<{ ok: boolean }>,
  unregisterShortcut: (accelerator: string) => ipcRenderer.invoke('shortcut:unregister', accelerator),
  unregisterAllShortcuts: () => ipcRenderer.invoke('shortcut:unregister-all'),
  listShortcuts: () => ipcRenderer.invoke('shortcut:list') as Promise<{ ok: boolean; accelerators?: string[] }>,
  onShortcutTriggered: (callback: (accelerator: string) => void) => {
    const handler = (_event: unknown, accelerator: string) => callback(accelerator)
    ipcRenderer.on('shortcut:triggered', handler)
    return () => ipcRenderer.removeListener('shortcut:triggered', handler)
  },
}

export const windowExtraDomain = {
  setAlwaysOnTop: (flag?: boolean) => ipcRenderer.invoke('window:set-always-on-top', flag),
  getWindowBounds: () => ipcRenderer.invoke('window:get-bounds'),
  centerWindow: () => ipcRenderer.invoke('window:center'),
  setWindowOpacity: (opacity?: number) => ipcRenderer.invoke('window:set-opacity', opacity),
}

export const screenshotDomain = {
  listCaptureSources: () => ipcRenderer.invoke('screenshot:list-sources'),
}

export const printDomain = {
  printDialog: () => ipcRenderer.invoke('print:dialog'),
  printToPdf: () => ipcRenderer.invoke('print:to-pdf') as Promise<{ ok: boolean; base64?: string; byteLength?: number; error?: string }>,
}

export const workerDomain = {
  workerHashText: (text: string) => ipcRenderer.invoke('worker:hash-text', text),
}

export const trayDomain = {
  setupTray: () => ipcRenderer.invoke('tray:setup'),
  setTrayHideOnClose: (value?: boolean) => ipcRenderer.invoke('tray:set-hide-on-close', value),
  getTrayHideOnClose: () => ipcRenderer.invoke('tray:get-hide-on-close') as Promise<{ ok: boolean; hideOnClose?: boolean }>,
}

export const updaterDomain = {
  checkForUpdates: () => ipcRenderer.invoke('updater:check'),
}

export const deeplinkDomain = {
  getLastDeeplink: () => ipcRenderer.invoke('deeplink:get-last') as Promise<{ ok: boolean; url?: string }>,
  getDeeplinkProtocol: () => ipcRenderer.invoke('deeplink:get-protocol') as Promise<{ ok: boolean; protocol?: string }>,
  onDeeplinkReceived: (callback: (url: string) => void) => {
    const handler = (_event: unknown, url: string) => callback(url)
    ipcRenderer.on('deeplink:received', handler)
    return () => ipcRenderer.removeListener('deeplink:received', handler)
  },
}

export const windowControls = {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized') as Promise<boolean>,
  close: () => ipcRenderer.invoke('window:close'),
  hide: () => ipcRenderer.invoke('window:hide'),
  quit: () => ipcRenderer.invoke('window:quit'),
  onMaximizedChanged: (callback: (maximized: boolean) => void) => {
    const handler = (_event: unknown, maximized: boolean) => callback(maximized)
    ipcRenderer.on('window:maximized-changed', handler)
    return () => ipcRenderer.removeListener('window:maximized-changed', handler)
  },
}

export type MntoolsApi = typeof requestDomain &
  typeof authDomain &
  typeof appDomain &
  typeof clientUpdateDomain &
  Partial<typeof fileDomain> &
  Partial<typeof notificationDomain> &
  Partial<typeof storageDomain> &
  Partial<typeof databaseDomain> &
  Partial<typeof busDomain> &
  Partial<typeof clipboardDomain> &
  Partial<typeof shellDomain> &
  Partial<typeof shortcutDomain> &
  Partial<typeof windowExtraDomain> &
  Partial<typeof screenshotDomain> &
  Partial<typeof printDomain> &
  Partial<typeof workerDomain> &
  Partial<typeof trayDomain> &
  Partial<typeof updaterDomain> &
  Partial<typeof deeplinkDomain>

export function buildApi(modules: string[]): MntoolsApi {
  const api: Record<string, unknown> = { ...requestDomain, ...authDomain, ...appDomain, ...clientUpdateDomain }

  if (modules.includes('file')) Object.assign(api, fileDomain)
  if (modules.includes('notification')) Object.assign(api, notificationDomain)
  if (modules.includes('storage')) Object.assign(api, storageDomain)
  if (modules.includes('database')) Object.assign(api, databaseDomain)
  if (modules.includes('bus')) Object.assign(api, busDomain)
  if (modules.includes('clipboard')) Object.assign(api, clipboardDomain)
  if (modules.includes('shell')) Object.assign(api, shellDomain)
  if (modules.includes('shortcut')) Object.assign(api, shortcutDomain)
  if (modules.includes('window')) Object.assign(api, windowExtraDomain)
  if (modules.includes('screenshot')) Object.assign(api, screenshotDomain)
  if (modules.includes('print')) Object.assign(api, printDomain)
  if (modules.includes('worker')) Object.assign(api, workerDomain)
  if (modules.includes('tray')) Object.assign(api, trayDomain)
  if (modules.includes('updater')) Object.assign(api, updaterDomain)
  if (modules.includes('deeplink')) Object.assign(api, deeplinkDomain)

  return api as MntoolsApi
}
