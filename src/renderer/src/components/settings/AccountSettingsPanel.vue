<script setup lang="ts">
import { computed } from 'vue'
import { ArrowRight, User } from 'lucide-vue-next'
import { navigate } from '../../router'
import { userInfoRef } from '@renderer/services/auth'
import PlatformSettingsPanel from './PlatformSettingsPanel.vue'
import { NButton, NCard, NSpace } from '../../ui'

const displayName = computed(
  () => userInfoRef.value?.name || userInfoRef.value?.username || '当前会话'
)
const email = computed(() => userInfoRef.value?.emailDisplay || '—')

function openProfile() {
  navigate('/profile')
}
</script>

<template>
  <NSpace vertical :size="16">
    <NCard class="mntools-panel" title="账户体系">
      <p class="text-muted" style="margin: 0 0 12px">
        极简模式下也可从此进入用户中心，管理 API Key、钱包与用量。
      </p>
      <div class="settings-account-summary">
        <span class="settings-account-avatar" aria-hidden="true">
          <User :size="18" />
        </span>
        <div class="settings-account-meta">
          <strong>{{ displayName }}</strong>
          <span class="text-muted">{{ email }}</span>
        </div>
        <NButton type="primary" @click="openProfile">
          打开用户中心
          <template #icon><ArrowRight :size="16" /></template>
        </NButton>
      </div>
    </NCard>

    <PlatformSettingsPanel />
  </NSpace>
</template>
