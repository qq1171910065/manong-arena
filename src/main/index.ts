import { createMntoolsApp } from './create-mntools-app'
import type { MntoolsModuleId } from '../shared/types'

const modules = ('request,sse,notification,storage,shell,window,file,tray'.split(',').filter(Boolean) as MntoolsModuleId[])

createMntoolsApp({
  appId: 'com.agentarena',
  appName: 'Manong Arena',
  modules,
  features: {
    autoUpdate: true,
    platform: true,
    tray: true,
  },
  login: {
    emailCode: true,
    password: true,
    wechatOAuth: true,
  },
  shellLayout: 'sidebar',
  shellStyle: 'grouped',
  defaultHomePath: '/home',
})
