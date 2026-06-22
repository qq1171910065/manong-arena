<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  BarChart3,
  Bell,
  BookOpen,
  Bot,
  FileQuestion,
  Gamepad2,
  Key,
  LogOut,
  Mail,
  MessageSquare,
  RotateCcw,
  Shield,
  SlidersHorizontal,
  Trophy,
  User,
  Volume2,
  Wallet,
  Zap,
  Activity,
} from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import WechatRechargeModal from '../../components/billing/WechatRechargeModal.vue'
import AppKeyPanel from '../../components/settings/AppKeyPanel.vue'
import BugReportPanel from '../../components/settings/BugReportPanel.vue'
import HelpChatPanel from '../../components/settings/HelpChatPanel.vue'
import LeaderboardPanel from '../../components/settings/LeaderboardPanel.vue'
import ModelDebugPanel from '../../components/settings/ModelDebugPanel.vue'
import ModelOverviewPanel from '../../components/settings/ModelOverviewPanel.vue'
import ModelServiceShell from '../../components/settings/ModelServiceShell.vue'
import ModelStreamPanel from '../../components/settings/ModelStreamPanel.vue'
import ProjectDocsPanel from '../../components/settings/ProjectDocsPanel.vue'
import UserProfilePanel from '../../components/settings/UserProfilePanel.vue'
import UserStatsPanel from '../../components/settings/UserStatsPanel.vue'
import VersionNotesPanel from '../../components/settings/VersionNotesPanel.vue'
import WalletPanel from '../../components/settings/WalletPanel.vue'
import OAuthBindModal from '../../components/settings/OAuthBindModal.vue'
import DisplaySettingsPanel from '../../components/settings/DisplaySettingsPanel.vue'
import SettingsRow from '../../components/settings/SettingsRow.vue'
import SettingsSegment from '../../components/settings/SettingsSegment.vue'
import {
  AppChart,
  AppEmptyState,
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NForm,
  NFormItem,
  NInput,
  NSpace,
  NSpin,
  NTag,
  useDialog,
  useMessage,
} from '../../ui'
import {
  authApi,
  getAppKeyName,
  getStoredGatewayKey,
  portalApi,
  setStoredGatewayKey,
  userInfoRef,
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
import { navigate, route } from '../../router'
import type { ArenaSettings } from '@shared/arena/types'

type SettingsTab =
  | 'settings-display'
  | 'settings-audio'
  | 'settings-gameplay'
  | 'settings-room'
  | 'settings-notice'
  | 'settings-data'
type Tab =
  | 'overview'
  | 'user-stats'
  | 'security'
  | 'keys'
  | 'wallet'
  | 'usage'
  | 'support-version'
  | 'support-bug'
  | 'support-help'
  | 'support-docs'
  | 'model-overview'
  | 'model-debug'
  | 'model-stream'
  | 'model-leaderboard'
  | 'model-service'
  | SettingsTab

function normalizeTab(value: string | null): Tab | null {
  if (!value) return null
  if (value === 'model-service') return 'model-debug'
  return isTab(value) ? value : null
}

function tabFromPath(path = window.location.hash): Tab {
  const normalizedPath = path.replace(/^#/, '')
  const tabValue = new URLSearchParams(normalizedPath.split('?')[1] || '').get('tab')
  const normalized = normalizeTab(tabValue)
  return normalized && normalized !== 'overview' ? normalized : 'overview'
}

function isSettingsTab(value: unknown): value is SettingsTab {
  return (
    value === 'settings-display' ||
    value === 'settings-audio' ||
    value === 'settings-gameplay' ||
    value === 'settings-room' ||
    value === 'settings-notice' ||
    value === 'settings-data'
  )
}

function isTab(value: unknown): value is Tab {
  return (
    value === 'overview' ||
    value === 'user-stats' ||
    value === 'security' ||
    value === 'keys' ||
    value === 'wallet' ||
    value === 'usage' ||
    value === 'support-version' ||
    value === 'support-bug' ||
    value === 'support-help' ||
    value === 'support-docs' ||
    value === 'model-overview' ||
    value === 'model-debug' ||
    value === 'model-stream' ||
    value === 'model-leaderboard' ||
    value === 'model-service' ||
    isSettingsTab(value)
  )
}

function isModelServiceTab(value: Tab): value is 'model-overview' | 'model-debug' | 'model-stream' {
  return value === 'model-overview' || value === 'model-debug' || value === 'model-stream'
}

const message = useMessage()
const dialog = useDialog()

const tab = ref<Tab>(tabFromPath())
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
const appSoftwareKey = computed(
  () => keys.value.find((k) => k.name === appKeyName && k.status === 'active') ?? null
)

const displayName = computed(() => profile.value?.name || profile.value?.username || '')
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
  { id: 'overview' as Tab, label: '\u7528\u6237\u4fe1\u606f', icon: User },
  { id: 'user-stats' as Tab, label: '\u7528\u6237\u7edf\u8ba1', icon: BarChart3 },
  { id: 'security' as Tab, label: '\u8d26\u53f7\u5b89\u5168', icon: Shield },
]

const billingTabs = [
  { id: 'wallet' as Tab, label: '\u94b1\u5305\u5145\u503c', icon: Wallet },
  { id: 'usage' as Tab, label: '\u7528\u91cf\u7edf\u8ba1', icon: BarChart3 },
  { id: 'keys' as Tab, label: '\u6a21\u578b\u5bc6\u94a5', icon: Key },
]

const supportTabs = [
  { id: 'support-version' as Tab, label: '\u7248\u672c\u8bf4\u660e', icon: FileQuestion },
  { id: 'support-bug' as Tab, label: '\u62a5 bug', icon: MessageSquare },
  { id: 'support-help' as Tab, label: '\u5e2e\u52a9\u4e2d\u5fc3', icon: Mail },
  { id: 'support-docs' as Tab, label: '\u9879\u76ee\u6587\u6863', icon: BookOpen },
]

const modelServiceTabs = [
  { id: 'model-overview' as Tab, label: '\u6a21\u578b\u6982\u89c8', icon: Activity },
  { id: 'model-debug' as Tab, label: '\u8fde\u901a\u6027\u8c03\u8bd5', icon: Bot },
  { id: 'model-stream' as Tab, label: '\u6d41\u5f0f\u8c03\u8bd5', icon: Zap },
  { id: 'model-leaderboard' as Tab, label: 'Agent \u6d4b\u8bc4\u699c', icon: Trophy },
]

const settingTabs = [
  { id: 'settings-display' as Tab, label: '\u663e\u793a\u4e0e\u52a8\u6548', icon: SlidersHorizontal },
  { id: 'settings-audio' as Tab, label: '\u58f0\u97f3\u8bbe\u7f6e', icon: Volume2 },
  { id: 'settings-gameplay' as Tab, label: '\u5f00\u5c40\u9ed8\u8ba4', icon: Gamepad2 },
  { id: 'settings-room' as Tab, label: '\u5c40\u5185\u4f53\u9a8c', icon: Bot },
  { id: 'settings-notice' as Tab, label: '\u63d0\u9192\u7b56\u7565', icon: Bell },
  { id: 'settings-data' as Tab, label: '\u6570\u636e\u4e0e\u8bb0\u5f55', icon: BarChart3 },
]

const profileNavGroups = [
  { label: '\u7528\u6237\u4fe1\u606f', items: accountTabs },
  { label: '\u7528\u91cf\u4e0e\u6d88\u8d39', items: billingTabs },
  { label: '\u6a21\u578b\u670d\u52a1', items: modelServiceTabs },
  { label: '\u670d\u52a1\u652f\u6301', items: supportTabs },
  { label: '\u5e94\u7528\u8bbe\u7f6e', items: settingTabs },
]

const isSettingsRoute = computed(() => route.value.name === 'settings')

const settingsTabMeta: Record<SettingsTab, { title: string; desc: string }> = {
  'settings-display': { title: '\u663e\u793a\u4e0e\u52a8\u6548', desc: '\u63a7\u5236\u5927\u5385\u3001\u5bf9\u5c40\u548c\u901a\u7528\u754c\u9762\u7684\u89c6\u89c9\u8868\u73b0\u3002' },
  'settings-audio': { title: '\u58f0\u97f3\u8bbe\u7f6e', desc: '\u7ba1\u7406\u5927\u5385\u97f3\u4e50\u3001\u64cd\u4f5c\u53cd\u9988\u548c\u97f3\u91cf\u5f3a\u5ea6\u3002' },
  'settings-gameplay': { title: '\u5f00\u5c40\u9ed8\u8ba4', desc: '\u8bbe\u7f6e\u65b0\u5efa\u5bf9\u5c40\u65f6\u9ed8\u8ba4\u4f7f\u7528\u7684\u8eab\u4efd\u5206\u914d\u4e0e\u5f00\u5c40\u786e\u8ba4\u3002' },
  'settings-room': { title: '\u5c40\u5185\u4f53\u9a8c', desc: '\u63a7\u5236\u5bf9\u5c40\u8fdb\u884c\u4e2d\u7684\u6a21\u578b\u63d0\u793a\u3001\u4f59\u989d\u4fdd\u62a4\u548c\u72b6\u6001\u53cd\u9988\u3002' },
  'settings-notice': { title: '\u63d0\u9192\u7b56\u7565', desc: '\u9009\u62e9\u54ea\u4e9b\u72b6\u6001\u53d8\u5316\u9700\u8981\u63d0\u9192\uff0c\u4ee5\u53ca\u4f55\u65f6\u63d0\u9192\u3002' },
  'settings-data': { title: '\u6570\u636e\u4e0e\u8bb0\u5f55', desc: '\u7ba1\u7406\u590d\u76d8\u8bb0\u5f55\u3001\u6570\u636e\u4fdd\u7559\u5468\u671f\u548c\u672c\u5730\u8bb0\u5f55\u7b56\u7565\u3002' },
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
    value: profile.value?.id ? String(profile.value.id) : '\u2014',
  },
  {
    id: 'customer',
    label: '\u5ba2\u6237 ID',
    value: profile.value?.customerId ? String(profile.value.customerId) : '\u2014',
  },
  {
    id: 'email',
    label: '\u90ae\u7bb1',
    value: profile.value?.emailDisplay || (profile.value?.needsEmailBind ? '\u672a\u7ed1\u5b9a' : '\u2014'),
    status: profile.value?.emailVerified === false ? 'warn' : profile.value?.emailBound ? 'ok' : 'muted',
  },
  {
    id: 'gateway',
    label: '\u6a21\u578b\u7f51\u5173',
    value: gatewayReady.value ? '\u5df2\u5c31\u7eea' : '\u5f85\u9a8c\u8bc1\u90ae\u7bb1',
    status: gatewayReady.value ? 'ok' : 'warn',
  },
  {
    id: 'local-key',
    label: '\u672c\u673a Key',
    value: hasLocalKey.value ? '\u5df2\u4fdd\u5b58' : '\u672a\u4fdd\u5b58',
    status: hasLocalKey.value ? 'ok' : 'muted',
  },
  {
    id: 'keys-count',
    label: '\u6709\u6548\u5bc6\u94a5',
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
        ? '\u90ae\u7bb1\u5c1a\u672a\u9a8c\u8bc1\uff0c\u90e8\u5206\u529f\u80fd\u53ef\u80fd\u53d7\u9650'
        : '\u90ae\u7bb1\u5df2\u9a8c\u8bc1\uff0c\u53ef\u6b63\u5e38\u4f7f\u7528\u7f51\u5173',
    ok: profile.value?.emailVerified !== false,
  },
  {
    id: 'wechat-bind',
    label: '\u5fae\u4fe1\u7ed1\u5b9a',
    desc: wechatBound.value
      ? '\u5df2\u7ed1\u5b9a\u5fae\u4fe1\uff0c\u53ef\u4f7f\u7528\u626b\u7801\u5feb\u6377\u767b\u5f55'
      : '\u7ed1\u5b9a\u5fae\u4fe1\u540e\u53ef\u4f7f\u7528\u626b\u7801\u767b\u5f55',
    ok: wechatBound.value,
  },
  {
    id: 'gateway',
    label: '\u7f51\u5173\u8d26\u6237',
    desc: gatewayReady.value
      ? '\u6a21\u578b\u7f51\u5173\u8d26\u6237\u5df2\u5f00\u901a\uff0c\u53ef\u53d1\u8d77 API \u8c03\u7528'
      : '\u7ed1\u5b9a\u5e76\u9a8c\u8bc1\u90ae\u7bb1\u540e\u5373\u53ef\u5f00\u901a\u7f51\u5173',
    ok: gatewayReady.value,
  },
  {
    id: 'api-key',
    label: 'API \u5bc6\u94a5',
    desc: activeKeysCount.value
      ? '\u5f53\u524d\u6709 ' + activeKeysCount.value + ' \u4e2a\u6709\u6548\u5bc6\u94a5' + (hasLocalKey.value ? '\uff0c\u672c\u673a\u5df2\u7f13\u5b58' : '')
      : '\u5efa\u8bae\u521b\u5efa API Key \u7528\u4e8e\u5ba2\u6237\u7aef\u8c03\u7528',
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
  arenaSettings.value = settings
  applyArenaSettingsEffects(settings)
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
  const snapshot = structuredClone(arenaSettings.value)
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
    if (tab.value === 'usage') await loadUsage(1, usagePageSize.value)
    if (tab.value === 'wallet') await loadRechargeList(1, rechargePageSize.value)
    if (isSettingsTab(tab.value)) await loadArenaSettings()
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
  signingOut.value = true
  try {
    await authApi.logout()
  } catch (err) {
    console.warn(err instanceof Error ? err.message : '\u9000\u51fa\u767b\u5f55\u5931\u8d25')
  } finally {
    signingOut.value = false
  }
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
  if (appSoftwareKey.value || creatingAppKey.value) return
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
  if (tab.value === 'wallet') {
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

function unbindOAuth(channel: string, label: string) {
  dialog.warning({
    title: '\u89e3\u7ed1' + label,
    content: '\u89e3\u7ed1\u540e\u5c06\u65e0\u6cd5\u4f7f\u7528\u8be5\u65b9\u5f0f\u5feb\u6377\u767b\u5f55\uff0c\u786e\u5b9a\u7ee7\u7eed\uff1f',
    positiveText: '\u89e3\u7ed1',
    negativeText: '\u53d6\u6d88',
    onPositiveClick: async () => {
      try {
        await authApi.unbindOAuth(channel)
        message.success('\u5df2\u89e3\u7ed1')
        await reload()
      } catch (e) {
        message.error(e instanceof Error ? e.message : '\u89e3\u7ed1\u5931\u8d25')
      }
    },
  })
}


function onOAuthBound() {
  void reload()
}

function goTab(next: Tab) {
  tab.value = next
}

function tabToPath(t: Tab): string | null {
  const routeName = route.value.name
  if (routeName === 'profile') {
    return t === 'overview' ? '/profile' : `/profile?tab=${t}`
  }
  if (routeName === 'settings') {
    return t === 'overview' ? '/settings' : `/settings?tab=${t}`
  }
  return null
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

watch(tab, (t) => {
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
  (path) => {
    const next = tabFromPath(path)
    if (next !== tab.value) tab.value = next
  }
)

watch(tab, (t) => {
  const current = tabFromPath(route.value.path)
  if (current === t) return
  const nextPath = tabToPath(t)
  if (!nextPath) return
  void nextTick(() => navigate(nextPath))
})

onMounted(() => {
  if (isSettingsRoute.value) void loadArenaSettings()
  void reload()
})

onBeforeUnmount(() => {
  if (bindCountdownTimer) clearInterval(bindCountdownTimer)
})
</script>

<template>
  <div class="page page-wide portal-page">
    <NSpin :show="loading && !profile">
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
        <NAlert v-if="profile?.needsEmailBind && !isSettingsRoute" type="warning" class="profile-alert" :bordered="false">
          <template #icon>
            <Mail :size="18" />
          </template>
          请先绑定并验证邮箱，以开通模型网关账户。
          <NButton size="small" type="primary" style="margin-left: 12px" @click="tab = 'security'">去绑定</NButton>
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
                :class="{ 'is-active': tab === item.id }"
                :aria-selected="tab === item.id"
                @click="tab = item.id"
              >
                <component :is="item.icon" :size="18" />
                {{ item.label }}
              </button>
            </div>
          </div>

          <section :key="tab" class="portal-panel profile-panel">
            <UserProfilePanel
              v-if="tab === 'overview'"
              :profile="profile"
              :display-name="displayName"
              :avatar-initial="avatarInitial"
              :gateway-ready="gatewayReady"
              :active-keys-count="activeKeysCount"
              :recent-usage="recentUsage"
              :usage-columns="usageColumns"
              @navigate="goTab($event as Tab)"
            />

            <UserStatsPanel v-else-if="tab === 'user-stats'" />

            <div v-else-if="tab === 'security'" class="profile-section">
            <div class="profile-section__head">
              <div>
                <h3 class="profile-section__title">账号安全</h3>
                <p class="profile-section__desc">管理邮箱验证、第三方账号绑定与登录状态。</p>
              </div>
            </div>

            <div class="profile-section__body">

            <NCard class="mntools-panel profile-detail-card" title="账户信息">
              <dl class="profile-detail-grid">
                <div
                  v-for="item in accountDetails"
                  :key="item.id"
                  class="profile-detail-item"
                >
                  <dt>{{ item.label }}</dt>
                  <dd>
                    <span>{{ item.value }}</span>
                    <span
                      v-if="item.status"
                      class="profile-detail-status"
                      :class="`profile-detail-status--${item.status}`"
                      aria-hidden="true"
                    />
                  </dd>
                </div>
              </dl>
            </NCard>

            <NCard class="mntools-panel" title="安全状态">
              <ul class="profile-record-list">
                <li
                  v-for="item in securityItems"
                  :key="item.id"
                  class="profile-record-item profile-record-item--status"
                >
                  <div class="profile-record-item__main">
                    <span
                      class="profile-record-status"
                      :class="item.ok ? 'profile-record-status--ok' : 'profile-record-status--warn'"
                      aria-hidden="true"
                    />
                    <div>
                      <strong>{{ item.label }}</strong>
                      <p>{{ item.desc }}</p>
                    </div>
                  </div>
                </li>
              </ul>
            </NCard>

            <NCard v-if="profile?.needsEmailBind || profile?.emailVerified === false" class="mntools-panel profile-bind-card" title="绑定邮箱">
              <p class="text-muted" style="margin-bottom: 12px">
                若该邮箱已注册，将自动合并到原账号并绑定微信，不会重复创建用户。
              </p>
              <NForm label-placement="top">
                <NFormItem label="邮箱">
                  <NInput v-model:value="bindEmail" type="text" placeholder="name@example.com" />
                </NFormItem>
                <NFormItem label="验证码">
                  <NSpace>
                    <NInput
                      v-model:value="bindCode"
                      inputmode="numeric"
                      maxlength="6"
                      placeholder="6 位验证码"
                      style="min-width: 140px"
                      :disabled="bindSubmitting"
                    />
                    <NButton
                      :disabled="!bindEmail.trim() || bindCountdown > 0"
                      :loading="bindSending"
                      @click="sendBindCode"
                    >
                      {{ bindCountdown > 0 ? bindCountdown + 's \u540e\u91cd\u53d1' : '\u53d1\u9001\u9a8c\u8bc1\u7801' }}
                    </NButton>
                  </NSpace>
                </NFormItem>
                <NButton
                  type="primary"
                  :loading="bindSubmitting"
                  :disabled="!bindEmail.trim() || !bindCode.trim()"
                  @click="submitBindEmail"
                >
                  绑定
                </NButton>
              </NForm>
            </NCard>

            <NCard v-if="oauthBindings.length" class="mntools-panel" title="第三方账号">
              <p class="text-muted profile-oauth-desc">绑定后可使用扫码等方式快捷登录</p>
              <ul class="profile-record-list">
                <li v-for="item in oauthBindings" :key="item.channel" class="profile-record-item">
                  <div class="profile-record-item__main">
                    <strong>{{ item.label }}</strong>
                  </div>
                  <div class="profile-record-item__meta">
                    <NTag :type="item.bound ? 'success' : 'default'" size="small" :bordered="false">
                      {{ item.bound ? '\u5df2\u7ed1\u5b9a' : '\u672a\u7ed1\u5b9a' }}
                    </NTag>
                    <NButton
                      v-if="item.bound"
                      size="small"
                      tertiary
                      type="error"
                      @click="unbindOAuth(item.channel, item.label)"
                    >
                      解绑
                    </NButton>
                    <NButton v-else size="small" type="primary" @click="openOAuthBind(item)">
                      绑定
                    </NButton>
                  </div>
                </li>
              </ul>
            </NCard>

            <NCard class="mntools-panel profile-session-card" title="登录状态">
              <div class="profile-session-row">
                <div>
                  <strong>当前账号已登录</strong>
                  <p class="text-muted">退出后会清除本地登录状态、网关 Key 缓存，并返回登录窗口。</p>
                </div>
                <NButton tertiary type="error" :loading="signingOut" @click="forceLogout">
                  <template #icon>
                    <LogOut :size="16" />
                  </template>
                  退出登录
                </NButton>
              </div>
            </NCard>
            </div>
          </div>

            <VersionNotesPanel v-else-if="tab === 'support-version'" />

            <BugReportPanel
              v-else-if="tab === 'support-bug'"
            :tickets="tickets"
            :loading="loading"
            :on-submit="handleBugSubmit"
            />

            <HelpChatPanel v-else-if="tab === 'support-help'" />

            <ProjectDocsPanel v-else-if="tab === 'support-docs'" />

            <AppKeyPanel
              v-else-if="tab === 'keys'"
            :app-key-name="appKeyName"
            :app-display-name="appDisplayName"
            :app-key="appSoftwareKey"
            :new-key-plain="newKeyPlain"
            :creating="creatingAppKey"
            :loading="loading"
            @create="createAppKey"
            @copy-new-key="copyNewAppKey"
            />

            <WalletPanel
              v-else-if="tab === 'wallet'"
            :wallet="wallet"
            :balance-points="balancePoints"
            :recharge-config="rechargeConfig"
            :recharge-ready="rechargeReady"
            :recharge-records="rechargeRecords"
            :recharge-loading="rechargeLoading"
            :recharge-columns="rechargeColumns"
            :recharge-pagination="rechargePagination"
            @recharge="openWechatRecharge"
            @page-change="onRechargePageChange"
            @page-size-change="onRechargePageSizeChange"
            />

            <LeaderboardPanel v-else-if="tab === 'model-leaderboard'" />

            <ModelServiceShell v-else-if="isModelServiceTab(tab)">
              <ModelOverviewPanel v-if="tab === 'model-overview'" />
              <ModelDebugPanel v-else-if="tab === 'model-debug'" />
              <ModelStreamPanel v-else-if="tab === 'model-stream'" />
            </ModelServiceShell>

            <div v-else-if="isSettingsTab(tab)" class="profile-section">
            <div class="profile-section__head">
              <div>
                <h3 class="profile-section__title">{{ settingsTabMeta[tab].title }}</h3>
                <p class="profile-section__desc">{{ settingsTabMeta[tab].desc }}</p>
              </div>
              <NButton quaternary :loading="arenaSettingsSaving" @click="resetArenaSettings">
                <template #icon><RotateCcw :size="14" /></template>
                恢复默认
              </NButton>
            </div>

            <div class="profile-section__body settings-panel-shell">
              <DisplaySettingsPanel
                v-if="tab === 'settings-display'"
                :settings="arenaSettings"
                @update="(key, value) => setArenaSetting(key, value)"
              />

              <div v-else class="settings-panel-body">
                <template v-if="tab === 'settings-audio'">
                  <SettingsRow label="背景音乐" hint="大厅与房间的环境音乐">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.bgmEnabled"
                      :options="boolOptions"
                      @update:model-value="(v) => setArenaSetting('bgmEnabled', Boolean(v))"
                    />
                  </SettingsRow>
                  <SettingsRow label="界面音效" hint="按钮、卡片和操作反馈声音">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.sfxEnabled"
                      :options="boolOptions"
                      @update:model-value="(v) => setArenaSetting('sfxEnabled', Boolean(v))"
                    />
                  </SettingsRow>
                  <SettingsRow label="音乐音量" :hint="`${arenaSettings.bgmVolume}%`">
                    <input
                      v-model.number="arenaSettings.bgmVolume"
                      type="range"
                      min="0"
                      max="100"
                      class="profile-range"
                      @change="saveArenaSettings"
                    />
                  </SettingsRow>
                  <SettingsRow label="音效音量" :hint="`${arenaSettings.sfxVolume}%`">
                    <input
                      v-model.number="arenaSettings.sfxVolume"
                      type="range"
                      min="0"
                      max="100"
                      class="profile-range"
                      @change="saveArenaSettings"
                    />
                  </SettingsRow>
                </template>

                <template v-else-if="tab === 'settings-gameplay'">
                  <SettingsRow label="默认身份分配" hint="新建对局时的默认身份分配方式">
                    <SettingsSegment
                      :model-value="arenaSettings.defaultIdentityAssignMode"
                      :options="identityModeOptions"
                      @update:model-value="
                        (v) => setArenaSetting('defaultIdentityAssignMode', v as ArenaSettings['defaultIdentityAssignMode'])
                      "
                    />
                  </SettingsRow>
                  <SettingsRow label="开局前确认" hint="创建对局后先展示规则与阵容确认">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.matchDefaults.confirmBeforeStart"
                      :options="boolOptions"
                      @update:model-value="(v) => setMatchDefault('confirmBeforeStart', Boolean(v))"
                    />
                  </SettingsRow>
                </template>

                <template v-else-if="tab === 'settings-room'">
                  <SettingsRow label="模型调用提示" hint="模型行动和等待状态提示">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.modelCallHints"
                      :options="boolOptions"
                      @update:model-value="(v) => setArenaSetting('modelCallHints', Boolean(v))"
                    />
                  </SettingsRow>
                  <SettingsRow label="低余额暂停" hint="余额低于阈值时，开局或继续前先暂停确认">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.matchDefaults.pauseOnLowBalance"
                      :options="boolOptions"
                      @update:model-value="(v) => setMatchDefault('pauseOnLowBalance', Boolean(v))"
                    />
                  </SettingsRow>
                </template>

                <template v-else-if="tab === 'settings-notice'">
                  <SettingsRow label="余额提醒" hint="余额不足或活动更新时提醒">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.balanceReminder"
                      :options="boolOptions"
                      @update:model-value="(v) => setArenaSetting('balanceReminder', Boolean(v))"
                    />
                  </SettingsRow>
                  <SettingsRow label="余额提醒阈值" :hint="`${(arenaSettings.balanceReminderThresholdCents / 100).toFixed(2)} 元`">
                    <input
                      v-model.number="arenaSettings.balanceReminderThresholdCents"
                      type="range"
                      min="100"
                      max="5000"
                      step="100"
                      class="profile-range"
                      @change="saveArenaSettings"
                    />
                  </SettingsRow>
                </template>

                <template v-else>
                  <SettingsRow label="自动保存记录" hint="对局结束后保留复盘记录">
                    <SettingsSegment
                      variant="bool"
                      :model-value="arenaSettings.autoSaveMatch"
                      :options="boolOptions"
                      @update:model-value="(v) => setArenaSetting('autoSaveMatch', Boolean(v))"
                    />
                  </SettingsRow>
                  <SettingsRow label="记录保留周期" hint="本地对局与日志的默认保留时间">
                    <SettingsSegment
                      :model-value="String(arenaSettings.dataRetentionDays)"
                      :options="retentionDayOptions"
                      @update:model-value="
                        (v) => setArenaSetting('dataRetentionDays', Number(v) as ArenaSettings['dataRetentionDays'])
                      "
                    />
                  </SettingsRow>
                </template>
              </div>
            </div>
          </div>

            <div v-else-if="tab === 'usage'" class="profile-section">
            <div class="profile-section__head">
              <div>
                <h3 class="profile-section__title">用量统计</h3>
                <p class="profile-section__desc">查看模型调用趋势与明细记录。</p>
              </div>
            </div>

            <div class="profile-section__body">

            <div class="profile-usage-summary">
              <div class="profile-usage-stat">
                <span>总记录</span>
                <strong>{{ usagePageSummary.records.toLocaleString() }}</strong>
              </div>
              <div class="profile-usage-stat">
                <span>本页费用</span>
                <strong>{{ usagePageSummary.cost.toFixed(4) }} 元</strong>
              </div>
              <div class="profile-usage-stat">
                <span>本页 Token</span>
                <strong>{{ usagePageSummary.tokens.toLocaleString() }}</strong>
              </div>
            </div>

            <NCard class="mntools-panel profile-chart-card" title="用量趋势">
              <AppChart
                v-if="usage.length"
                :option="usageChartOption"
                height="260px"
                :loading="usageLoading"
              />
              <div v-else class="profile-empty">
                <BarChart3 :size="28" />
                <p>暂无用量数据</p>
                <span>发起模型调用后将在此展示趋势</span>
              </div>
            </NCard>

            <NCard class="mntools-panel profile-table-card profile-list-region" title="模型用量明细">
              <NDataTable
                remote
                :columns="usageColumns"
                :data="usage"
                :loading="usageLoading"
                :pagination="usagePagination"
                :bordered="false"
                size="small"
                @update:page="onUsagePageChange"
                @update:page-size="onUsagePageSizeChange"
              />
            </NCard>
            </div>
          </div>
          </section>

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
  height: 100%;
  min-height: 0;
  width: 100%;
  max-width: none;
  padding: 18px clamp(38px, 4.2vw, 70px) 18px;
  overflow: hidden;
}

.portal-page :deep(.n-spin-container),
.portal-page :deep(.n-spin-content) {
  height: 100%;
  min-height: 0;
}

.portal-page :deep(.n-spin-content) {
  display: flex;
  flex-direction: column;
}

.portal-page :deep(.n-alert) {
  flex: 0 0 auto;
  margin-bottom: 12px;
}

.profile-tab-bar {
  display: flex;
  flex-direction: column;
  flex-wrap: nowrap;
  align-items: stretch;
  align-self: stretch;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: 0;
  overflow: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  padding: 12px 10px;
  border: 1px solid var(--profile-nav-border);
  border-radius: 22px;
  background: var(--profile-nav-bg);
  box-shadow: var(--profile-nav-shadow);
  backdrop-filter: blur(var(--profile-glass-blur));
  -webkit-backdrop-filter: blur(var(--profile-glass-blur));
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
  flex: 1;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 212px minmax(0, 1fr);
  gap: var(--profile-layout-gap);
  max-width: none;
  width: 100%;
  margin: 0;
  align-items: stretch;
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
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  scrollbar-width: none;
  -ms-overflow-style: none;
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
  min-height: 0;
  overflow: hidden;
  gap: 0;
  min-height: 100%;
  padding: 0;
}

.profile-panel :deep(.profile-section) {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  gap: 0;
  min-height: 100%;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: 0;
}

.profile-panel :deep(.profile-section__head) {
  flex: 0 0 auto;
  position: relative;
  margin: 0;
  padding: var(--profile-head-padding-block) var(--profile-head-padding-inline) 12px;
  background: var(--profile-head-bg);
  border-bottom: 1px solid var(--profile-head-border);
  z-index: 1;
}

.profile-panel :deep(.profile-section__body) {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--profile-body-padding-block) var(--profile-body-padding-inline) 24px;
  display: flex;
  flex-direction: column;
  gap: var(--profile-body-gap);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-panel :deep(.profile-section__body::-webkit-scrollbar) {
  display: none;
}

.profile-section__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  min-height: 42px;
}

.profile-section__actions {
  flex-shrink: 0;
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
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.65;
  max-width: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.profile-panel :deep(.mntools-panel) {
  border: 1px solid var(--profile-card-border);
  border-radius: 18px;
  background: var(--profile-card-bg);
  box-shadow: none;
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

.profile-panel :deep(.profile-list-region .n-card__content) {
  flex: 1;
  min-height: 260px;
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

.profile-panel::-webkit-scrollbar {
  display: none;
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



