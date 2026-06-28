<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Copy, ExternalLink } from 'lucide-vue-next'
import { getAppFeatures, getRuntimeConfig } from '@renderer/composables/runtime-config'
import { useClientUpdate } from '@renderer/composables/useClientUpdate'
import { getDefaultApiBaseUrl } from '@renderer/services'
import { getApiBaseUrl } from '@renderer/services/config'
import { formatAcceleratorLabel } from '@renderer/composables/shortcut-utils'
import { SHORTCUT_CATALOG, getShortcutBinding } from '@renderer/composables/useShortcutSettings'
import { confirm } from '@renderer/composables/useAppDialog'
import { NAlert, NButton, useMessage } from '../../ui'

const message = useMessage()
const features = getAppFeatures()
const config = getRuntimeConfig()
const displayUrl = computed(() => getApiBaseUrl() || getDefaultApiBaseUrl())

const { checkingUpdate, currentVersion, checkAndDownloadUpdate, runInAppUpdate } = useClientUpdate()
const version = computed(() => currentVersion.value || '0.1.0')
const updateSummary = ref<string | null>(null)
const deeplinkProtocol = ref('')
const lastDeeplink = ref('')
let offDeeplink: (() => void) | undefined

async function loadVersion() {
  const r = await window.api.getVersion?.()
  if (r?.ok && r.version) currentVersion.value = r.version
  else if (typeof window.api.getRuntimeMeta === 'function') {
    const meta = await window.api.getRuntimeMeta()
    currentVersion.value = meta.appVersion
  }
}

async function checkUpdate() {
  if (!features.autoUpdate) {
    message.info('当前应用未启用自动更新')
    return
  }
  const result = await checkAndDownloadUpdate()
  if (!result?.res) {
    updateSummary.value = '暂无可用更新'
    return
  }
  updateSummary.value = `发现新版本 ${result.res.latestVersion}`
  const confirmed = await confirm({
    title: `发现新版本 ${result.res.latestVersion}`,
    message: '是否下载并安装？',
    confirmText: '下载并安装',
  })
  if (confirmed && result.res.downloadUrl && result.res.latestVersion) {
    await runInAppUpdate(result.res.downloadUrl, result.res.latestVersion)
  }
}

async function copyDiagnostics() {
  const lines = [
    `应用: ${config.displayName} (${config.appId})`,
    `产品码: ${config.productCode}`,
    `版本: ${version.value}`,
    `平台地址: ${displayUrl.value}`,
    `系统: ${navigator.platform}`,
    `语言: ${navigator.language}`,
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    message.success('诊断信息已复制')
  } catch {
    message.error('复制失败')
  }
}

async function openHelpSite() {
  const url = 'https://github.com/czmanong/manong-arena'
  if (typeof window.api.openExternal === 'function') {
    const r = await window.api.openExternal(url)
    if (!r?.ok) message.error(r?.error || '无法打开链接')
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

onMounted(async () => {
  await loadVersion()
  if (!features.deeplink) return
  const p = await window.api.getDeeplinkProtocol?.()
  if (p?.ok) deeplinkProtocol.value = p.protocol || ''
  const l = await window.api.getLastDeeplink?.()
  if (l?.ok && l.url) lastDeeplink.value = l.url
  offDeeplink = window.api.onDeeplinkReceived?.((url) => {
    lastDeeplink.value = url
  })
})

onBeforeUnmount(() => offDeeplink?.())
</script>

<template>
  <div class="settings-panel-body">
    <div class="about-hero about-hero--inline">
      <span class="about-hero__logo" aria-hidden="true">{{ config.displayName.trim()[0]?.toUpperCase() || 'M' }}</span>
      <div>
        <h2 class="settings-panel-title" style="margin: 0">{{ config.displayName }}</h2>
        <p class="text-muted" style="margin: 4px 0 0">{{ config.description }}</p>
        <p class="about-version">版本 {{ version }}</p>
      </div>
    </div>

    <dl class="settings-info-list">
      <div v-if="features.platform">
        <dt>平台 API 地址</dt>
        <dd>
          <code class="code-block settings-api-url">{{ displayUrl }}</code>
          <p class="text-muted settings-info-hint" title="登录后不可修改，如需更换请退出登录后在登录窗口调整。">登录后不可改，请退出后在登录页调整。</p>
        </dd>
      </div>
      <div>
        <dt>应用 ID</dt>
        <dd><code class="code-inline">{{ config.appId }}</code></dd>
      </div>
      <div v-if="features.deeplink && deeplinkProtocol">
        <dt>Deep Link 协议</dt>
        <dd><code class="code-inline">{{ deeplinkProtocol }}://</code></dd>
      </div>
      <div v-if="features.deeplink && lastDeeplink">
        <dt>最近唤起</dt>
        <dd class="text-muted">{{ lastDeeplink }}</dd>
      </div>
    </dl>

    <div class="about-shortcuts">
      <p class="about-shortcuts__title">常用快捷键</p>
      <dl class="about-list">
        <div v-for="item in SHORTCUT_CATALOG" :key="item.id">
          <dt>{{ item.label }}</dt>
          <dd>
            <code class="code-inline">{{ formatAcceleratorLabel(getShortcutBinding(item.id).accelerator) }}</code>
          </dd>
        </div>
      </dl>
      <p class="text-muted about-shortcuts__hint">可在「快捷键」页自定义组合键。</p>
    </div>

    <div class="settings-panel-actions">
      <NButton v-if="features.autoUpdate" size="small" type="primary" :loading="checkingUpdate" @click="checkUpdate">
        检查更新
      </NButton>
      <NButton size="small" @click="copyDiagnostics">
        <Copy :size="14" style="margin-right: 4px; vertical-align: -2px" />
        复制诊断信息
      </NButton>
      <NButton size="small" @click="openHelpSite">
        <ExternalLink :size="14" style="margin-right: 4px; vertical-align: -2px" />
        帮助文档
      </NButton>
    </div>

    <NAlert v-if="updateSummary && features.autoUpdate" type="info" :bordered="false">
      {{ updateSummary }}
    </NAlert>
  </div>
</template>
