import { getApiBaseUrl } from './config'
import { isSuccessBusinessCode, parseCoolApiEnvelope, refreshSessionFromStorage, isAuthError } from './api'
import { handleAuthFailure } from './auth-session'
import { FEE_YUAN_TO_POINTS, yuanToPoints } from '../composables/fee-points'
import type { PortalSession } from '@shared/types'

export type { PortalSession } from '@shared/types'

export interface PortalOAuthBinding {
  channel: string
  label: string
  labelEn: string
  bound: boolean
}

export interface PortalProfile {
  id: number
  username: string
  email: string
  name: string
  customerId: number
  customerName?: string
  customerType?: string
  needsEmailBind?: boolean
  emailVerified?: boolean
  gatewayReady?: boolean
  bindings?: PortalOAuthBinding[]
}

export interface PortalLicenseRecord {
  id?: number
  productName?: string
  status?: string
  expireAt?: string | null
  [key: string]: unknown
}

export interface PortalTicketRecord {
  id: number
  title: string
  content?: string
  status?: string
  priority?: string
  createTime?: string | null
}

export interface PortalUserKey {
  id: number
  name: string
  keyPrefix: string
  isDefault: boolean
  status: string
  createTime?: string
}

export interface PortalGatewayConfig {
  configured: boolean
  mode: 'direct' | 'proxy'
  baseUrl: string
  chatBaseUrl: string
  pricingUrl: string
  quotaPerYuan?: number
  hint?: string
}

export interface PortalGatewayModelRow {
  id: string
  tags: string[]
  endpointTypes: string[]
  group?: string
  modelRatio?: number
  completionRatio?: number
  modelPrice?: number
  quotaType?: number
}

export interface PortalGatewayCatalog {
  configured: boolean
  baseUrl: string
  chatBaseUrl: string
  quotaPerYuan: number
  models: PortalGatewayModelRow[]
}

export interface PortalUsageRecord {
  id: number
  modelName: string | null
  promptTokens: number
  completionTokens: number
  costYuan: number | string
  calledAt: string | null
  createTime?: string
}

export interface PortalRechargeTier {
  yuan: number
  appPoints?: number
  label: string
}

export interface PortalRechargeClientConfig {
  enabled: boolean
  pointsPerYuan: number
  minRechargeYuan: number
  tiers: PortalRechargeTier[]
  wxpayConfigured: boolean
  wxpay_missing_keys?: string[]
  description: string
}

export interface PortalRechargeWechatOrder {
  rechargeRequestId: number
  outTradeNo: string
  codeUrl: string
  amountYuan: number
  amount_yuan: number
  app_points: number
  order_no: string
  code_url: string
  status: 'pending'
  expiresIn: number
}

export interface PortalRechargeOrderStatus {
  id: number
  order_no: string
  status: 'pending' | 'paid' | 'closed' | 'failed' | 'expired'
  amount_yuan: number
  amountYuan?: number
  paid_at?: string | null
  paidAt?: string | null
  code_url?: string
  paymentChannel?: string
  outTradeNo?: string
}

export interface PortalRechargeRecord {
  id: number
  amountYuan: number | string
  paymentChannel?: string | null
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  outTradeNo?: string | null
  paidAt?: string | null
  createTime?: string | null
  remark?: string | null
}

export interface PortalWalletSummary {
  hasWallet: boolean
  balanceYuan: number
  frozenYuan?: number
  totalRechargedYuan?: number
  totalConsumedYuan?: number
  remainYuan?: number
  usedYuan?: number
}

const SESSION_KEY = 'wb_portal_session'

function normalizeRechargeTier(
  tier: Partial<PortalRechargeTier>,
  pointsPerYuan = FEE_YUAN_TO_POINTS
): PortalRechargeTier {
  const yuan = Math.floor(Number(tier.yuan) || 0)
  const rawPoints = Number(tier.appPoints)
  const appPoints =
    Number.isFinite(rawPoints) && rawPoints > 0
      ? Math.round(rawPoints)
      : yuanToPoints(yuan) || Math.round(yuan * pointsPerYuan)
  return {
    yuan,
    appPoints,
    label: String(tier.label || '').trim() || `${yuan} 元`,
  }
}

function normalizeRechargeConfig(raw: Record<string, unknown>): PortalRechargeClientConfig {
  const pointsPerYuan = Math.max(
    1,
    Math.floor(Number(raw.pointsPerYuan) || FEE_YUAN_TO_POINTS)
  )
  const tiers = Array.isArray(raw.tiers)
    ? raw.tiers.map((tier) =>
        normalizeRechargeTier(tier as Partial<PortalRechargeTier>, pointsPerYuan)
      )
    : []
  return {
    enabled: raw.enabled !== false,
    pointsPerYuan,
    minRechargeYuan: Math.floor(Number(raw.minRechargeYuan) || 10),
    tiers,
    wxpayConfigured: Boolean(raw.wxpayConfigured),
    wxpay_missing_keys: Array.isArray(raw.wxpay_missing_keys)
      ? (raw.wxpay_missing_keys as string[])
      : undefined,
    description: String(raw.description || ''),
  }
}

function normalizeRechargeWechatOrder(raw: Record<string, unknown>): PortalRechargeWechatOrder {
  const amountYuan = Number(raw.amount_yuan ?? raw.amountYuan) || 0
  const rechargeRequestId = Number(raw.rechargeRequestId ?? raw.id) || 0
  const codeUrl = String(raw.code_url ?? raw.codeUrl ?? '')
  const outTradeNo = String(raw.outTradeNo ?? raw.out_trade_no ?? '')
  const rawPoints = Number(raw.app_points ?? raw.appPoints)
  const appPoints =
    Number.isFinite(rawPoints) && rawPoints > 0 ? Math.round(rawPoints) : yuanToPoints(amountYuan)
  return {
    rechargeRequestId,
    outTradeNo,
    codeUrl,
    amountYuan,
    amount_yuan: amountYuan,
    app_points: appPoints,
    order_no: String(raw.order_no ?? rechargeRequestId),
    code_url: codeUrl,
    status: 'pending',
    expiresIn: Number(raw.expiresIn) || 300,
  }
}

export function getPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as PortalSession) : null
  } catch {
    return null
  }
}

export function setPortalSession(session: PortalSession | null): void {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem('token', session.token)
    localStorage.setItem('refreshToken', session.refreshToken)
  } else {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
  }
  window.dispatchEvent(new CustomEvent('wb:auth-change'))
}

export function isPortalLoggedIn(): boolean {
  return Boolean(getPortalSession()?.token)
}

export function migrateLegacyAuthStorage(): void {
  if (getPortalSession()?.token) return
  if (!localStorage.getItem('token')) return
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('userInfo')
  localStorage.removeItem('wb_gateway_api_key')
}

async function portalRequest<T>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>,
  auth = true,
  retried = false
): Promise<T> {
  const base = getApiBaseUrl().replace(/\/+$/, '')
  if (!base) throw new Error('未配置平台服务地址')

  const shouldExitOnAuthFail =
    auth && !path.includes('/portal/comm/logout') && !path.includes('/portal/open/refreshToken')

  async function rejectAuth(message: string): Promise<never> {
    if (shouldExitOnAuthFail) void handleAuthFailure()
    throw new Error(message || '登录已失效，请重新登录')
  }

  let url = `${base}${path.startsWith('/') ? path : `/${path}`}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  if (auth) {
    const session = getPortalSession()
    const token = session?.token || localStorage.getItem('token') || ''
    if (token) headers.Authorization = `Bearer ${token}`
  }

  let reqBody: string | undefined
  if (method === 'GET' && body) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(body)) {
      if (v != null && v !== '') qs.set(k, String(v))
    }
    const qsStr = qs.toString()
    if (qsStr) url += `?${qsStr}`
  } else if (method === 'POST' && body) {
    reqBody = JSON.stringify(body)
  }

  const result = await window.api.fetchUrl(url, method, headers, reqBody, { timeoutMs: 12_000 })
  const status = result.status ?? 0
  const envelope = parseCoolApiEnvelope(result.data)

  if (!result.success) {
    const msg = result.error || envelope?.message || '请求失败'
    if (shouldExitOnAuthFail && isAuthError(status, envelope?.code, msg)) {
      if (!retried) {
        const refresh = await refreshSessionFromStorage()
        if (refresh === 'ok') {
          return portalRequest<T>(path, method, body, auth, true)
        }
      }
      return rejectAuth(envelope?.message || msg)
    }
    throw new Error(msg)
  }

  if (!envelope) throw new Error('接口返回格式异常')

  if (shouldExitOnAuthFail && isAuthError(status, envelope.code, envelope.message)) {
    if (!retried) {
      const refresh = await refreshSessionFromStorage()
      if (refresh === 'ok') {
        return portalRequest<T>(path, method, body, auth, true)
      }
    }
    return rejectAuth(envelope.message || '登录已失效，请重新登录')
  }

  if (!isSuccessBusinessCode(envelope.code)) {
    const msg = envelope.message || '接口错误'
    if (shouldExitOnAuthFail && isAuthError(status, envelope.code, msg)) {
      if (!retried) {
        const refresh = await refreshSessionFromStorage()
        if (refresh === 'ok') {
          return portalRequest<T>(path, method, body, auth, true)
        }
      }
      return rejectAuth(msg)
    }
    throw new Error(msg)
  }
  return envelope.data as T
}

export const portalApi = {
  login(
    account: string,
    password: string,
    captcha?: { captchaId: string; verifyCode: string }
  ) {
    return portalRequest<PortalSession>(
      '/portal/open/login',
      'POST',
      { account, password, ...captcha },
      false
    )
  },

  loginCaptcha(account: string) {
    return portalRequest<{ captchaRequired: boolean }>(
      '/portal/open/loginCaptcha',
      'GET',
      { account },
      false
    )
  },

  captcha() {
    return portalRequest<{ captchaId: string; data: string }>(
      '/portal/open/captcha',
      'GET',
      { width: 120, height: 40 },
      false
    )
  },

  register(payload: {
    email: string
    verifyCode: string
    username?: string
    password?: string
    name?: string
  }) {
    return portalRequest<PortalSession>('/portal/open/register', 'POST', payload, false)
  },

  sendEmailCode(email: string, purpose: 'login' | 'register') {
    return portalRequest<{ maskedEmail: string; debugCode?: string }>(
      '/portal/open/email/sendCode',
      'POST',
      { email, purpose },
      false
    )
  },

  emailLogin(email: string, verifyCode: string) {
    return portalRequest<PortalSession>(
      '/portal/open/email/login',
      'POST',
      { email, verifyCode },
      false
    )
  },

  oauthProviders() {
    return portalRequest<Array<{ channel: string; label: string; labelEn: string }>>(
      '/portal/open/oauth/providers',
      'GET',
      undefined,
      false
    )
  },

  oauthStart(channel: string, lang: string) {
    return portalRequest<{
      state: string
      authorizeUrl?: string
      qrImageUrl?: string
      expiresIn: number
      mode?: string
    }>('/portal/open/oauth/start', 'POST', { channel, lang }, false)
  },

  wechatStart(lang: string) {
    return portalRequest<{ state: string; authorizeUrl: string; expiresIn: number }>(
      '/portal/open/wechat/start',
      'POST',
      { lang },
      false
    )
  },

  wechatPoll(state: string) {
    return portalRequest<{ status: string; login?: PortalSession; message?: string }>(
      '/portal/open/wechat/poll',
      'GET',
      { state },
      false
    )
  },

  wechatLinkSendCode(state: string, email: string) {
    return portalRequest<{ maskedEmail: string; debugCode?: string }>(
      '/portal/open/wechat/link/sendCode',
      'POST',
      { state, email },
      false
    )
  },

  wechatLinkEmail(state: string, email: string, verifyCode: string) {
    return portalRequest<PortalSession>(
      '/portal/open/wechat/link/email',
      'POST',
      { state, email, verifyCode },
      false
    )
  },

  wechatScanned(state: string) {
    return portalRequest<{ status: string }>('/portal/open/wechat/scanned', 'GET', { state }, false)
  },

  wechatConfirm(payload: {
    state: string
    account?: string
    password?: string
    email?: string
    verifyCode?: string
  }) {
    return portalRequest<{ ok: boolean }>('/portal/open/wechat/confirm', 'POST', payload, false)
  },

  profile() {
    return portalRequest<PortalProfile>('/portal/comm/profile')
  },

  logout() {
    return portalRequest<void>('/portal/comm/logout', 'POST', {})
  },

  keys(page = 1, size = 100) {
    return portalRequest<{
      list: PortalUserKey[]
      pagination: { page: number; size: number; total: number }
      activeCount?: number
    }>('/portal/key/list', 'GET', { page, size }).then((res) => res.list ?? [])
  },

  ensureDefaultKey(name?: string) {
    return portalRequest<{ key: PortalUserKey; keyPlaintext: string; created?: boolean }>(
      '/portal/key/ensureDefault',
      'POST',
      { name }
    )
  },

  createKey(name?: string, remark?: string) {
    return portalRequest<{ key: PortalUserKey; keyPlaintext: string }>('/portal/key/create', 'POST', {
      name,
      remark,
    })
  },

  revokeKey(id: number) {
    return portalRequest<unknown>('/portal/key/revoke', 'POST', { id })
  },

  gatewayConfig() {
    return portalRequest<PortalGatewayConfig>('/portal/key/gatewayConfig')
  },

  gatewayModels() {
    return portalRequest<PortalGatewayCatalog>('/portal/gateway/models')
  },

  sendBindEmailCode(email: string) {
    return portalRequest<{ maskedEmail: string; debugCode?: string }>(
      '/portal/comm/email/sendBindCode',
      'POST',
      { email }
    )
  },

  bindEmail(email: string, verifyCode: string) {
    return portalRequest<PortalSession>('/portal/comm/email/bind', 'POST', { email, verifyCode })
  },

  usage(page = 1, size = 20) {
    return portalRequest<{
      list: PortalUsageRecord[]
      pagination: { page: number; size: number; total: number }
    }>('/portal/usage/list', 'GET', { page, size })
  },

  wallet() {
    return portalRequest<PortalWalletSummary>('/portal/wallet/balance')
  },

  recharge(amountYuan: number, remark?: string) {
    return portalRequest<unknown>('/portal/wallet/recharge', 'POST', { amountYuan, remark })
  },

  rechargeConfig() {
    return portalRequest<Record<string, unknown>>('/portal/wallet/recharge/config', 'GET').then(
      normalizeRechargeConfig
    )
  },

  rechargeWechat(amountYuan: number, remark?: string) {
    return portalRequest<Record<string, unknown>>('/portal/wallet/recharge/wechat', 'POST', {
      amountYuan,
      remark,
    }).then(normalizeRechargeWechatOrder)
  },

  rechargeStatus(id: number) {
    return portalRequest<PortalRechargeOrderStatus>('/portal/wallet/recharge/status', 'GET', { id })
  },

  rechargeList(page = 1, size = 20) {
    return portalRequest<{
      list: PortalRechargeRecord[]
      pagination: { page: number; size: number; total: number }
    }>('/portal/wallet/recharge/list', 'GET', { page, size })
  },

  licenses() {
    return portalRequest<{ records: PortalLicenseRecord[]; keys: unknown[] }>(
      '/portal/license/list'
    )
  },

  tickets() {
    return portalRequest<{ list: PortalTicketRecord[] }>('/portal/ticket/list')
  },

  createTicket(title: string, content: string, priority = 'normal') {
    return portalRequest<unknown>('/portal/ticket/create', 'POST', { title, content, priority })
  },

  oauthBind(channel: string, lang: string) {
    return portalRequest<{
      channel: string
      state: string
      authorizeUrl: string
      expiresIn: number
    }>('/portal/comm/oauth/bind', 'POST', { channel, lang })
  },

  oauthBindPoll(state: string) {
    return portalRequest<{ status: string; bind?: unknown; message?: string }>(
      '/portal/comm/oauth/bind/poll',
      'GET',
      { state }
    )
  },

  oauthUnbind(channel: string) {
    return portalRequest<{ ok: boolean }>('/portal/comm/oauth/unbind', 'POST', { channel })
  },
}

export async function fetchPlatformPing(
  overrideBase?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const base = (overrideBase?.trim() || getApiBaseUrl()).replace(/\/+$/, '')
  if (!base || !/^https?:\/\//i.test(base)) {
    return { ok: false, error: '请先配置平台服务地址' }
  }
  try {
    const url = `${base}/portal/open/oauth/providers`
    const result = await window.api.fetchUrl(
      url,
      'GET',
      { 'Content-Type': 'application/json' },
      undefined,
      { timeoutMs: 3_000 }
    )
    if (!result.success) return { ok: false, error: result.error || '请求失败' }
    const envelope = parseCoolApiEnvelope(result.data)
    if (!envelope || !isSuccessBusinessCode(envelope.code)) {
      return { ok: false, error: envelope?.message || '该地址不是 WorkBuddy 平台服务' }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '请求失败' }
  }
}
