<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { gatewayChatStream, listGatewayModelIds } from '@renderer/services'
import { NButton, NCard, NEmpty, NFormItem, NSelect, NSpace, useMessage } from '../../ui'

defineProps<{ embedded?: boolean }>()

const message = useMessage()
const models = ref<string[]>([])
const model = ref<string | null>(null)
const prompt = ref('用一句话介绍 Electron 桌面工具脚手架。')
const output = ref('')
const loading = ref(false)
const modelsLoading = ref(true)
const modelsError = ref('')
let cancel: (() => void) | null = null

const modelOptions = computed(() => models.value.map((m) => ({ label: m, value: m })))
const canSend = computed(
  () => !loading.value && !modelsLoading.value && !!model.value && prompt.value.trim().length > 0
)

onMounted(async () => {
  modelsLoading.value = true
  modelsError.value = ''
  try {
    models.value = await listGatewayModelIds()
    model.value = models.value[0] || null
    if (models.value.length === 0) {
      modelsError.value = '暂无可用模型，请检查平台连接或 Gateway 配置'
    }
  } catch (e) {
    modelsError.value = e instanceof Error ? e.message : '加载模型失败'
    message.error(modelsError.value)
  } finally {
    modelsLoading.value = false
  }
})

async function send() {
  if (!model.value) return
  loading.value = true
  output.value = ''
  cancel?.()
  cancel = await gatewayChatStream(
    model.value,
    [{ role: 'user', content: prompt.value }],
    {
      onChunk: (t) => {
        output.value += t
      },
      onEnd: () => {
        loading.value = false
      },
      onError: (err) => {
        message.error(err)
        loading.value = false
      },
    }
  )
}

function stop() {
  cancel?.()
  cancel = null
  loading.value = false
}

function onPromptKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && canSend.value) {
    e.preventDefault()
    void send()
  }
}
</script>

<template>
  <div :class="[embedded ? 'demo-embedded' : 'page']">
    <div v-if="!embedded" class="page-head"><h1>流式对话示例</h1></div>
    <NEmpty
      v-if="modelsError && !modelsLoading"
      :description="modelsError"
      style="margin-bottom: 16px"
    />

    <NCard v-else class="mntools-panel" style="margin-bottom: 16px">
      <NFormItem label="模型">
        <NSelect
          v-model:value="model"
          :options="modelOptions"
          :loading="modelsLoading"
          placeholder="选择模型"
        />
      </NFormItem>
      <NFormItem label="提示词">
        <textarea
          v-model="prompt"
          class="field field-textarea"
          rows="3"
          :disabled="loading || modelsLoading"
          @keydown="onPromptKeydown"
        />
        <p class="text-muted" style="margin: 6px 0 0; font-size: var(--text-xs)">Ctrl+Enter 发送</p>
      </NFormItem>
      <NSpace>
        <NButton type="primary" :loading="loading" :disabled="!canSend" @click="send">发送</NButton>
        <NButton :disabled="!loading" @click="stop">停止</NButton>
      </NSpace>
    </NCard>
    <NCard class="mntools-panel" title="输出">
      <pre
        class="code-block"
        :class="{ 'is-empty': !output, 'is-streaming': loading }"
      >{{ output || (loading ? '（生成中…）' : '（等待输出）') }}</pre>
    </NCard>
  </div>
</template>
