<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Copy, ExternalLink } from 'lucide-vue-next'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { getApiBaseUrl } from '@renderer/services/config'
import { formatAcceleratorLabel } from '@renderer/composables/shortcut-utils'
import { SHORTCUT_CATALOG, getShortcutBinding } from '@renderer/composables/useShortcutSettings'
import { NButton, NCard, useMessage } from '../../ui'

const message = useMessage()
const config = getRuntimeConfig()
const version = ref('0.1.0')

async function loadVersion() {
  const r = await window.api.getVersion?.()
  if (r?.ok && r.version) version.value = r.version
}

async function copyDiagnostics() {
  const lines = [
    `应用: ${config.displayName} (${config.appId})`,
    `版本: ${version.value}`,
    `平台地址: ${getApiBaseUrl()}`,
    `系统: ${navigator.platform}`,
    `语言: ${navigator.language}`,
  ]
  try {
    await navigator.clipboard.writeText(lines.join('\n'))
    message.success('诊断信息已复制到剪贴板')
  } catch {
    message.error('复制失败')
  }
}

async function openHelpSite() {
  const url = 'https://github.com/workbuddy/mntools'
  if (typeof window.api.openExternal === 'function') {
    const r = await window.api.openExternal(url)
    if (!r?.ok) message.error(r?.error || '无法打开链接')
  } else {
    window.open(url, '_blank', 'noopener')
  }
}

onMounted(() => void loadVersion())
</script>

<template>
  <div>
    <NCard class="mntools-panel" title="快捷键" style="margin-bottom: 16px">
      <dl class="about-list">
        <div v-for="item in SHORTCUT_CATALOG" :key="item.id">
          <dt>{{ item.label }}</dt>
          <dd>
            <code class="code-inline">{{ formatAcceleratorLabel(getShortcutBinding(item.id).accelerator) }}</code>
          </dd>
        </div>
      </dl>
      <p class="text-muted" style="margin: 12px 0 0">可在「快捷键」页自定义组合键。</p>
    </NCard>

    <NCard class="mntools-panel" title="支持与反馈">
      <p class="text-muted" style="margin-bottom: 12px">
        遇到问题时可复制诊断信息发给开发者；正式产品请替换为你们的帮助文档与反馈渠道。
      </p>
      <div style="display: flex; flex-wrap: wrap; gap: 8px">
        <NButton @click="copyDiagnostics">
          <template #icon><Copy :size="14" /></template>
          复制诊断信息
        </NButton>
        <NButton @click="openHelpSite">
          <template #icon><ExternalLink :size="14" /></template>
          打开帮助文档
        </NButton>
      </div>
    </NCard>
  </div>
</template>
