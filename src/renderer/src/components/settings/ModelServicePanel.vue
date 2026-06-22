<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { Activity, Bot, Copy, RefreshCw, Zap } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import {
  ensureGatewayKey,
  fetchPlatformPing,
  gatewayChatStream,
  getApiBaseUrl,
  getGatewayBaseUrl,
  getGatewayRootUrl,
  getStoredGatewayKey,
  invalidateGatewayModelCache,
  listGatewayModels,
  resolveGatewayEndpoints,
  testGatewayConnectivity,
  testGatewayModel,
  type GatewayConnectivityReport,
  type GatewayEndpointConfig,
  type GatewayModelInfo,
  type ModelTestResult,
} from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NFormItem,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from '../../ui'

const message = useMessage()

const loading = ref(false)
const modelsLoading = ref(false)
const platformOk = ref<boolean | null>(null)
const platformError = ref('')
const gatewayConfig = ref<GatewayEndpointConfig | null>(null)
const models = ref<GatewayModelInfo[]>([])
const modelFilter = ref('')
const testReport = ref<GatewayConnectivityReport | null>(null)
const rowTests = ref<Record<string, ModelTestResult>>({})
const testingModel = ref('')
const batchTesting = ref(false)

const chatModel = ref<string | null>(null)
const chatPrompt = ref('用一句话介绍 Agent Arena。')
const chatOutput = ref('')
const chatLoading = ref(false)
let chatCancel: (() => void) | null = null

const apiBase = computed(() => getApiBaseUrl())
const gatewayRoot = computed(() => gatewayConfig.value?.baseUrl || getGatewayRootUrl())
const gatewayChatBase = computed(() => gatewayConfig.value?.chatBaseUrl || getGatewayBaseUrl())
const hasKey = computed(() => Boolean(getStoredGatewayKey()))

const filteredModels = computed(() => {
  const q = modelFilter.value.trim().toLowerCase()
  if (!q) return models.value
  return models.value.filter((m) => {
    const hay = `${m.id} ${m.tags.join(' ')} ${m.endpointTypes.join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
})

const chatModelOptions = computed(() =>
  models.value.map((m) => ({ label: m.id, value: m.id }))
)

const statusCards = computed(() => [
  {
    id: 'platform',
    label: '平台连接',
    value: platformOk.value === null ? '检测中' : platformOk.value ? '正常' : '异常',
    hint: platformOk.value ? apiBase.value : platformError.value || '请检查平台服务',
    ok: platformOk.value === true,
  },
  {
    id: 'gateway',
    label: '模型网关',
    value: gatewayRoot.value ? '已配置' : '未配置',
    hint: gatewayRoot.value || '等待 Platform 返回网关地址',
    ok: Boolean(gatewayRoot.value),
  },
  {
    id: 'key',
    label: '本机 Key',
    value: hasKey.value ? '已保存' : '未保存',
    hint: hasKey.value ? '可调用模型' : '登录后自动创建或手动创建',
    ok: hasKey.value,
  },
  {
    id: 'models',
    label: '可用模型',
    value: String(models.value.length),
    hint: models.value.length ? '来自 Gateway pricing' : '刷新以加载',
    ok: models.value.length > 0,
  },
])

const columns: DataTableColumns<GatewayModelInfo & { test?: ModelTestResult }> = [
  { title: '模型 ID', key: 'id', ellipsis: { tooltip: true } },
  {
    title: '标签',
    key: 'tags',
    render: (row) =>
      row.tags.length
        ? h(
            NSpace,
            { size: 4 },
            () => row.tags.slice(0, 3).map((tag) => h(NTag, { size: 'small', bordered: false }, () => tag))
          )
        : '—',
  },
  {
    title: '端点',
    key: 'endpointTypes',
    render: (row) => (row.endpointTypes.length ? row.endpointTypes.join(', ') : '—'),
  },
  {
    title: '连通性',
    key: 'test',
    width: 120,
    render: (row) => {
      const result = rowTests.value[row.id]
      if (testingModel.value === row.id) return h(NSpin, { size: 'small' })
      if (!result) return '—'
      return h(
        NTag,
        { type: result.ok ? 'success' : 'error', size: 'small', bordered: false },
        () => (result.ok ? `${result.latencyMs}ms` : '失败')
      )
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NButton,
        {
          size: 'small',
          quaternary: true,
          loading: testingModel.value === row.id,
          onClick: () => void runSingleTest(row.id),
        },
        () => '测试'
      ),
  },
]

async function checkPlatform() {
  platformOk.value = null
  platformError.value = ''
  const r = await fetchPlatformPing()
  platformOk.value = r.ok
  if (!r.ok) platformError.value = r.error
}

async function loadGatewayConfig(force = false) {
  try {
    gatewayConfig.value = await resolveGatewayEndpoints(force)
  } catch (e) {
    gatewayConfig.value = null
    throw e
  }
}

async function loadModels(force = false) {
  modelsLoading.value = true
  try {
    if (force) invalidateGatewayModelCache()
    await loadGatewayConfig(force)
    models.value = await listGatewayModels(force)
    if (!chatModel.value && models.value.length) {
      chatModel.value = models.value[0]?.id || null
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '加载模型失败')
  } finally {
    modelsLoading.value = false
  }
}

async function refreshAll() {
  loading.value = true
  try {
    await checkPlatform()
    await loadModels(true)
    message.success('已刷新模型列表')
  } finally {
    loading.value = false
  }
}

async function runBatchTest() {
  batchTesting.value = true
  testReport.value = null
  rowTests.value = {}
  try {
    await ensureGatewayKey()
    const report = await testGatewayConnectivity(undefined, 3)
    testReport.value = report
    for (const result of report.results) {
      rowTests.value[result.model] = result
    }
    if (report.ok) {
      message.success(`连通性测试通过 ${report.successCount}/${report.testedCount}`)
    } else {
      message.warning(report.message || '连通性测试未通过')
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '测试失败')
  } finally {
    batchTesting.value = false
  }
}

async function runSingleTest(modelId: string) {
  testingModel.value = modelId
  try {
    await ensureGatewayKey()
    const result = await testGatewayModel(modelId)
    rowTests.value = { ...rowTests.value, [modelId]: result }
    if (result.ok) message.success(`${modelId} 可用 (${result.latencyMs}ms)`)
    else message.error(result.message || `${modelId} 不可用`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '测试失败')
  } finally {
    testingModel.value = ''
  }
}

async function copyGatewayUrl() {
  const url = gatewayRoot.value
  if (!url) return
  await navigator.clipboard.writeText(url)
  message.success('已复制模型网关地址')
}

async function sendChat() {
  if (!chatModel.value || chatLoading.value) return
  chatLoading.value = true
  chatOutput.value = ''
  chatCancel?.()
  try {
    await ensureGatewayKey()
    chatCancel = await gatewayChatStream(
      chatModel.value,
      [{ role: 'user', content: chatPrompt.value }],
      {
        onChunk: (t) => {
          chatOutput.value += t
        },
        onEnd: () => {
          chatLoading.value = false
        },
        onError: (err) => {
          message.error(err)
          chatLoading.value = false
        },
      }
    )
  } catch (e) {
    message.error(e instanceof Error ? e.message : '发送失败')
    chatLoading.value = false
  }
}

function stopChat() {
  chatCancel?.()
  chatCancel = null
  chatLoading.value = false
}

onMounted(async () => {
  loading.value = true
  try {
    await checkPlatform()
    await loadModels()
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <ProfileSectionLayout>
    <template #header>
      <div class="profile-section__head">
        <div>
          <h3 class="profile-section__title">模型服务调试</h3>
          <p class="profile-section__desc">
            浏览 Platform 配置的 New API 模型网关，测试连通性与流式对话。模型列表来自网关
            <code class="code-inline">/api/pricing</code>，对话走
            <code class="code-inline">/v1/chat/completions</code>，鉴权使用本机 sk- Key。
          </p>
        </div>
        <NSpace>
          <NButton quaternary :loading="loading" @click="refreshAll">
            <template #icon><RefreshCw :size="14" /></template>
            刷新
          </NButton>
          <NButton type="primary" :loading="batchTesting" @click="runBatchTest">
            <template #icon><Activity :size="14" /></template>
            批量连通性测试
          </NButton>
        </NSpace>
      </div>
    </template>

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

    <NAlert v-if="testReport" :type="testReport.ok ? 'success' : 'warning'" :bordered="false">
      测试 {{ testReport.testedCount }} 个模型，成功 {{ testReport.successCount }} 个 · 共
      {{ testReport.modelCount }} 个可用模型
      <span v-if="testReport.message"> · {{ testReport.message }}</span>
    </NAlert>

    <NCard class="mntools-panel profile-detail-card" title="网关信息">
      <dl class="profile-detail-grid profile-detail-grid--single">
        <div class="profile-detail-item">
          <dt>Platform API</dt>
          <dd><code class="code-inline">{{ apiBase }}</code></dd>
        </div>
        <div class="profile-detail-item">
          <dt>模型网关</dt>
          <dd>
            <code class="code-inline">{{ gatewayRoot || '—' }}</code>
            <NButton v-if="gatewayRoot" size="tiny" quaternary @click="copyGatewayUrl">
              <template #icon><Copy :size="12" /></template>
            </NButton>
          </dd>
        </div>
        <div class="profile-detail-item">
          <dt>对话端点</dt>
          <dd><code class="code-inline">{{ gatewayChatBase || '—' }}</code></dd>
        </div>
      </dl>
    </NCard>

    <NCard class="mntools-panel profile-table-card" title="可用模型">
      <template #header-extra>
        <NInput v-model:value="modelFilter" placeholder="搜索模型…" clearable style="width: 220px" />
      </template>
      <NDataTable
        :columns="columns"
        :data="filteredModels"
        :loading="modelsLoading"
        :bordered="false"
        size="small"
        :max-height="360"
        :pagination="{ pageSize: 12 }"
      />
    </NCard>

    <NCard class="mntools-panel" title="流式对话测试">
      <template #header-extra>
        <Bot :size="16" class="text-muted" />
      </template>
      <NFormItem label="模型">
        <NSelect
          v-model:value="chatModel"
          :options="chatModelOptions"
          :loading="modelsLoading"
          filterable
          placeholder="选择模型"
        />
      </NFormItem>
      <NFormItem label="提示词">
        <textarea v-model="chatPrompt" class="field field-textarea" rows="3" :disabled="chatLoading" />
      </NFormItem>
      <NSpace>
        <NButton type="primary" :loading="chatLoading" :disabled="!chatModel" @click="sendChat">
          <template #icon><Zap :size="14" /></template>
          发送
        </NButton>
        <NButton :disabled="!chatLoading" @click="stopChat">停止</NButton>
      </NSpace>
      <pre class="code-block model-service-chat-output">{{ chatOutput || (chatLoading ? '（生成中…）' : '（等待输出）') }}</pre>
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.model-service-status-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.model-service-chat-output {
  margin-top: 12px;
  min-height: 120px;
  max-height: 240px;
  overflow: auto;
}

@media (max-width: 1100px) {
  .model-service-status-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
