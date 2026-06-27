<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import changelogRaw from '@renderer/data/changelog.md?raw'
import MarkdownContent from '../common/MarkdownContent.vue'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NSpin, useMessage } from '../../ui'
import { clientReleaseApi } from '@renderer/services'
import { useClientUpdate } from '@renderer/composables/useClientUpdate'

const message = useMessage()
const { checkingUpdate, currentVersion, checkAndDownloadUpdate, runInAppUpdate } = useClientUpdate()

const historyLoading = ref(false)
const historyItems = ref<Array<{ version: string; releaseNotes: string | null; publishedAt: string }>>([])

const pageDesc = computed(() =>
  currentVersion.value ? `当前版本 ${currentVersion.value} · 内置与线上发布记录` : '当前版本能力与线上发布记录'
)

async function loadHistory() {
  if (typeof window.api.getRuntimeMeta !== 'function') return
  historyLoading.value = true
  try {
    const meta = await window.api.getRuntimeMeta()
    currentVersion.value = meta.appVersion
    historyItems.value = await clientReleaseApi.listHistory(meta.platform, 20)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载发布历史失败')
  } finally {
    historyLoading.value = false
  }
}

async function onCheckUpdate() {
  const result = await checkAndDownloadUpdate()
  if (!result?.res?.hasUpdate || !result.res.downloadUrl || !result.res.latestVersion) return
  const notes = (result.res.releaseNotes || '').trim() || '暂无更新说明'
  const confirmed = window.confirm(
    `发现新版本 ${result.res.latestVersion}\n\n当前版本：${result.res.currentVersion}\n\n${notes}\n\n是否下载并安装？`
  )
  if (confirmed) {
    await runInAppUpdate(result.res.downloadUrl, result.res.latestVersion)
  }
}

onMounted(() => {
  void loadHistory()
})
</script>

<template>
  <ProfileSectionLayout title="版本说明" :desc="pageDesc">
    <template #actions>
      <NButton size="small" type="primary" :loading="checkingUpdate" @click="onCheckUpdate">
        检查更新
      </NButton>
    </template>

    <section class="portal-plain-block">
      <h4 class="portal-plain-block__title">内置更新日志</h4>
      <MarkdownContent :source="changelogRaw" />
    </section>

    <section class="portal-plain-block">
      <h4 class="portal-plain-block__title">线上发布记录</h4>
      <NSpin :show="historyLoading">
        <div v-if="historyItems.length" class="version-history">
          <article v-for="item in historyItems" :key="item.version" class="version-history__item">
            <header>
              <strong>v{{ item.version }}</strong>
              <span>{{ item.publishedAt || '—' }}</span>
            </header>
            <MarkdownContent
              v-if="item.releaseNotes"
              :source="item.releaseNotes"
              class="version-history__notes"
            />
            <p v-else class="version-history__empty">暂无说明</p>
          </article>
        </div>
        <p v-else class="version-history__empty">暂无已发布版本</p>
      </NSpin>
    </section>
  </ProfileSectionLayout>
</template>

<style scoped>
.version-history {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.version-history__item header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.version-history__item header strong {
  font-size: 15px;
}

.version-history__item header span {
  font-size: 12px;
  color: var(--text-secondary, #94a3b8);
}

.version-history__empty {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary, #94a3b8);
}
</style>
