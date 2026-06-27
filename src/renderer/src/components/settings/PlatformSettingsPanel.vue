<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchPlatformPing, getDefaultApiBaseUrl } from '@renderer/services'
import { getApiBaseUrl, saveApiBaseUrlFromInput } from '@renderer/services/config'
import { NAlert, NButton, NCard, NInput, NSpace, useMessage } from '../../ui'

const message = useMessage()
const apiBaseInput = ref(getApiBaseUrl())
const defaultBase = getDefaultApiBaseUrl()
const pinging = ref(false)
const alertType = ref<'success' | 'error' | undefined>(undefined)
const alertText = ref('')
const phase = ref<'login' | 'main'>('main')

onMounted(async () => {
  phase.value = await window.api.getPhase()
})

const locked = computed(() => phase.value === 'main')
const displayUrl = computed(() => getApiBaseUrl() || defaultBase)

function save() {
  if (locked.value) return
  alertType.value = undefined
  const result = saveApiBaseUrlFromInput(apiBaseInput.value)
  if (!result.ok) {
    alertType.value = 'error'
    alertText.value = '请输入有效的 http(s) 地址'
    return
  }
  apiBaseInput.value = result.value
  alertType.value = 'success'
  alertText.value = result.value === defaultBase ? '已恢复默认地址' : '已保存，后续请求将使用该地址'
  message.success('平台地址已保存')
}

function reset() {
  if (locked.value) return
  apiBaseInput.value = ''
  save()
}

async function ping() {
  if (locked.value) return
  pinging.value = true
  alertType.value = undefined
  alertText.value = ''
  try {
    saveApiBaseUrlFromInput(apiBaseInput.value)
    const r = await fetchPlatformPing()
    if (r.ok) {
      alertType.value = 'success'
      alertText.value = '连接成功，检测到 WorkBuddy 平台服务'
      message.success('连接成功')
    } else {
      alertType.value = 'error'
      alertText.value = r.error
      message.error(r.error)
    }
  } finally {
    pinging.value = false
  }
}
</script>

<template>
  <NCard class="mntools-panel" title="平台 API 地址">
    <NAlert v-if="locked" type="info" :bordered="false" style="margin-bottom: 12px">
      平台地址仅在登录页配置。进入系统后不可修改，如需更换请退出登录后在登录窗口调整。
    </NAlert>
    <p v-else class="text-muted" style="margin-bottom: 12px">
      登录、用户中心、网关调用均通过此地址访问 WorkBuddy 平台服务。留空则使用环境默认：
      <code class="code-inline">{{ defaultBase }}</code>
    </p>
    <template v-if="locked">
      <p class="text-muted" style="margin-bottom: 8px">当前地址</p>
      <code class="code-block">{{ displayUrl }}</code>
    </template>
    <template v-else>
      <NInput v-model:value="apiBaseInput" type="text" :placeholder="defaultBase" />
      <NSpace style="margin-top: 12px">
        <NButton type="primary" @click="save">保存</NButton>
        <NButton @click="reset">恢复默认</NButton>
        <NButton :loading="pinging" @click="ping">测试连接</NButton>
      </NSpace>
      <NAlert
        v-if="alertText"
        :type="alertType === 'error' ? 'error' : 'success'"
        :bordered="false"
        style="margin-top: 12px"
      >
        {{ alertText }}
      </NAlert>
    </template>
  </NCard>
</template>
