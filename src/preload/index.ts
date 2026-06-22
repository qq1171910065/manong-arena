import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { buildApi, windowControls } from './domains'
import { arenaDomain } from './domains/arena'

const modulesRaw = process.env.MNTOOLS_MODULES || 'request,sse,file,notification,storage,database'
const modules = modulesRaw.split(',').map((m) => m.trim()).filter(Boolean)

const api = buildApi(modules)

contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('api', { ...api, ...arenaDomain })
contextBridge.exposeInMainWorld('windowControls', windowControls)

export type { MntoolsApi } from './domains'
