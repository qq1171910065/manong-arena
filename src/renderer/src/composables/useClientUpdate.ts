import { ref } from 'vue'
import { useMessage } from '../ui'
import { isPortalLoggedIn, clientReleaseApi, type ClientReleaseLatest } from '@renderer/services'

const POLL_MS = 5 * 60 * 1000

function suggestedInstallerName(version: string, downloadUrl: string): string {
  try {
    const seg = new URL(downloadUrl).pathname.split('/').filter(Boolean).pop()
    if (seg) return seg
  } catch {
    /* ignore */
  }
  return `arena-${version}-setup.exe`
}

export function useClientUpdate() {
  const message = useMessage()
  const updateAvailable = ref(false)
  const checkingUpdate = ref(false)
  const latestVersion = ref<string | null>(null)
  const downloadUrl = ref<string | null>(null)
  const releaseNotes = ref<string | null>(null)
  const currentVersion = ref('')

  let pollTimer: ReturnType<typeof setInterval> | null = null

  async function refreshAvailability(): Promise<void> {
    if (!isPortalLoggedIn()) {
      updateAvailable.value = false
      return
    }
    if (typeof window.api.getRuntimeMeta !== 'function') return
    try {
      const meta = await window.api.getRuntimeMeta()
      currentVersion.value = meta.appVersion
      const res = await clientReleaseApi.checkLatest(meta.platform, meta.appVersion)
      latestVersion.value = res.latestVersion
      downloadUrl.value = res.downloadUrl
      releaseNotes.value = res.releaseNotes
      updateAvailable.value = Boolean(res.hasUpdate && res.downloadUrl && res.latestVersion)
    } catch {
      updateAvailable.value = false
    }
  }

  async function runInAppUpdate(url: string, version: string): Promise<void> {
    if (typeof window.api.downloadAndInstallClientUpdate !== 'function') {
      message.error('当前环境不支持应用内更新')
      return
    }

    let offProgress: (() => void) | undefined
    const loading = message.loading('正在下载更新 0%', { duration: 0 })

    try {
      offProgress = window.api.onClientUpdateProgress?.((p) => {
        if (p.phase === 'download' && p.percent != null) {
          loading.content = `正在下载更新 ${p.percent}%`
        } else if (p.phase === 'install') {
          loading.content = '正在启动安装程序…'
        }
      })

      const result = await window.api.downloadAndInstallClientUpdate({
        url,
        suggestedName: suggestedInstallerName(version, url),
      })

      if (!result.success) {
        message.error(result.error || '更新失败')
        return
      }
      message.success('安装程序已启动，应用即将退出')
    } finally {
      offProgress?.()
      loading.destroy()
    }
  }

  async function checkAndDownloadUpdate(options?: {
    silentIfUpToDate?: boolean
  }): Promise<{ res: ClientReleaseLatest } | null> {
    if (checkingUpdate.value) return null
    checkingUpdate.value = true
    try {
      if (typeof window.api.getRuntimeMeta !== 'function') {
        message.info('当前环境不支持检查更新')
        return null
      }
      const meta = await window.api.getRuntimeMeta()
      const res = await clientReleaseApi.checkLatest(meta.platform, meta.appVersion)
      currentVersion.value = res.currentVersion
      latestVersion.value = res.latestVersion
      downloadUrl.value = res.downloadUrl
      releaseNotes.value = res.releaseNotes
      updateAvailable.value = Boolean(res.hasUpdate && res.downloadUrl && res.latestVersion)

      if (!res.latestVersion || !res.downloadUrl) {
        updateAvailable.value = false
        message.info('暂无已发布的安装包')
        return null
      }
      if (!res.hasUpdate) {
        updateAvailable.value = false
        if (!options?.silentIfUpToDate) {
          message.success(`当前已是最新版本（${res.latestVersion}）`)
        }
        return null
      }

      return { res }
    } catch (e) {
      message.error(e instanceof Error ? e.message : '检查更新失败')
      return null
    } finally {
      checkingUpdate.value = false
    }
  }

  function startPolling(): void {
    void refreshAvailability()
    if (pollTimer) return
    pollTimer = setInterval(() => void refreshAvailability(), POLL_MS)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  return {
    updateAvailable,
    checkingUpdate,
    latestVersion,
    downloadUrl,
    releaseNotes,
    currentVersion,
    refreshAvailability,
    checkAndDownloadUpdate,
    runInAppUpdate,
    startPolling,
    stopPolling,
  }
}
