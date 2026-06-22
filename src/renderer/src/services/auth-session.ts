import { navigate } from '../router'
import { isWebRuntime } from '../composables/useRuntime'
import { getPortalSession, setPortalSession, type PortalSession } from './portal-api'

/** 登录成功后进入主界面（Web 走路由，Desktop 走 IPC） */
export async function completeAuthSession(session: PortalSession, defaultHomePath = '/home'): Promise<void> {
  setPortalSession(session)
  if (isWebRuntime()) {
    navigate(defaultHomePath)
    window.dispatchEvent(new CustomEvent('mntools:auth-phase', { detail: 'main' }))
    return
  }
  await window.api.openMain(session)
}

/** 读取当前认证阶段 */
export async function resolveAuthPhase(): Promise<'login' | 'main'> {
  if (isWebRuntime()) {
    return getPortalSession()?.token ? 'main' : 'login'
  }
  return window.api.getPhase()
}

/** 登出并回到登录（Web 仅清 session + 路由） */
export async function performAuthLogout(): Promise<void> {
  if (isWebRuntime()) {
    setPortalSession(null)
    navigate('/login')
    window.dispatchEvent(new CustomEvent('mntools:auth-phase', { detail: 'login' }))
    return
  }
  await window.api.logout()
}
