<script setup lang="ts">
import { CheckCircle2, Lock, Mail, QrCode, RefreshCw, Server, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { NAlert, NButton, NInput, NInputGroup } from '../../ui'
import { authApi, completeAuthSession, fetchPlatformPing, getPortalSession } from '@renderer/services'
import { toWechatLoginQrDataUrl } from './wechat-qr'
import { isWebRuntime } from '@renderer/composables/useRuntime'
import { getApiBaseUrl, saveApiBaseUrlFromInput } from '@renderer/services/config'
import type { LoginCapabilities, PortalSession } from '@shared/types'
import bgImage from '../../assets/home/home-bg-clean.png'
import brandLockup from '../../assets/home/brand-lockup-v2.png'
import mascotCat from '../../assets/home/mascot-cat-v2.png'
import avatarDoubao from '../../assets/characters/avatars/avatar-doubao.png'
import avatarGpt from '../../assets/characters/avatars/avatar-gpt.png'
import avatarClaude from '../../assets/characters/avatars/avatar-claude.png'

const props = defineProps<{
  appName: string
  login: LoginCapabilities
  defaultHomePath?: string
}>()

type LoginMethod = 'email' | 'password'
type AuthView = 'login' | 'register' | 'wechat'

const LOGIN_CACHE_KEY = 'arena-login-cache-v2'

interface LoginCache {
  account?: string
  email?: string
  method?: LoginMethod
}

function readLoginCache(): LoginCache {
  try {
    const raw = localStorage.getItem(LOGIN_CACHE_KEY)
    return raw ? (JSON.parse(raw) as LoginCache) : {}
  } catch {
    return {}
  }
}

function writeLoginCache(next: LoginCache) {
  try {
    localStorage.setItem(LOGIN_CACHE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

const cached = readLoginCache()
const loginMethod = ref<LoginMethod>(cached.method || (props.login.emailCode ? 'email' : 'password'))
const authView = ref<AuthView>('login')
const email = ref(cached.email || cached.account || '')
const code = ref('')
const username = ref(cached.account || cached.email || '')
const password = ref('')
const regEmail = ref('')
const regUsername = ref('')
const regPassword = ref('')
const regCode = ref('')
const regCountdown = ref(0)
const captchaRequired = ref(false)
const captchaId = ref('')
const captchaImage = ref('')
const captchaCode = ref('')
const captchaLoading = ref(false)
const loading = ref(false)
const error = ref('')
const settingsError = ref('')
const countdown = ref(0)
const apiBaseInput = ref(getApiBaseUrl())
const settingsSaved = ref(false)
const pingOk = ref(false)
const pingLoading = ref(false)
const configOpen = ref(false)

const wechatState = ref('')
const wechatQr = ref('')
const wechatQrLoading = ref(false)
const wechatScanned = ref(false)
const wechatExpired = ref(false)
const wechatExpiresIn = ref(0)
const wechatCountdownSec = ref(0)
const wechatAvailable = ref(props.login.wechatOAuth)
const wechatLinkEmail = ref('')
const wechatLinkCode = ref('')
const wechatNeedEmail = ref(false)
const wechatCountdown = ref(0)
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let wechatCountdownTimer: ReturnType<typeof setInterval> | null = null
let wechatQrExpiryTimer: ReturnType<typeof setInterval> | null = null
let regCountdownTimer: ReturnType<typeof setInterval> | null = null

const isWeb = isWebRuntime()

const loginMethods = computed(() => {
  const list: Array<{ id: LoginMethod; label: string }> = []
  if (props.login.emailCode) list.push({ id: 'email', label: '邮箱验证码' })
  if (props.login.password) list.push({ id: 'password', label: '账号密码' })
  return list
})

const canShowRegister = computed(() => props.login.emailCode || props.login.password)

const stageSlogans = [
  '让每个模型都有自己的灵魂',
  '与 AI 伙伴共赴一场推理之旅',
  '在角色与博弈之间找到你的节奏',
]

const stageDescriptions = [
  '从狼人杀到阿瓦隆,选一个剧本,就能开启一场有记忆点的对局。',
  '每位 Agent 都有不同的语气,判断和性格。',
  '登录后继续你的对局,保存角色,记录和模型服务配置。',
]

const stageTitleIndex = ref(0)
const stageDescIndex = ref(0)
const stageTypedText = ref('')
const stageTitle = computed(() => stageSlogans[stageTitleIndex.value] || '')
let stageTitleTimer: ReturnType<typeof setInterval> | null = null
let stageTypeTimer: ReturnType<typeof setInterval> | null = null
let stageDescTimer: ReturnType<typeof setInterval> | null = null

function typeStageDescription(text: string) {
  if (stageTypeTimer) clearInterval(stageTypeTimer)
  stageTypedText.value = ''
  let index = 0
  stageTypeTimer = setInterval(() => {
    index += 1
    stageTypedText.value = text.slice(0, index)
    if (index >= text.length && stageTypeTimer) {
      clearInterval(stageTypeTimer)
      stageTypeTimer = null
    }
  }, 42)
}

function startStageMotion() {
  typeStageDescription(stageDescriptions[stageDescIndex.value] || '')
  if (stageTitleTimer) clearInterval(stageTitleTimer)
  if (stageDescTimer) clearInterval(stageDescTimer)
  stageTitleTimer = setInterval(() => {
    stageTitleIndex.value = (stageTitleIndex.value + 1) % stageSlogans.length
  }, 4200)
  stageDescTimer = setInterval(() => {
    stageDescIndex.value = (stageDescIndex.value + 1) % stageDescriptions.length
    typeStageDescription(stageDescriptions[stageDescIndex.value] || '')
  }, 5200)
}

const pageTitle = computed(() => {
  if (authView.value === 'register') return '创建你的竞技身份'
  if (authView.value === 'wechat') return '微信快速进入'
  return '回到 Agent Arena'
})

const pageDesc = computed(() => {
  if (authView.value === 'register') return '用邮箱创建账号,保存你的 AI 角色,对局记录与模型服务配置。'
  if (authView.value === 'wechat') return '扫码后即可进入大厅,未绑定邮箱时会引导你完成一次绑定。'
  return '连接你的模型伙伴,继续未完成的推理,博弈与角色对话。'
})

const viewEyebrow = computed(() => {
  if (authView.value === 'register') return 'NEW PLAYER'
  if (authView.value === 'wechat') return 'SCAN TO START'
  return 'AGENT LOBBY'
})

const wechatHint = computed(() => {
  if (wechatNeedEmail.value) return ''
  if (wechatScanned.value) return '已扫码,请在手机上确认授权'
  if (wechatExpired.value) return '二维码已过期,请刷新后重试'
  if (wechatCountdownSec.value > 0) return `请使用微信扫码登录,${wechatCountdownSec.value}s 内有效`
  return '请使用微信扫码登录'
})

const loginBgStyle = computed(() => ({
  '--arena-login-bg': `url(${bgImage})`,
}))

const canSendCode = computed(() => countdown.value <= 0 && email.value.trim().length > 0 && !loading.value)

const canSendWechatCode = computed(
  () => wechatCountdown.value <= 0 && wechatLinkEmail.value.trim().length > 0 && !loading.value
)

const canSubmitWechatLink = computed(
  () => wechatLinkEmail.value.trim().length > 0 && wechatLinkCode.value.trim().length > 0
)

const canPasswordLogin = computed(
  () =>
    username.value.trim().length > 0 &&
    password.value.length > 0 &&
    (!captchaRequired.value || captchaCode.value.trim().length > 0) &&
    !loading.value
)

const canRegister = computed(
  () =>
    regEmail.value.trim().length > 0 &&
    regUsername.value.trim().length > 0 &&
    regPassword.value.length >= 6 &&
    regCode.value.trim().length > 0 &&
    !loading.value
)

const canSendRegCode = computed(
  () => regCountdown.value <= 0 && regEmail.value.trim().length > 0 && !loading.value
)

function closeLogin() {
  void window.windowControls?.close?.()
}

function startCountdown(sec = 60) {
  countdown.value = sec
  if (countdownTimer) clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) clearInterval(countdownTimer)
  }, 1000)
}

function startWechatCountdown(sec = 60) {
  wechatCountdown.value = sec
  if (wechatCountdownTimer) clearInterval(wechatCountdownTimer)
  wechatCountdownTimer = setInterval(() => {
    wechatCountdown.value -= 1
    if (wechatCountdown.value <= 0 && wechatCountdownTimer) clearInterval(wechatCountdownTimer)
  }, 1000)
}

function startRegCountdown(sec = 60) {
  regCountdown.value = sec
  if (regCountdownTimer) clearInterval(regCountdownTimer)
  regCountdownTimer = setInterval(() => {
    regCountdown.value -= 1
    if (regCountdown.value <= 0 && regCountdownTimer) clearInterval(regCountdownTimer)
  }, 1000)
}

function persistLoginCache() {
  const account = username.value.trim() || email.value.trim()
  writeLoginCache({
    account,
    email: email.value.trim() || account,
    method: loginMethod.value,
  })
}

async function loadCaptcha() {
  captchaLoading.value = true
  try {
    const res = await authApi.fetchCaptcha()
    captchaId.value = res.captchaId
    captchaImage.value = res.data.startsWith('data:') ? res.data : `data:image/png;base64,${res.data}`
    captchaCode.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : '绑定失败'
  } finally {
    captchaLoading.value = false
  }
}

async function checkPasswordCaptcha() {
  const account = username.value.trim()
  if (!account || !props.login.password) return
  try {
    const res = await authApi.checkLoginCaptcha(account)
    captchaRequired.value = Boolean(res.captchaRequired)
    if (captchaRequired.value && !captchaImage.value) await loadCaptcha()
    if (!captchaRequired.value) {
      captchaId.value = ''
      captchaImage.value = ''
      captchaCode.value = ''
    }
  } catch {
    /* ignore guard probe errors */
  }
}

async function completeLogin(session: PortalSession) {
  persistLoginCache()
  await completeAuthSession(session, props.defaultHomePath || '/home')
}

async function onEmailLogin() {
  if (!syncApiBaseForRequest()) return
  error.value = '微信登录模块未安装'
  loading.value = true
  try {
    const result = await authApi.emailLogin(email.value.trim(), code.value.trim())
    const session = getPortalSession()
    if (session) await completeLogin(session)
    else if (result.token) {
      await completeLogin({
        token: result.token,
        refreshToken: result.refreshToken || '',
        expire: result.expire || 0,
        refreshExpire: result.refreshExpire || 0,
        name: result.userInfo.name,
        username: result.userInfo.username,
        email: email.value,
        customerId: result.userInfo.customerId ?? null,
      })
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
  } finally {
    loading.value = false
  }
}

async function onPasswordLogin() {
  if (!syncApiBaseForRequest()) return
  error.value = ''
  loading.value = true
  try {
    await checkPasswordCaptcha()
    const captcha =
      captchaRequired.value && captchaId.value
        ? { captchaId: captchaId.value, verifyCode: captchaCode.value.trim() }
        : undefined
    await authApi.login(username.value.trim(), password.value, captcha)
    const session = getPortalSession()
    if (session) await completeLogin(session)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '登录失败'
    if (captchaRequired.value) await loadCaptcha()
  } finally {
    loading.value = false
  }
}

async function onRegister() {
  if (!syncApiBaseForRequest()) return
  error.value = ''
  loading.value = true
  try {
    await authApi.register({
      email: regEmail.value.trim(),
      username: regUsername.value.trim(),
      password: regPassword.value,
      verifyCode: regCode.value.trim(),
    })
    const session = getPortalSession()
    if (session) await completeLogin(session)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '注册失败'
  } finally {
    loading.value = false
  }
}

async function sendRegCode() {
  if (!canSendRegCode.value) return
  error.value = ''
  try {
    await authApi.sendVerifyCode(regEmail.value.trim(), 'register')
    startRegCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
  }
}

async function sendCode() {
  if (!canSendCode.value) return
  error.value = ''
  try {
    await authApi.sendVerifyCode(email.value.trim(), 'login')
    startCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
  }
}

function stopWechatPoll() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

function stopWechatQrExpiry() {
  if (wechatQrExpiryTimer) {
    clearInterval(wechatQrExpiryTimer)
    wechatQrExpiryTimer = null
  }
}

function startWechatQrExpiry(sec = 180) {
  stopWechatQrExpiry()
  wechatExpiresIn.value = sec
  wechatCountdownSec.value = sec
  wechatQrExpiryTimer = setInterval(() => {
    wechatCountdownSec.value -= 1
    if (wechatCountdownSec.value <= 0) {
      stopWechatQrExpiry()
      stopWechatPoll()
      wechatExpired.value = true
      error.value = '二维码已过期,请刷新后重试'
    }
  }, 1000)
}

async function detectWechatAvailability() {
  if (!props.login.wechatOAuth) {
    wechatAvailable.value = false
    return
  }
  try {
    if (!syncApiBaseForRequest()) return
    const opts = await authApi.getOfficeWechatOptions()
    wechatAvailable.value = opts.enabled
  } catch {
    wechatAvailable.value = false
  }
}

async function startWechat() {
  if (!syncApiBaseForRequest()) return
  error.value = ''
  wechatNeedEmail.value = false
  wechatScanned.value = false
  wechatExpired.value = false
  wechatLinkEmail.value = ''
  wechatLinkCode.value = ''
  wechatCountdown.value = 0
  wechatQrLoading.value = true
  wechatQr.value = ''
  stopWechatPoll()
  stopWechatQrExpiry()
  try {
    const { state, authorizeUrl, expiresIn } = await authApi.startOfficeWechatLogin()
    wechatState.value = state
    if (wechatAvailable.value) {
      try {
        wechatQr.value = await toWechatLoginQrDataUrl(authorizeUrl)
      } catch {
        error.value = '微信登录模块未安装'
        return
      }
    }
    startWechatQrExpiry(expiresIn)
    pollTimer = setInterval(() => void pollWechat(), 2000)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '微信登录启动失败'
  } finally {
    wechatQrLoading.value = false
  }
}

async function pollWechat() {
  if (!wechatState.value) return
  try {
    const r = await authApi.pollOfficeWechatOAuth(wechatState.value)
    if (r.status === 'ok') {
      stopWechatPoll()
      stopWechatQrExpiry()
      const session = getPortalSession()
      if (session) await completeLogin(session)
    } else if (r.status === 'need_email') {
      stopWechatPoll()
      stopWechatQrExpiry()
      wechatNeedEmail.value = true
    } else if (r.status === 'scanned') {
      wechatScanned.value = true
      wechatExpired.value = false
      error.value = ''
    } else if (r.status === 'expired') {
      stopWechatPoll()
      stopWechatQrExpiry()
      wechatExpired.value = true
      error.value = r.message || '微信登录失败'
    } else if (r.status === 'error') {
      stopWechatPoll()
      stopWechatQrExpiry()
      error.value = r.message || '微信登录失败'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '轮询失败'
  }
}

async function sendWechatLinkCode() {
  if (!canSendWechatCode.value) return
  error.value = ''
  try {
    await authApi.sendWechatLinkEmailCode(wechatState.value, wechatLinkEmail.value.trim())
    startWechatCountdown()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '发送失败'
  }
}

async function submitWechatLink() {
  if (!canSubmitWechatLink.value) return
  error.value = ''
  loading.value = true
  try {
    await authApi.submitWechatLinkEmail(
      wechatState.value,
      wechatLinkEmail.value.trim(),
      wechatLinkCode.value.trim()
    )
    const session = getPortalSession()
    if (session) await completeLogin(session)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '绑定失败'
  } finally {
    loading.value = false
  }
}

function syncApiBaseForRequest(): boolean {
  const r = saveApiBaseUrlFromInput(apiBaseInput.value)
  if (!r.ok) {
    error.value = 'undefined'
    return false
  }
  return true
}

function saveApiBase() {
  const r = saveApiBaseUrlFromInput(apiBaseInput.value)
  if (!r.ok) {
    settingsError.value = 'undefined'
    settingsSaved.value = false
    pingOk.value = false
    return
  }
  settingsError.value = ''
  settingsSaved.value = true
  pingOk.value = false
}

async function pingApi() {
  const r = saveApiBaseUrlFromInput(apiBaseInput.value)
  if (!r.ok) {
    settingsError.value = 'undefined'
    settingsSaved.value = false
    pingOk.value = false
    return
  }
  pingOk.value = false
  settingsSaved.value = false
  pingLoading.value = true
  try {
    const res = await fetchPlatformPing(apiBaseInput.value.trim() || undefined)
    if (res.ok) {
      settingsError.value = ''
      pingOk.value = true
    } else {
      settingsError.value = res.error
      pingOk.value = false
    }
  } finally {
    pingLoading.value = false
  }
}

function onLoginKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || loading.value) return
  if (authView.value === 'register' && canRegister.value) {
    void onRegister()
    return
  }
  if (authView.value !== 'login') return
  if (loginMethod.value === 'email' && code.value.trim()) void onEmailLogin()
  else if (loginMethod.value === 'password' && canPasswordLogin.value) void onPasswordLogin()
}

function onWechatKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter' || loading.value) return
  if (wechatNeedEmail.value && canSubmitWechatLink.value) void submitWechatLink()
}

function switchLoginMethod(next: LoginMethod) {
  loginMethod.value = next
  error.value = ''
  writeLoginCache({ ...readLoginCache(), method: next })
  if (next === 'password') void checkPasswordCaptcha()
}

function openRegister() {
  authView.value = 'register'
  error.value = ''
}

function openLogin() {
  stopWechatPoll()
  stopWechatQrExpiry()
  wechatNeedEmail.value = false
  wechatScanned.value = false
  wechatExpired.value = false
  authView.value = 'login'
  error.value = ''
}

async function openWechatLogin() {
  if (!props.login.wechatOAuth) return
  if (!wechatAvailable.value) await detectWechatAvailability()
  if (!wechatAvailable.value) {
    error.value = '微信登录暂不可用,请稍后重试'
    return
  }
  authView.value = 'wechat'
  error.value = ''
  await startWechat()
}

watch(username, (value) => {
  if (loginMethod.value === 'password') writeLoginCache({ ...readLoginCache(), account: value.trim() })
})

watch(email, (value) => {
  if (loginMethod.value === 'email') writeLoginCache({ ...readLoginCache(), email: value.trim(), account: value.trim() })
})

onMounted(async () => {
  startStageMotion()
  await detectWechatAvailability()
  if (!loginMethods.value.some((item) => item.id === loginMethod.value)) {
    loginMethod.value = loginMethods.value[0]?.id ?? 'email'
  }
})

onBeforeUnmount(() => {
  stopWechatPoll()
  stopWechatQrExpiry()
  if (countdownTimer) clearInterval(countdownTimer)
  if (wechatCountdownTimer) clearInterval(wechatCountdownTimer)
  if (regCountdownTimer) clearInterval(regCountdownTimer)
  if (stageTitleTimer) clearInterval(stageTitleTimer)
  if (stageTypeTimer) clearInterval(stageTypeTimer)
  if (stageDescTimer) clearInterval(stageDescTimer)
})
</script>

<template>
  <div class="arena-login" :style="loginBgStyle">
    <header class="arena-login__nav">
      <div class="arena-login__brand" aria-label="登录方式">
        <img :src="brandLockup" alt="验证码" />
      </div>
      <div class="arena-login__window-actions">
        <div class="arena-login__service-popover" :class="{ 'is-open': configOpen }">
          <button type="button" class="arena-login__icon-btn" title="服务地址" @click="configOpen = !configOpen">
            <Server :size="15" />
          </button>
          <div v-if="configOpen" class="arena-login__service-card">
            <div class="arena-login__service-head">
              <strong>服务地址</strong>
              <span>邮箱</span>
            </div>
            <NInput v-model:value="apiBaseInput" placeholder="http://127.0.0.1:8010" spellcheck="false" />
            <div class="arena-login__config-actions">
              <NButton size="small" type="primary" @click="saveApiBase">保存</NButton>
              <NButton size="small" :loading="pingLoading" @click="pingApi">测试连接</NButton>
            </div>
            <p v-if="settingsSaved && !settingsError" class="arena-login__feedback arena-login__feedback--ok"><CheckCircle2 :size="14" /> 已保存</p>
            <p v-else-if="pingOk && !settingsError" class="arena-login__feedback arena-login__feedback--ok"><CheckCircle2 :size="14" /> 连接成功</p>
            <NAlert v-if="settingsError" type="error" :bordered="false" class="arena-login__error">{{ settingsError }}</NAlert>
          </div>
        </div>
        <button
          type="button"
          class="arena-login__icon-btn arena-login__icon-btn--close"
          :title="isWeb ? '关闭' : '退出'"
          @click="closeLogin"
        >
          <X :size="16" />
        </button>
      </div>
    </header>

    <main class="arena-login__body">
      <section class="arena-login__stage" aria-hidden="true">
        <div class="arena-login__stage-copy">
          <p class="arena-login__stage-kicker"><span>AI 推理竞技大厅</span></p>
          <h2 :key="stageTitle" class="arena-login__stage-title">{{ stageTitle }}</h2>
          <span class="arena-login__stage-desc">{{ stageTypedText }}<i aria-hidden="true" /></span>
        </div>
        <div class="arena-login__avatar-stack">
          <img :src="avatarDoubao" alt="" />
          <img :src="avatarGpt" alt="" />
          <img :src="avatarClaude" alt="" />
        </div>
        <img class="arena-login__mascot" :src="mascotCat" alt="" />
      </section>

      <section class="arena-login__panel" :class="{ 'is-wechat': authView === 'wechat' }">
        <button
          v-if="props.login.wechatOAuth && authView !== 'register'"
          type="button"
          class="arena-login__qr-corner"
          :class="{ 'is-account': authView === 'wechat' }"
          :title="authView === 'wechat' ? '账号登录' : '微信扫码登录'"
          @click="authView === 'wechat' ? openLogin() : openWechatLogin()"
        >
          <Lock v-if="authView === 'wechat'" :size="18" />
          <QrCode v-else :size="19" />
        </button>

        <header class="arena-login__head">
          <p class="arena-login__eyebrow">{{ viewEyebrow }}</p>
          <h1 class="arena-login__title">{{ pageTitle }}</h1>
          <p class="arena-login__desc">{{ pageDesc }}</p>
        </header>

        <template v-if="authView === 'login'">
          <div v-if="loginMethods.length > 1" class="arena-login__tabs" role="tablist" aria-label="登录方式">
            <button
              v-for="t in loginMethods"
              :key="t.id"
              type="button"
              role="tab"
              class="arena-login__tab"
              :class="{ 'is-active': loginMethod === t.id }"
              :aria-selected="loginMethod === t.id"
              @click="switchLoginMethod(t.id)"
            >
              {{ t.label }}
            </button>
          </div>

          <div class="arena-login__form" role="tabpanel" @keydown.enter="onLoginKeydown">
            <template v-if="loginMethod === 'email'">
              <label class="arena-login__field">
                <span>账号</span>
                <NInput v-model:value="email" type="text" autocomplete="email" placeholder="请输入密码" :disabled="loading" />
              </label>
              <label class="arena-login__field">
                <span>密码</span>
                <NInputGroup>
                  <NInput v-model:value="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位数字" :disabled="loading" />
                  <NButton :disabled="!canSendCode" @click="sendCode">
                    {{ countdown > 0 ? `${countdown}s` : '获取验证码' }}
                  </NButton>
                </NInputGroup>
              </label>
              <NButton type="primary" block class="arena-login__submit" :loading="loading" :disabled="!code.trim()" @click="onEmailLogin">
                <template #icon><Mail :size="15" /></template>
                进入大厅
              </NButton>
            </template>

            <template v-else-if="loginMethod === 'password'">
              <label class="arena-login__field">
                <span>图形验证码</span>
                <NInput v-model:value="username" autocomplete="username" placeholder="用户名或邮箱" :disabled="loading" @blur="checkPasswordCaptcha" />
              </label>
              <label class="arena-login__field">
                <span>邮箱</span>
                <NInput v-model:value="password" type="password" autocomplete="current-password" placeholder="请输入密码" :disabled="loading" />
              </label>
              <label v-if="captchaRequired" class="arena-login__field">
                <span>用户名</span>
                <div class="arena-login__captcha">
                  <NInput v-model:value="captchaCode" placeholder="验证码" maxlength="6" :disabled="loading" />
                  <button type="button" class="arena-login__captcha-img" :disabled="captchaLoading" @click="loadCaptcha">
                    <img v-if="captchaImage" :src="captchaImage" alt="验证码" />
                    <span v-else>加载</span>
                  </button>
                </div>
              </label>

              <NButton type="primary" block class="arena-login__submit" :loading="loading" :disabled="!canPasswordLogin" @click="onPasswordLogin">
                <template #icon><Lock :size="15" /></template>
                进入大厅
              </NButton>
            </template>
          </div>

          <NAlert v-if="error" type="error" :bordered="false" class="arena-login__error">{{ error }}</NAlert>


          <p v-if="canShowRegister" class="arena-login__switch">
            还没有账号？
            <button type="button" class="arena-login__switch-link" @click="openRegister">创建一个</button>
          </p>
        </template>

        <template v-else-if="authView === 'register'">
          <div class="arena-login__form" @keydown.enter="onLoginKeydown">
            <label class="arena-login__field"><span>邮箱</span><NInput v-model:value="regEmail" type="text" autocomplete="email" placeholder="name@example.com" /></label>
            <label class="arena-login__field"><span>用户名</span><NInput v-model:value="regUsername" autocomplete="username" placeholder="登录用户名" /></label>
            <label class="arena-login__field"><span>密码</span><NInput v-model:value="regPassword" type="password" autocomplete="new-password" placeholder="至少 6 位" /></label>
            <label class="arena-login__field">
              <span>验证码</span>
              <NInputGroup>
                <NInput v-model:value="regCode" inputmode="numeric" maxlength="6" placeholder="6 位数字" />
                <NButton :disabled="!canSendRegCode" @click="sendRegCode">{{ regCountdown > 0 ? `${regCountdown}s` : '获取验证码' }}</NButton>
              </NInputGroup>
            </label>
            <NButton type="primary" block class="arena-login__submit" :loading="loading" :disabled="!canRegister" @click="onRegister">创建并进入</NButton>
          </div>
          <NAlert v-if="error" type="error" :bordered="false" class="arena-login__error">{{ error }}</NAlert>
          <p class="arena-login__switch">已有账号？<button type="button" class="arena-login__switch-link" @click="openLogin">返回登录</button></p>
        </template>

        <template v-else-if="authView === 'wechat'">
          <div v-if="wechatNeedEmail" class="arena-login__wechat arena-login__wechat--bind">
            <p class="arena-login__bind-hint">扫码成功,请绑定邮箱以完成账号归属。</p>
            <div class="arena-login__form" @keydown.enter="onWechatKeydown">
              <label class="arena-login__field"><span>邮箱</span><NInput v-model:value="wechatLinkEmail" type="text" autocomplete="email" placeholder="name@example.com" :disabled="loading" /></label>
              <label class="arena-login__field">
                <span>验证码</span>
                <NInputGroup>
                  <NInput v-model:value="wechatLinkCode" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6 位数字" :disabled="loading" />
                  <NButton :disabled="!canSendWechatCode" @click="sendWechatLinkCode">{{ wechatCountdown > 0 ? `${wechatCountdown}s` : '获取验证码' }}</NButton>
                </NInputGroup>
              </label>
              <NButton type="primary" block class="arena-login__submit" :loading="loading" :disabled="!canSubmitWechatLink" @click="submitWechatLink">完成绑定</NButton>
            </div>
            <button type="button" class="arena-login__wechat-action" @click="openLogin">返回登录</button>
          </div>

          <div v-else class="arena-login__wechat">
            <div class="arena-login__wechat-qr" :class="{ 'is-loading': wechatQrLoading, 'is-scanned': wechatScanned, 'is-expired': wechatExpired }">
              <div v-if="wechatQrLoading" class="arena-login__wechat-qr-skeleton" aria-hidden="true" />
              <img v-if="wechatQr" class="arena-login__wechat-qr-img" :src="wechatQr" alt="微信扫码登录" />
              <div v-else-if="!wechatQrLoading" class="arena-login__wechat-qr-empty"><QrCode :size="28" /></div>
              <div v-if="wechatScanned && !wechatExpired" class="arena-login__wechat-qr-status">已扫码</div>
              <div v-else-if="wechatExpired" class="arena-login__wechat-qr-status arena-login__wechat-qr-status--expired">已过期</div>
            </div>
            <p class="arena-login__wechat-hint" :class="{ 'is-scanned': wechatScanned, 'is-expired': wechatExpired }">{{ wechatHint }}</p>
            <div class="arena-login__wechat-actions">
              <button type="button" class="arena-login__wechat-action" :disabled="wechatQrLoading" @click="startWechat">
                <RefreshCw :size="14" :class="{ 'is-spinning': wechatQrLoading }" />刷新二维码</button>
              <span class="arena-login__wechat-action-sep" aria-hidden="true" />
              <button type="button" class="arena-login__wechat-action" @click="openLogin">返回登录</button>
            </div>
          </div>
          <NAlert v-if="error" type="error" :bordered="false" class="arena-login__error">{{ error }}</NAlert>
        </template>


      </section>
    </main>
  </div>
</template>
