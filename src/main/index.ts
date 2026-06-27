import { createMntoolsApp } from './create-mntools-app'
import type { MntoolsModuleId } from '../shared/types'

const modules = ('request,sse,notification,storage,shell,window,file'.split(',').filter(Boolean) as MntoolsModuleId[])

createMntoolsApp({
  appId: 'com.agentarena',
  appName: 'Agent Arena',
  modules,
  features: {
    autoUpdate: true,
    platform: true,
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
