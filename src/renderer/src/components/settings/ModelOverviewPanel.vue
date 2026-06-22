<script setup lang="ts">
import { Copy } from 'lucide-vue-next'
import { useModelService } from '@renderer/composables/useModelService'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton, NCard, NSpace, useMessage } from '../../ui'

const message = useMessage()
const {
  statusCards,
  apiBase,
  gatewayRoot,
  gatewayChatBase,
} = useModelService()

async function copyGatewayUrl() {
  const url = gatewayRoot.value
  if (!url) return
  await navigator.clipboard.writeText(url)
  message.success('已复制模型网关地址')
}
</script>

<template>
  <ProfileSectionLayout
    title="模型概览"
    desc="查看 Platform 连接、模型网关与本机 Key 状态。模型列表来自网关 /api/pricing。"
  >

    <NCard class="mntools-panel" title="连接状态">
      <div class="profile-usage-summary model-service-status-grid">
        <div
          v-for="item in statusCards"
          :key="item.id"
          class="profile-usage-stat"
          :class="item.ok ? 'profile-usage-stat--ok' : 'profile-usage-stat--warn'"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
          <span class="text-muted">{{ item.hint }}</span>
        </div>
      </div>
    </NCard>

    <NCard class="mntools-panel profile-detail-card" title="网关信息">
      <dl class="profile-detail-grid profile-detail-grid--single">
        <div class="profile-detail-item">
          <dt>Platform API</dt>
          <dd><code class="code-inline">{{ apiBase }}</code></dd>
        </div>
        <div class="profile-detail-item">
          <dt>模型网关</dt>
          <dd>
            <NSpace align="center" :size="4">
              <code class="code-inline">{{ gatewayRoot || '—' }}</code>
              <NButton v-if="gatewayRoot" size="tiny" quaternary @click="copyGatewayUrl">
                <template #icon><Copy :size="12" /></template>
              </NButton>
            </NSpace>
          </dd>
        </div>
        <div class="profile-detail-item">
          <dt>对话端点</dt>
          <dd><code class="code-inline">{{ gatewayChatBase || '—' }}</code></dd>
        </div>
      </dl>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-service-status-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

@media (max-width: 1100px) {
  .model-service-status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
