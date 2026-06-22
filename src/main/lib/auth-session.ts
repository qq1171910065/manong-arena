import StoreImport from 'electron-store'
import { app } from 'electron'
import type { PortalSession } from '../shared/types'

/** electron-store v9+ 为 ESM；electron-vite main 输出 CJS require() 时需取 .default */
const Store =
  (StoreImport as unknown as { default: typeof StoreImport }).default ?? StoreImport

type AuthStore = InstanceType<typeof Store>

let store: AuthStore | null = null

/** 打包后 conf 无法从 asar 推断 projectName，需显式 cwd + projectName */
function getStore(): AuthStore {
  if (!store) {
    store = new Store<{ portalSession: PortalSession | null }>({
      name: 'mntools-auth',
      projectName: app.getName(),
      cwd: app.getPath('userData'),
      defaults: { portalSession: null },
    })
  }
  return store
}

export function getStoredSession(): PortalSession | null {
  return getStore().get('portalSession') ?? null
}

export function setStoredSession(session: PortalSession | null): void {
  if (session) getStore().set('portalSession', session)
  else getStore().delete('portalSession')
}

export function hasStoredSession(): boolean {
  return Boolean(getStoredSession()?.token)
}
