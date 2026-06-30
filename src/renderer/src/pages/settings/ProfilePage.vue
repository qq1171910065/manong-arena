<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Database,
  FileQuestion,
  Gamepad2,
  Key,
  Mail,
  MessageSquare,
  Shield,
  SlidersHorizontal,
  TrendingUp,
  Trophy,
  User,
  Volume2,
  Wallet,
  Zap,
} from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import WechatRechargeModal from '../../components/billing/WechatRechargeModal.vue'
import OAuthBindModal from '../../components/settings/OAuthBindModal.vue'
import PortalTabView from './PortalTabView.vue'
import {
  AppEmptyState,
  NAlert,
  NButton,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from '../../ui'
import { confirm } from '@renderer/composables/useAppDialog'
import {
  authApi,
  getAppKeyName,
  getStoredGatewayKey,
  portalApi,
  setStoredGatewayKey,
  userInfoRef,
  getUserLocalProfile,
  localProfileRevision,
  resolveUserAvatarUrl,
  resolveUserDisplayName,
  setUserLocalProfile,
  setUserInfoCache,
  type PortalLicenseRecord,
  type PortalOAuthBinding,
  type PortalRechargeClientConfig,
  type PortalRechargeRecord,
  type PortalTicketRecord,
  type PortalUsageRecord,
  type PortalUserKey,
  type PortalWalletSummary,
} from '@renderer/services'
import { yuanToPoints } from '@renderer/composables/fee-points'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { settingsService, applyArenaSettingsEffects } from '@renderer/services/arena'
import { cloneJson } from '@shared/clone-json'
import { getCurrentPath, navigate, route } from '../../router'
import type { ArenaSettings } from '@shared/arena/types'
import {
  isSettingsTab,
  portalPathForTab,
  portalTabFromRoute,
  resolveLegacyPortalPath,
  type PortalTab,
  type SettingsTab,
} from './portal-routes'
import { PORTAL_SHELL_KEY } from './portal-shell'
import { arenaHomeAssets } from '@renderer/data/arena-home-assets'

const message = useMessage()

const activeTab = computed(() => portalTabFromRoute(route.value))
const loading = ref(false)
const loadError = ref('')

const profile = ref(userInfoRef.value)
const wallet = ref<PortalWalletSummary | null>(null)
const keys = ref<PortalUserKey[]>([])
const usage = ref<PortalUsageRecord[]>([])
const recentUsage = ref<PortalUsageRecord[]>([])
const usageTotal = ref(0)
const usagePage = ref(1)
const usagePageSize = ref(10)
const usageLoading = ref(false)
const rechargeRecords = ref<PortalRechargeRecord[]>([])
const rechargeTotal = ref(0)
const rechargePage = ref(1)
const rechargePageSize = ref(10)
const rechargeLoading = ref(false)
const newKeyPlain = ref('')
const creatingAppKey = ref(false)
const rechargeConfig = ref<PortalRechargeClientConfig | null>(null)
const wechatRechargeOpen = ref(false)
const wechatRechargePresetYuan = ref<number | undefined>(undefined)
const bindEmail = ref('')
const bindCode = ref('')
const bindSending = ref(false)
const bindSubmitting = ref(false)
const bindCountdown = ref(0)
const oauthBindings = ref<PortalOAuthBinding[]>([])
const oauthBindOpen = ref(false)
const oauthBindChannel = ref('')
const oauthBindLabel = ref('')
const licenses = ref<PortalLicenseRecord[]>([])
const tickets = ref<PortalTicketRecord[]>([])
const arenaSettings = ref<ArenaSettings>(settingsService.defaults())
const arenaSettingsLoading = ref(false)
const arenaSettingsSaving = ref(false)
let arenaSettingsSaveToastTimer: ReturnType<typeof setTimeout> | null = null

function scheduleArenaSettingsSavedToast() {
  if (arenaSettingsSaveToastTimer) clearTimeout(arenaSettingsSaveToastTimer)
  arenaSettingsSaveToastTimer = setTimeout(() => {
    message.success('\u8bbe\u7f6e\u5df2\u81ea\u52a8\u4fdd\u5b58')
    arenaSettingsSaveToastTimer = null
  }, 500)
}
const signingOut = ref(false)
let bindCountdownTimer: ReturnType<typeof setInterval> | null = null

const appKeyName = getAppKeyName()
const appDisplayName = computed(() => getRuntimeConfig().displayName)
const appSoftwareKey = computed(() => {
  const active = keys.value.filter((k) => k.status === 'active')
  return (
    active.find((k) => k.name === appKeyName) ||
    active.find((k) => k.isDefault) ||
    active.find((k) => k.name === 'default') ||
    null
  )
})
const appKeyPlain = computed(() => getStoredGatewayKey())

const displayName = computed(() => {
  void localProfileRevision.value
  return resolveUserDisplayName(profile.value, getUserLocalProfile(profile.value?.id))
})
const avatarUrl = computed(() => {
  void localProfileRevision.value
  return resolveUserAvatarUrl(profile.value, getUserLocalProfile(profile.value?.id), arenaHomeAssets.charGemini)
})
const avatarInitial = computed(() => (displayName.value.trim()[0] || 'U').toUpperCase())
const activeKeysCount = computed(() => keys.value.filter((k) => k.status === 'active').length)
const balancePoints = computed(() => yuanToPoints(Number(wallet.value?.balanceYuan) || 0))
const gatewayReady = computed(() => Boolean(profile.value?.gatewayReady))
const hasLocalKey = computed(() => Boolean(getStoredGatewayKey()))
const rechargeReady = computed(
  () =>
    Boolean(
      rechargeConfig.value?.enabled &&
        rechargeConfig.value.wxpayConfigured &&
        (rechargeConfig.value.tiers?.length ?? 0) > 0
    )
)

const accountTabs = [
  { id: 'overview' as PortalTab, label: '账户概览', icon: User },
  { id: 'user-stats' as PortalTab, label: '数据统计', icon: TrendingUp },
  { id: 'security' as PortalTab, label: '账号安全', icon: Shield },
  { id: 'wallet' as PortalTab, label: '钱包充值', icon: Wallet },
]

const supportTabs = [
  { id: 'support-version' as PortalTab, label: '版本说明', icon: FileQuestion },
  { id: 'support-bug' as PortalTab, label: '问题反馈', icon: MessageSquare },
  { id: 'support-help' as PortalTab, label: '帮助中心', icon: Mail },
  { id: 'support-docs' as PortalTab, label: '项目文档', icon: BookOpen },
]

const modelServiceTabs = [
  { id: 'model-overview' as PortalTab, label: '模型概览', icon: Activity },
  { id: 'model-debug' as PortalTab, label: '全部模型', icon: Bot },
  { id: 'model-stream' as PortalTab, label: '流式调试', icon: Zap },
  { id: 'model-leaderboard' as PortalTab, label: 'Agent 评测榜', icon: Trophy },
  { id: 'usage' as PortalTab, label: '用量明细', icon: BarChart3 },
  { id: 'keys' as PortalTab, label: 'API Key 管理', icon: Key },
]

const settingTabs = [
  { id: 'settings-display' as PortalTab, label: '显示与界面', icon: SlidersHorizontal },
  { id: 'settings-audio' as PortalTab, label: '声音', icon: Volume2 },
  { id: 'settings-match' as PortalTab, label: '对局偏好', icon: Gamepad2 },
  { id: 'settings-data' as PortalTab, label: '数据管理', icon: Database },
]

const profileNavGroups = [
  { label: '账户', items: accountTabs },
  { label: '模型服务', items: modelServiceTabs },
  { label: '帮助与支持', items: supportTabs },
  { label: '应用设置', items: settingTabs },
]

const isSettingsRoute = computed(() => route.value.name === 'settings')

const settingsTabMeta: Record<SettingsTab, { title: string; desc: string }> = {
  'settings-display': {
    title: '显示与界面',
    desc: '缩放、动效与界面布局。',
  },
  'settings-audio': {
    title: '声音',
    desc: '背景音乐、音效与 TTS 播报。',
  },
  'settings-match': {
    title: '对局偏好',
    desc: '开局默认、推进节奏与余额保护。',
  },
  'settings-data': {
    title: '数据管理',
    desc: '记录保留、备份清理与恢复出厂。',
  },
}

const boolOptions = [
  { label: '\u5f00\u542f', value: true },
  { label: '\u5173\u95ed', value: false },
]

const identityModeOptions = [
  { label: '\u968f\u673a', value: 'random' },
  { label: '\u534a\u968f\u673a', value: 'semi-random' },
  { label: '\u624b\u52a8', value: 'manual' },
]

const retentionDayOptions = [
  { label: '30 \u5929', value: '30' },
  { label: '90 \u5929', value: '90' },
  { label: '180 \u5929', value: '180' },
  { label: '365 \u5929', value: '365' },
]

const usagePageSummary = computed(() => ({
  records: usageTotal.value,
  cost: usage.value.reduce((sum, row) => sum + Number(row.costYuan || 0), 0),
  tokens: usage.value.reduce(
    (sum, row) => sum + (row.promptTokens || 0) + (row.completionTokens || 0),
    0
  ),
}))

const accountDetails = computed(() => [
  {
    id: 'uid',
    label: '\u7528\u6237 ID',
    hint: '平台唯一标识',
    value: profile.value?.id ? String(profile.value.id) : '\u2014',
  },
  {
    id: 'customer',
    label: '\u5ba2\u6237 ID',
    hint: '厂商客户主体',
    value: profile.value?.customerId ? String(profile.value.customerId) : '\u2014',
  },
  {
    id: 'email',
    label: '\u90ae\u7bb1',
    hint: '绑定时填写完整地址',
    value: profile.value?.emailDisplay || (profile.value?.needsEmailBind ? '\u672a\u7ed1\u5b9a' : '\u2014'),
    status: profile.value?.emailVerified === false ? 'warn' : profile.value?.emailBound ? 'ok' : 'muted',
  },
  {
    id: 'gateway',
    label: '\u6a21\u578b\u7f51\u5173',
    hint: '验证邮箱后开通',
    value: gatewayReady.value ? '\u5df2\u5c31\u7eea' : '\u5f85\u9a8c\u8bc1\u90ae\u7bb1',
    status: gatewayReady.value ? 'ok' : 'warn',
  },
  {
    id: 'local-key',
    label: '\u672c\u673a Key',
    hint: '客户端直连网关',
    value: hasLocalKey.value ? '\u5df2\u4fdd\u5b58' : '\u672a\u4fdd\u5b58',
    status: hasLocalKey.value ? 'ok' : 'muted',
  },
  {
    id: 'keys-count',
    label: '\u6709\u6548\u5bc6\u94a5',
    hint: '有效 active 密钥',
    value: String(activeKeysCount.value) + ' \u4e2a',
    status: activeKeysCount.value > 0 ? 'ok' : 'muted',
  },
])

const wechatBound = computed(() =>
  oauthBindings.value.some((item) => item.channel === 'wechat' && item.bound)
)

const securityItems = computed(() => [
  {
    id: 'email-verify',
    label: '\u90ae\u7bb1\u9a8c\u8bc1',
    desc:
      profile.value?.emailVerified === false
        ? '未验证，部分功能受限'
        : '已验证，网关可用',
    ok: profile.value?.emailVerified !== false,
  },
  {
    id: 'wechat-bind',
    label: '\u5fae\u4fe1\u7ed1\u5b9a',
    desc: wechatBound.value ? '已绑定，可扫码登录' : '未绑定，可扫码登录',
    ok: wechatBound.value,
  },
  {
    id: 'gateway',
    label: '\u7f51\u5173\u8d26\u6237',
    desc: gatewayReady.value ? '已开通，可调用 API' : '验证邮箱后开通',
    ok: gatewayReady.value,
  },
  {
    id: 'api-key',
    label: 'API \u5bc6\u94a5',
    desc: activeKeysCount.value
      ? `有效 ${activeKeysCount.value} 个${hasLocalKey.value ? ' · 本机已缓存' : ''}`
      : '建议创建 Key 供客户端调用',
    ok: activeKeysCount.value > 0,
  },
])

const usageChartOption = computed(() => {
  const labels = usage.value.map((r) => formatShortTime(r.calledAt || r.createTime || ''))
  const costs = usage.value.map((r) => Number(r.costYuan || 0))
  return {
    tooltip: { trigger: 'axis' as const },
    grid: { left: 48, right: 16, top: 28, bottom: 32 },
    xAxis: { type: 'category' as const, data: labels, axisLabel: { rotate: labels.length > 8 ? 35 : 0 } },
    yAxis: { type: 'value' as const, name: '\u5143' },
    series: [
      {
        name: '\u8d39\u7528',
        type: 'bar' as const,
        data: costs,
        itemStyle: { borderRadius: [4, 4, 0, 0] },
      },
    ],
  }
})

const usagePagination = computed(() => ({
  page: usagePage.value,
  pageSize: usagePageSize.value,
  itemCount: usageTotal.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
}))

const rechargePagination = computed(() => ({
  page: rechargePage.value,
  pageSize: rechargePageSize.value,
  itemCount: rechargeTotal.value,
  showSizePicker: true,
  pageSizes: [10, 20, 50],
}))

function formatDateTime(raw?: string | null) {
  if (!raw) return '\u2014'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 19)
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function rechargeStatusMeta(status: string) {
  switch (status) {
    case 'approved':
      return { label: '\u5df2\u6210\u529f', type: 'success' as const }
    case 'pending':
      return { label: '\u5f85\u652f\u4ed8', type: 'warning' as const }
    case 'rejected':
      return { label: '\u5df2\u5931\u8d25', type: 'error' as const }
    case 'expired':
      return { label: '\u5df2\u8fc7\u671f', type: 'default' as const }
    default:
      return { label: status || '\u2014', type: 'default' as const }
  }
}

function paymentChannelLabel(channel?: string | null) {
  if (channel === 'wechat') return '\u5fae\u4fe1\u652f\u4ed8'
  if (channel === 'manual') return '\u7ebf\u4e0b\u8f6c\u8d26'
  return channel || '\u2014'
}

const rechargeColumns: DataTableColumns<PortalRechargeRecord> = [
  {
    title: '\u65f6\u95f4',
    key: 'createTime',
    width: 168,
    render: (row) => formatDateTime(row.createTime),
  },
  {
    title: '\u91d1\u989d(\u5143)',
    key: 'amountYuan',
    width: 104,
    align: 'right',
    render: (row) => Number(row.amountYuan || 0).toFixed(2),
  },
  {
    title: '\u79ef\u5206',
    key: 'points',
    width: 112,
    align: 'right',
    render: (row) => yuanToPoints(Number(row.amountYuan || 0)).toLocaleString(),
  },
  {
    title: '\u6e20\u9053',
    key: 'paymentChannel',
    width: 96,
    render: (row) => paymentChannelLabel(row.paymentChannel),
  },
  {
    title: '\u72b6\u6001',
    key: 'status',
    width: 96,
    render: (row) => {
      const meta = rechargeStatusMeta(row.status)
      return h(NTag, { size: 'small', type: meta.type, bordered: false }, () => meta.label)
    },
  },
  {
    title: '\u8ba2\u5355\u53f7',
    key: 'outTradeNo',
    ellipsis: { tooltip: true },
    render: (row) => row.outTradeNo || String(row.id),
  },
]

const usageColumns: DataTableColumns<PortalUsageRecord> = [
  {
    title: '\u65f6\u95f4',
    key: 'calledAt',
    width: 168,
    ellipsis: { tooltip: true },
    render: (row) => row.calledAt || row.createTime || '\u2014',
  },
  {
    title: '\u6a21\u578b',
    key: 'modelName',
    ellipsis: { tooltip: true },
    render: (row) => row.modelName || '\u2014',
  },
  {
    title: 'Token',
    key: 'tokens',
    width: 96,
    align: 'right',
    render: (row) => String((row.promptTokens || 0) + (row.completionTokens || 0)),
  },
  {
    title: '\u8d39\u7528(\u5143)',
    key: 'costYuan',
    width: 112,
    align: 'right',
    render: (row) => Number(row.costYuan || 0).toFixed(6),
  },
]

function formatShortTime(raw: string) {
  if (!raw) return '\u2014'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw.slice(0, 16)
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}


async function loadRecentUsage() {
  try {
    const res = await portalApi.usage(1, 5)
    recentUsage.value = res.list || []
    if (!usageTotal.value) {
      usageTotal.value = res.pagination?.total ?? recentUsage.value.length
    }
  } catch {
    recentUsage.value = []
  }
}

async function loadUsage(page = usagePage.value, size = usagePageSize.value) {
  usageLoading.value = true
  try {
    const res = await portalApi.usage(page, size)
    usage.value = res.list || []
    usageTotal.value = res.pagination?.total ?? usage.value.length
    usagePage.value = page
    usagePageSize.value = size
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u7528\u91cf\u52a0\u8f7d\u5931\u8d25')
  } finally {
    usageLoading.value = false
  }
}

async function loadRechargeList(page = rechargePage.value, size = rechargePageSize.value) {
  rechargeLoading.value = true
  try {
    const res = await portalApi.rechargeList(page, size)
    rechargeRecords.value = res.list || []
    rechargeTotal.value = res.pagination?.total ?? rechargeRecords.value.length
    rechargePage.value = page
    rechargePageSize.value = size
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u5145\u503c\u8bb0\u5f55\u52a0\u8f7d\u5931\u8d25')
  } finally {
    rechargeLoading.value = false
  }
}

async function loadArenaSettings() {
  arenaSettingsLoading.value = true
  try {
    arenaSettings.value = await settingsService.get()
  } catch (e) {
    console.warn(e instanceof Error ? e.message : '\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25')
    message.error(e instanceof Error ? e.message : '\u8bbe\u7f6e\u52a0\u8f7d\u5931\u8d25')
  } finally {
    arenaSettingsLoading.value = false
  }
}

function applyArenaSettingsLocal(settings: ArenaSettings) {
  const plain = cloneJson(settings)
  arenaSettings.value = plain
  applyArenaSettingsEffects(plain)
}

async function persistArenaPatch(patch: Partial<ArenaSettings>) {
  arenaSettingsSaving.value = true
  try {
    const saved = await settingsService.save(patch)
    arenaSettings.value = saved
    scheduleArenaSettingsSavedToast()
  } catch (e) {
    const text = e instanceof Error ? e.message : '\u8bbe\u7f6e\u4fdd\u5b58\u5931\u8d25'
    message.error(text)
    try {
      arenaSettings.value = await settingsService.get()
    } catch {
      // ignore reload failure
    }
  } finally {
    arenaSettingsSaving.value = false
  }
}

async function saveArenaSettings() {
  const snapshot = cloneJson(arenaSettings.value)
  applyArenaSettingsLocal(snapshot)
  await persistArenaPatch(snapshot)
}

async function resetArenaSettings() {
  arenaSettingsSaving.value = true
  try {
    arenaSettings.value = await settingsService.save(settingsService.defaults())
    message.success('\u5df2\u6062\u590d\u9ed8\u8ba4\u8bbe\u7f6e')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u6062\u590d\u9ed8\u8ba4\u5931\u8d25')
  } finally {
    arenaSettingsSaving.value = false
  }
}

function setArenaSetting<K extends keyof ArenaSettings>(key: K, value: ArenaSettings[K]) {
  const next = {
    ...arenaSettings.value,
    [key]: value,
  } as ArenaSettings
  applyArenaSettingsLocal(next)
  void persistArenaPatch({ [key]: value } as Partial<ArenaSettings>)
}

function setMatchDefault<K extends keyof ArenaSettings['matchDefaults']>(
  key: K,
  value: ArenaSettings['matchDefaults'][K]
) {
  const matchDefaults = {
    ...arenaSettings.value.matchDefaults,
    [key]: value,
  }
  const next = {
    ...arenaSettings.value,
    matchDefaults,
  }
  applyArenaSettingsLocal(next)
  void persistArenaPatch({ matchDefaults })
}

function setCharacterEvolution<K extends keyof ArenaSettings['characterEvolution']>(
  key: K,
  value: ArenaSettings['characterEvolution'][K]
) {
  const characterEvolution = {
    ...arenaSettings.value.characterEvolution,
    [key]: value,
  }
  const next = {
    ...arenaSettings.value,
    characterEvolution,
  }
  applyArenaSettingsLocal(next)
  void persistArenaPatch({ characterEvolution })
}

async function reload() {
  loading.value = true
  loadError.value = ''
  try {
    profile.value = await authApi.fetchProfile()
    oauthBindings.value = profile.value?.oauthBindings || []
    wallet.value = await portalApi.wallet().catch(() => null)
    keys.value = await portalApi.keys().catch(() => [])
    if (profile.value?.gatewayReady) {
      await syncAppSoftwareKey()
    }
    rechargeConfig.value = await portalApi.rechargeConfig().catch(() => null)
    const licenseRes = await portalApi.licenses().catch(() => null)
    licenses.value = licenseRes?.records || []
    const ticketRes = await portalApi.tickets().catch(() => null)
    tickets.value = ticketRes?.list || []
    if (usageTotal.value === 0) {
      const usageRes = await portalApi.usage(1, 1).catch(() => null)
      usageTotal.value = usageRes?.pagination?.total ?? 0
    }
    if (activeTab.value === 'usage') await loadUsage(1, usagePageSize.value)
    if (activeTab.value === 'wallet') await loadRechargeList(1, rechargePageSize.value)
    if (isSettingsTab(activeTab.value)) await loadArenaSettings()
    await loadRecentUsage()
  } catch (e) {
    loadError.value = e instanceof Error ? e.message : '\u52a0\u8f7d\u5931\u8d25'
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

async function forceLogout() {
  if (signingOut.value) return
  const confirmed = await confirm({
    title: '退出登录',
    message: '确定要退出当前账号吗？',
    tone: 'warning',
    confirmText: '退出登录',
  })
  if (!confirmed) return
  signingOut.value = true
  try {
    await authApi.logout()
  } catch (err) {
    console.warn(err instanceof Error ? err.message : '\u9000\u51fa\u767b\u5f55\u5931\u8d25')
  } finally {
    signingOut.value = false
  }
}

function updateLocalProfile(payload: { displayName?: string; avatarDataUrl?: string }) {
  const userId = profile.value?.id
  if (!userId) return
  setUserLocalProfile(userId, payload)
  if (payload.displayName !== undefined && profile.value) {
    profile.value = {
      ...profile.value,
      name: payload.displayName.trim() || profile.value.name,
    }
  }
  if (payload.avatarDataUrl !== undefined && profile.value) {
    profile.value = { ...profile.value, avatar: payload.avatarDataUrl || null }
  }
  if (profile.value) {
    setUserInfoCache({ ...profile.value })
  }
  message.success('资料已更新')
}

function startBindCountdown(sec = 60) {
  bindCountdown.value = sec
  if (bindCountdownTimer) clearInterval(bindCountdownTimer)
  bindCountdownTimer = setInterval(() => {
    bindCountdown.value -= 1
    if (bindCountdown.value <= 0 && bindCountdownTimer) clearInterval(bindCountdownTimer)
  }, 1000)
}

async function syncAppSoftwareKey() {
  try {
    const res = await portalApi.ensureDefaultKey(appKeyName)
    if (res.keyPlaintext) {
      setStoredGatewayKey(res.keyPlaintext)
    }
    keys.value = await portalApi.keys().catch(() => keys.value)
  } catch (e) {
    console.warn(e instanceof Error ? e.message : '本软件 Key 同步失败')
  }
}

async function createAppKey() {
  if (creatingAppKey.value) return
  if (appSoftwareKey.value) {
    message.info('本软件 Key 已存在，无需重复创建')
    await syncAppSoftwareKey()
    return
  }
  creatingAppKey.value = true
  try {
    const res = await portalApi.ensureDefaultKey(appKeyName)
    if (res.keyPlaintext) {
      newKeyPlain.value = res.keyPlaintext
      setStoredGatewayKey(res.keyPlaintext)
    }
    keys.value = await portalApi.keys()
    message.success(res.created ? '本软件 Key 已创建' : '本软件 Key 已就绪')
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u521b\u5efa\u5931\u8d25')
  } finally {
    creatingAppKey.value = false
  }
}

async function copyNewAppKey() {
  if (!newKeyPlain.value) return
  await navigator.clipboard.writeText(newKeyPlain.value)
  message.success('\u5df2\u590d\u5236 API Key')
}

function openWechatRecharge(yuan?: number) {
  wechatRechargePresetYuan.value = yuan
  wechatRechargeOpen.value = true
}

async function onRechargePaid() {
  wallet.value = await portalApi.wallet().catch(() => wallet.value)
  if (activeTab.value === 'wallet') {
    await loadRechargeList(1, rechargePageSize.value)
  }
  message.success('\u5145\u503c\u6210\u529f\uff0c\u4f59\u989d\u5df2\u66f4\u65b0')
}

async function sendBindCode() {
  if (!bindEmail.value.trim()) {
    message.warning('\u8bf7\u8f93\u5165\u90ae\u7bb1')
    return
  }
  if (bindCountdown.value > 0 || bindSending.value) return
  bindSending.value = true
  try {
    await portalApi.sendBindEmailCode(bindEmail.value.trim())
    message.success('\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001')
    startBindCountdown()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u53d1\u9001\u5931\u8d25')
  } finally {
    bindSending.value = false
  }
}

async function submitBindEmail() {
  if (!bindEmail.value.trim() || !bindCode.value.trim()) {
    message.warning('\u8bf7\u586b\u5199\u90ae\u7bb1\u548c\u9a8c\u8bc1\u7801')
    return
  }
  bindSubmitting.value = true
  try {
    await authApi.bindEmail(bindEmail.value.trim(), bindCode.value.trim())
    message.success('\u90ae\u7bb1\u7ed1\u5b9a\u6210\u529f')
    bindEmail.value = ''
    bindCode.value = ''
    await reload()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u7ed1\u5b9a\u5931\u8d25')
  } finally {
    bindSubmitting.value = false
  }
}


function openOAuthBind(binding: PortalOAuthBinding) {
  oauthBindChannel.value = binding.channel
  oauthBindLabel.value = binding.label
  oauthBindOpen.value = true
}

async function unbindOAuth(channel: string, label: string) {
  if (!(await confirm({
    title: `解绑${label}`,
    message: '解绑后将无法使用该方式快捷登录，确定继续？',
    tone: 'warning',
    confirmText: '解绑',
  }))) return
  try {
    await authApi.unbindOAuth(channel)
    message.success('已解绑')
    await reload()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '解绑失败')
  }
}


function onOAuthBound() {
  void reload()
}

function scrollPageToTop() {
  document.querySelector<HTMLElement>('.arena-content')?.scrollTo({ top: 0, behavior: 'auto' })
}

function goTab(next: PortalTab) {
  selectTab(next)
}

function selectTab(next: PortalTab) {
  if (next === activeTab.value) return
  scrollPageToTop()
  navigate(portalPathForTab(next))
}

async function handleBugSubmit(payload: {
  title: string
  content: string
  priority: 'low' | 'normal' | 'high'
}) {
  try {
    await portalApi.createTicket(payload.title, payload.content, payload.priority)
    message.success('\u53cd\u9988\u5df2\u63d0\u4ea4')
    const ticketRes = await portalApi.tickets()
    tickets.value = ticketRes?.list || []
  } catch (e) {
    message.error(e instanceof Error ? e.message : '\u63d0\u4ea4\u5931\u8d25')
    throw e
  }
}


function onUsagePageChange(page: number) {
  void loadUsage(page, usagePageSize.value)
}

function onUsagePageSizeChange(size: number) {
  void loadUsage(1, size)
}

function onRechargePageChange(page: number) {
  void loadRechargeList(page, rechargePageSize.value)
}

function onRechargePageSizeChange(size: number) {
  void loadRechargeList(1, size)
}

watch(activeTab, (t) => {
  if (t === 'usage' && usage.value.length === 0 && !usageLoading.value) {
    void loadUsage(1, usagePageSize.value)
  }
  if (t === 'wallet' && rechargeRecords.value.length === 0 && !rechargeLoading.value) {
    void loadRechargeList(1, rechargePageSize.value)
  }
  if (isSettingsTab(t) && !arenaSettingsLoading.value) {
    void loadArenaSettings()
  }
  if (t === 'keys' && profile.value?.gatewayReady) {
    void syncAppSoftwareKey()
  }
})

watch(
  () => route.value.path,
  (_path, oldPath) => {
    if (!oldPath) return
    const oldSegments = oldPath.split('?')[0].split('/').filter(Boolean)
    const oldRoute = {
      name: oldSegments[0] || 'home',
      id: oldSegments[1] || null,
      path: oldPath,
    }
    if (portalTabFromRoute(route.value) !== portalTabFromRoute(oldRoute)) {
      scrollPageToTop()
    }
  }
)

provide(PORTAL_SHELL_KEY, {
  profile,
  displayName,
  avatarUrl,
  avatarInitial,
  keys,
  gatewayReady,
  activeKeysCount,
  recentUsage,
  usageColumns,
  wallet,
  balancePoints,
  rechargeConfig,
  rechargeReady,
  rechargeRecords,
  rechargeLoading,
  rechargeColumns,
  rechargePagination,
  appKeyName,
  appDisplayName,
  appSoftwareKey,
  appKeyPlain,
  newKeyPlain,
  creatingAppKey,
  loading,
  tickets,
  usage,
  usageLoading,
  usagePagination,
  usageChartOption,
  usagePageSummary,
  accountDetails,
  securityItems,
  bindEmail,
  bindCode,
  bindSending,
  bindSubmitting,
  bindCountdown,
  oauthBindings,
  signingOut,
  arenaSettings,
  arenaSettingsSaving,
  settingsTabMeta,
  boolOptions,
  identityModeOptions,
  retentionDayOptions,
  goTab,
  createAppKey,
  copyNewAppKey,
  openWechatRecharge,
  onRechargePageChange,
  onRechargePageSizeChange,
  handleBugSubmit,
  sendBindCode,
  submitBindEmail,
  unbindOAuth,
  openOAuthBind,
  forceLogout,
  updateLocalProfile,
  resetArenaSettings,
  setArenaSetting,
  setMatchDefault,
  setCharacterEvolution,
  saveArenaSettings,
  onUsagePageChange,
  onUsagePageSizeChange,
  message,
})

onMounted(() => {
  const legacy = resolveLegacyPortalPath(getCurrentPath())
  if (legacy) {
    navigate(legacy)
    return
  }
  if (isSettingsRoute.value) void loadArenaSettings()
  void reload()
})

onBeforeUnmount(() => {
  if (bindCountdownTimer) clearInterval(bindCountdownTimer)
})
</script>

<template>
  <div class="page page-wide portal-page portal-page--viewport-lock">
    <NSpin class="portal-page-spin" :show="loading && !profile">
      <AppEmptyState
        v-if="!profile && !loading && loadError && !isSettingsRoute"
        title="账户信息加载失败"
        :description="loadError"
      >
        <NSpace justify="center">
          <NButton type="primary" @click="reload">重试</NButton>
          <NButton tertiary type="error" :loading="signingOut" @click="forceLogout">
            退出登录
          </NButton>
        </NSpace>
      </AppEmptyState>

      <template v-else-if="profile || !loading">
        <div class="portal-page__body">
        <NAlert v-if="profile?.needsEmailBind && !isSettingsRoute" type="warning" class="profile-alert" :bordered="false">
          <template #icon>
            <Mail :size="18" />
          </template>
          请先绑定并验证邮箱，以开通模型网关账户。
          <NButton size="small" type="primary" style="margin-left: 12px" @click="selectTab('security')">去绑定</NButton>
        </NAlert>

        <div class="profile-center-layout">
          <div class="profile-tab-bar" role="tablist" :aria-label="isSettingsRoute ? '设置中心分类' : '用户中心分类'">
            <div v-for="group in profileNavGroups" :key="group.label" class="profile-tab-group">
              <p>{{ group.label }}</p>
              <button
                v-for="item in group.items"
                :key="item.id"
                type="button"
                role="tab"
                class="profile-tab-btn"
                :class="{ 'is-active': activeTab === item.id }"
                :aria-selected="activeTab === item.id"
                @click="selectTab(item.id)"
              >
                <component :is="item.icon" :size="18" />
                {{ item.label }}
              </button>
            </div>
          </div>

          <section class="portal-panel profile-panel">
            <PortalTabView :key="activeTab" :tab="activeTab" />
          </section>

        </div>
        </div>

        <WechatRechargeModal
          v-model="wechatRechargeOpen"
          :initial-amount-yuan="wechatRechargePresetYuan"
          @paid="onRechargePaid"
        />
        <OAuthBindModal
          v-model:show="oauthBindOpen"
          :channel="oauthBindChannel"
          :channel-label="oauthBindLabel"
          @bound="onOAuthBound"
        />
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.portal-page {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  width: 100%;
  max-width: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 18px clamp(38px, 4.2vw, 70px);
  box-sizing: border-box;
}

.portal-page :deep(.portal-page-spin.n-spin-container),
.portal-page :deep(.portal-page-spin > .n-spin-content) {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.portal-page :deep(.n-alert) {
  flex: 0 0 auto;
  margin-bottom: 12px;
}

.portal-page__body {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.profile-tab-bar {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  align-self: stretch;
  position: relative;
  top: auto;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  max-height: none;
  padding: 12px 10px;
  border: 1px solid var(--profile-nav-border);
  border-radius: 22px;
  background: var(--profile-nav-bg);
  box-shadow: var(--profile-nav-shadow);
  backdrop-filter: blur(var(--profile-glass-blur));
  -webkit-backdrop-filter: blur(var(--profile-glass-blur));
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-tab-bar::-webkit-scrollbar {
  display: none;
}

.profile-tab-group + .profile-tab-group {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--profile-head-border);
}

.profile-tab-group {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  width: 100%;
  min-width: 0;
}

.profile-tab-group p {
  margin: 0 0 4px 8px;
  color: var(--muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.profile-center-layout {
  flex: 1 1 0;
  min-height: 0;
  display: grid;
  grid-template-columns: 212px minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: var(--profile-layout-gap);
  max-width: none;
  width: 100%;
  margin: 0;
  align-items: stretch;
  height: 100%;
  overflow: hidden;
}

.profile-tab-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: var(--profile-tab-height);
  margin-bottom: 2px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 10px;
  color: var(--text-secondary);
  background: transparent;
  font: inherit;
  font-size: var(--text-sm);
  font-weight: 520;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    background 0.18s ease,
    color 0.18s ease,
    border-color 0.18s ease;
}

.profile-tab-btn:hover {
  transform: translateX(2px);
  background: var(--profile-tab-hover-bg);
}

.profile-tab-btn :deep(svg) {
  flex-shrink: 0;
}

.profile-tab-btn.is-active {
  color: var(--brand);
  border-color: color-mix(in srgb, var(--brand) 18%, transparent);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--brand) 15%, transparent), var(--profile-tab-active-bg)),
    var(--profile-tab-hover-bg);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--brand) 78%, transparent);
}

.profile-panel {
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow: hidden;
  border: 1px solid var(--profile-panel-border);
  border-radius: 26px;
  background: var(--profile-panel-bg);
  box-shadow: var(--profile-panel-shadow);
  backdrop-filter: blur(var(--profile-glass-blur));
  -webkit-backdrop-filter: blur(var(--profile-glass-blur));
}

.profile-section {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 0;
  padding: 0;
}

.profile-panel :deep(.profile-section) {
  display: flex;
  flex-direction: column;
  flex: 1 1 0;
  min-height: 0;
  gap: 0;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 0;
  overflow: hidden;
}

.profile-panel :deep(.profile-section__head) {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  position: relative;
  margin: 0;
  padding: var(--profile-head-padding-block) var(--profile-head-padding-inline) 14px;
  background: transparent;
  border-bottom: 1px solid var(--profile-head-border);
  z-index: 1;
}

.profile-panel :deep(.profile-section__intro) {
  flex: 1 1 auto;
  min-width: 0;
}

.profile-panel :deep(.profile-section__actions) {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.profile-panel :deep(.profile-section__body) {
  flex: 1 1 0;
  min-height: 0;
  padding: var(--profile-body-padding-block) var(--profile-body-padding-inline);
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-panel :deep(.profile-section__body::-webkit-scrollbar) {
  display: none;
}

.profile-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  min-height: 42px;
}

.profile-section__intro {
  flex: 1 1 auto;
  min-width: 0;
}

.profile-section__actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.profile-section__head--compact {
  min-height: auto;
}

.profile-section__title {
  margin: 0;
  color: var(--text);
  font-size: var(--text-xl);
  font-weight: 680;
  line-height: 1.2;
}

.profile-section__desc {
  margin: 5px 0 0;
  max-width: 100%;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-panel :deep(.profile-section__desc) {
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-panel :deep(.portal-plain-block) {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 14px;
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  background: color-mix(in srgb, var(--surface) 94%, transparent);
}

.profile-panel :deep(.portal-plain-block__title) {
  margin: 0;
  color: var(--text);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.3;
}

.profile-panel :deep(.portal-plain-block__desc) {
  margin: 0 0 12px;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.profile-panel :deep(.portal-data-table-wrap) {
  border: 1px solid color-mix(in srgb, var(--line) 88%, transparent);
  border-radius: 14px;
  overflow: hidden;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
}

.profile-panel :deep(.portal-data-table .n-data-table-th) {
  background: color-mix(in srgb, var(--brand-soft) 42%, var(--surface));
  color: var(--soft);
  font-size: 12px;
  font-weight: 650;
  border-bottom: 1px solid var(--line);
}

.profile-panel :deep(.portal-data-table .n-data-table-td) {
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid color-mix(in srgb, var(--line) 72%, transparent);
}

.profile-panel :deep(.portal-data-table .n-data-table-tr:not(.n-data-table-tr--summary):hover .n-data-table-td) {
  background: color-mix(in srgb, var(--brand) 5%, transparent);
}

.profile-panel :deep(.portal-data-table .n-data-table-tr:last-child .n-data-table-td) {
  border-bottom: none;
}

.profile-panel :deep(.portal-data-table .n-data-table-wrapper) {
  border-radius: 14px;
}

.profile-panel :deep(.portal-data-table .n-pagination) {
  padding: 10px 12px 12px;
  justify-content: flex-end;
}

.profile-panel :deep(.portal-doc-content) {
  color: var(--text);
  font-size: var(--text-sm);
  line-height: 1.75;
}

.profile-panel :deep(.portal-doc-content h1),
.profile-panel :deep(.portal-doc-content h2),
.profile-panel :deep(.portal-doc-content h3) {
  margin: 1.4em 0 0.6em;
  color: var(--text);
  line-height: 1.35;
}

.profile-panel :deep(.portal-doc-content h1:first-child),
.profile-panel :deep(.portal-doc-content h2:first-child),
.profile-panel :deep(.portal-doc-content h3:first-child) {
  margin-top: 0;
}

.profile-panel :deep(.profile-section__actions .n-button:not(.n-button--tiny)) {
  height: 28px;
  min-height: 28px;
  padding-inline: 12px;
  font-size: var(--text-sm);
}

.profile-panel :deep(.profile-section__actions .n-button.n-button--text-type) {
  padding-inline: 8px;
}

.profile-panel :deep(.help-chat-section),
.profile-panel :deep(.portal-help-chat) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.profile-panel > :deep(.portal-tab-view) {
  flex: 1 1 0;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.profile-panel :deep(.portal-tab-view .profile-section),
.profile-panel :deep(.portal-tab-view .model-service-shell),
.profile-panel :deep(.portal-tab-view .help-chat-section) {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.profile-panel :deep(.portal-tab-view:not(:has(.profile-section))) {
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-panel :deep(.portal-tab-view:not(:has(.profile-section))::-webkit-scrollbar) {
  display: none;
}

.profile-panel :deep(.mntools-panel) {
  border: 1px solid var(--profile-card-border);
  border-radius: 18px;
  background: var(--profile-card-bg);
  box-shadow: none;
}

.profile-panel :deep(.mntools-panel .n-card-header) {
  background: transparent;
  padding-top: 16px;
  padding-inline: 20px;
}

.profile-panel :deep(.mntools-panel .n-card__content) {
  padding-inline: 20px;
  padding-bottom: 20px;
}

.profile-panel :deep(.mntools-panel:not(:has(.n-card-header)) .n-card__content) {
  padding-top: 20px;
}

.settings-panel-shell :deep(.settings-panel-body) {
  display: flex;
  flex-direction: column;
}

.profile-panel :deep(.profile-list-region) {
  min-height: 320px;
  display: flex;
  flex-direction: column;
}

.profile-panel :deep(.profile-list-region .n-data-table) {
  flex: 1;
}

.profile-panel :deep(.profile-list-region .profile-record-list) {
  flex: 1;
  min-height: 240px;
}

.profile-panel :deep(.profile-list-region .profile-empty) {
  flex: 1;
  min-height: 240px;
}

.profile-session-hint {
  margin: 0;
  line-height: 1.6;
}

.profile-range {
  width: min(220px, 100%);
  accent-color: var(--brand);
}

.profile-session-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}

.profile-session-row strong {
  display: block;
  color: #17205a;
  font-size: 15px;
  font-weight: 620;
}

.profile-session-row p {
  margin: 6px 0 0;
  line-height: 1.6;
}

.support-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.12fr) minmax(260px, 0.88fr);
  gap: 14px;
}

.support-grid--version {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.support-card :deep(.n-card__content),
.support-help-item :deep(.n-card__content) {
  display: grid;
  gap: 10px;
  min-height: 150px;
}

.support-card--wide :deep(.n-card__content) {
  min-height: 188px;
}

.support-card--template {
  grid-column: 1 / -1;
}

.support-card--template :deep(.n-card__content) {
  min-height: 98px;
}

.support-card__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  color: var(--brand);
  border-radius: 14px;
  background: var(--brand-soft);
}

.support-card strong,
.support-help-item strong {
  color: #17205a;
  font-size: 16px;
  font-weight: 650;
}

.support-card p,
.support-help-item p {
  margin: 0;
  color: #68739f;
  font-size: 13px;
  line-height: 1.65;
}

.support-card .n-button {
  justify-self: start;
  margin-top: 4px;
}

.support-history {
  min-height: 0;
}

.support-history--empty :deep(.n-card__content) {
  display: grid;
  gap: 8px;
}

.support-history--empty strong {
  color: #17205a;
  font-size: 15px;
}

.support-history--empty p {
  margin: 0;
  color: #7380a9;
  font-size: 13px;
}

.support-help-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.support-help-item :deep(.n-card__content) {
  min-height: 122px;
}

@media (max-width: 1280px) {
  .portal-page {
    padding-inline: 30px;
  }

  .profile-center-layout {
    grid-template-columns: 200px minmax(0, 1fr);
    gap: 14px;
  }

  .profile-tab-btn {
    font-size: 11.5px;
    padding-inline: 8px;
  }
}
</style>



