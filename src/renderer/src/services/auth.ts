import { shallowRef } from 'vue'
import {
  clearStoredGatewayKey,
  ensureGatewayKey,
  getAppKeyName,
  invalidateGatewayModelCache,
} from './gateway-api'
import { performAuthLogout } from './auth-session'
import {
  getPortalSession,
  migrateLegacyAuthStorage,
  portalApi,
  setPortalSession,
  type PortalOAuthBinding,
  type PortalProfile,
  type PortalSession,
} from './portal-api'

migrateLegacyAuthStorage()

export interface UserInfo {
  id: number
  username: string
  name: string
  dept: string | null
  role: string
  avatar: string | null
  emailDisplay?: string
  emailBound?: boolean
  needsEmailBind?: boolean
  emailVerified?: boolean
  gatewayReady?: boolean
  customerId?: number | null
  oauthBindings?: PortalOAuthBinding[]
}

export interface LoginResult {
  token: string
  refreshToken?: string
  expire?: number
  refreshExpire?: number
  userInfo: UserInfo
}

export interface OfficeWechatPollResult {
  status: 'pending' | 'ok' | 'error' | 'scanned' | 'need_email' | 'expired'
  login?: LoginResult
  message?: string
}

export interface OAuthBindPollResult {
  status: 'pending' | 'ok' | 'error' | 'expired'
  message?: string
}

function sessionToUserInfo(session: PortalSession | PortalProfile): UserInfo {
  const email = String(session.email || '').trim()
  return {
    id: 'id' in session ? Number(session.id) : 0,
    username: session.username,
    name: session.name || session.username,
    dept: null,
    role: 'user',
    avatar: null,
    emailDisplay: email ? email.replace(/^(.).+(@.+)$/, '$1***$2') : '',
    emailBound: Boolean(email && !email.endsWith('@wechat.local')),
    needsEmailBind: 'needsEmailBind' in session ? Boolean(session.needsEmailBind) : false,
    emailVerified: 'emailVerified' in session ? Boolean(session.emailVerified) : true,
    gatewayReady: 'gatewayReady' in session ? Boolean(session.gatewayReady) : true,
    customerId: session.customerId ?? null,
    oauthBindings: 'bindings' in session ? session.bindings : undefined,
  }
}

export const userInfoRef = shallowRef<UserInfo | null>(readUserInfoFromStorage())

export function getCurrentUserContext(): { id: number | null; role: string } {
  const u = userInfoRef.value ?? readUserInfoFromStorage()
  if (!u) return { id: null, role: 'user' }
  return { id: typeof u.id === 'number' ? u.id : null, role: String(u.role || 'user').toLowerCase() }
}

function readUserInfoFromStorage(): UserInfo | null {
  const session = getPortalSession()
  if (session) return sessionToUserInfo(session)
  const raw = localStorage.getItem('userInfo')
  if (!raw) return null
  try {
    return JSON.parse(raw) as UserInfo
  } catch {
    return null
  }
}

export function setUserInfoCache(info: UserInfo | null): void {
  if (info) {
    localStorage.setItem('userInfo', JSON.stringify(info))
    userInfoRef.value = info
  } else {
    localStorage.removeItem('userInfo')
    userInfoRef.value = null
  }
}

function persistPortalSession(session: PortalSession) {
  setPortalSession(session)
  setUserInfoCache(sessionToUserInfo(session))
}

async function afterLogin(session: PortalSession): Promise<LoginResult> {
  persistPortalSession(session)
  try {
    await ensureGatewayKey(getAppKeyName())
  } catch {
    /* 邮箱未验证时允许进入 */
  }
  return {
    token: session.token,
    refreshToken: session.refreshToken,
    expire: session.expire,
    refreshExpire: session.refreshExpire,
    userInfo: sessionToUserInfo(session),
  }
}

export const authApi = {
  async sendVerifyCode(email: string, purpose: 'login' | 'register' = 'login') {
    return portalApi.sendEmailCode(email, purpose)
  },

  async checkLoginCaptcha(account: string) {
    return portalApi.loginCaptcha(account)
  },

  async fetchCaptcha() {
    return portalApi.captcha()
  },

  async login(username: string, password: string, captcha?: { captchaId: string; verifyCode: string }) {
    const session = await portalApi.login(username, password, captcha)
    return afterLogin(session)
  },

  async register(payload: {
    email: string
    username: string
    password: string
    verifyCode: string
    name?: string
  }) {
    const session = await portalApi.register(payload)
    return afterLogin(session)
  },

  async emailLogin(email: string, verifyCode: string) {
    const session = await portalApi.emailLogin(email, verifyCode)
    return afterLogin(session)
  },

  async getOfficeWechatOptions() {
    try {
      const providers = await portalApi.oauthProviders()
      const wechat = providers.find((p) => p.channel === 'wechat')
      return { enabled: Boolean(wechat), appId: '', redirectConfigured: Boolean(wechat) }
    } catch {
      return { enabled: false, appId: '', redirectConfigured: false }
    }
  },

  async startOfficeWechatLogin() {
    const r = await portalApi.wechatStart('zh')
    return { state: r.state, authorizeUrl: r.authorizeUrl, expiresIn: r.expiresIn ?? 180 }
  },

  async pollOfficeWechatOAuth(state: string): Promise<OfficeWechatPollResult> {
    const poll = await portalApi.wechatPoll(state)
    if (poll.status === 'ok' && poll.login) {
      const login = await afterLogin(poll.login)
      return { status: 'ok', login }
    }
    if (poll.status === 'need_email') return { status: 'need_email' }
    if (poll.status === 'expired') return { status: 'expired', message: poll.message || '二维码已过期' }
    if (poll.status === 'error') return { status: 'error', message: poll.message || '微信登录失败' }
    if (poll.status === 'scanned') return { status: 'scanned' }
    return { status: 'pending' }
  },

  async sendWechatLinkEmailCode(state: string, email: string) {
    return portalApi.wechatLinkSendCode(state, email)
  },

  async submitWechatLinkEmail(state: string, email: string, verifyCode: string) {
    const session = await portalApi.wechatLinkEmail(state, email, verifyCode)
    return afterLogin(session)
  },

  async fetchProfile() {
    const profile = await portalApi.profile()
    const session = getPortalSession()
    if (session) {
      const merged: PortalSession = { ...session, ...profile, name: profile.name || session.name }
      setPortalSession(merged)
    }
    const info = sessionToUserInfo(profile)
    setUserInfoCache(info)
    return info
  },

  async bindEmail(email: string, verifyCode: string) {
    const session = await portalApi.bindEmail(email, verifyCode)
    return afterLogin(session)
  },

  async startOAuthBind(channel: string, lang = 'zh') {
    return portalApi.oauthBind(channel, lang)
  },

  async pollOAuthBind(state: string): Promise<OAuthBindPollResult> {
    const poll = await portalApi.oauthBindPoll(state)
    if (poll.status === 'ok') return { status: 'ok' }
    if (poll.status === 'error') return { status: 'error', message: poll.message || '绑定失败' }
    if (poll.status === 'expired') return { status: 'expired' }
    return { status: 'pending' }
  },

  async unbindOAuth(channel: string) {
    await portalApi.oauthUnbind(channel)
    await authApi.fetchProfile()
  },

  async logout() {
    try {
      await portalApi.logout()
    } catch {
      /* ignore */
    }
    setPortalSession(null)
    setUserInfoCache(null)
    clearStoredGatewayKey()
    invalidateGatewayModelCache()
    await performAuthLogout()
  },

  getUserInfo(): UserInfo | null {
    return userInfoRef.value ?? readUserInfoFromStorage()
  },

  isLoggedIn(): boolean {
    return Boolean(getPortalSession()?.token)
  },

  sessionToPortalSession(): PortalSession | null {
    return getPortalSession()
  },
}
