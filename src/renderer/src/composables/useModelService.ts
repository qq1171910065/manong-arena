import { computed, inject, onMounted, provide, ref, type InjectionKey } from 'vue'
import {
  ensureGatewayKey,
  fetchPlatformPing,
  getApiBaseUrl,
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

export type ModelServiceContext = ReturnType<typeof createModelService>

const MODEL_SERVICE_KEY: InjectionKey<ModelServiceContext> = Symbol('modelService')

export function provideModelService(ctx: ModelServiceContext) {
  provide(MODEL_SERVICE_KEY, ctx)
}

export function useModelService(): ModelServiceContext {
  const injected = inject(MODEL_SERVICE_KEY)
  if (injected) return injected
  return createModelService()
}

export function createModelService() {
  const loading = ref(false)
  const modelsLoading = ref(false)
  const platformOk = ref<boolean | null>(null)
  const platformError = ref('')
  const gatewayConfig = ref<GatewayEndpointConfig | null>(null)
  const models = ref<GatewayModelInfo[]>([])
  const testReport = ref<GatewayConnectivityReport | null>(null)
  const rowTests = ref<Record<string, ModelTestResult>>({})
  const testingModel = ref('')
  const batchTesting = ref(false)

  const apiBase = computed(() => getApiBaseUrl())
  const gatewayRoot = computed(() => gatewayConfig.value?.baseUrl || getGatewayRootUrl())
  const gatewayChatBase = computed(() => gatewayConfig.value?.chatBaseUrl || '')
  const hasKey = computed(() => Boolean(getStoredGatewayKey()))

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

  async function checkPlatform() {
    platformOk.value = null
    platformError.value = ''
    const r = await fetchPlatformPing()
    platformOk.value = r.ok
    if (!r.ok) platformError.value = r.error
  }

  async function loadGatewayConfig(force = false) {
    gatewayConfig.value = await resolveGatewayEndpoints(force)
  }

  async function loadModels(force = false) {
    modelsLoading.value = true
    try {
      if (force) invalidateGatewayModelCache()
      await loadGatewayConfig(force)
      models.value = await listGatewayModels(force)
    } finally {
      modelsLoading.value = false
    }
  }

  async function refreshAll() {
    loading.value = true
    try {
      await checkPlatform()
      await loadModels(true)
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
      return report
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
      return result
    } finally {
      testingModel.value = ''
    }
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

  return {
    loading,
    modelsLoading,
    platformOk,
    platformError,
    gatewayConfig,
    models,
    testReport,
    rowTests,
    testingModel,
    batchTesting,
    apiBase,
    gatewayRoot,
    gatewayChatBase,
    hasKey,
    statusCards,
    refreshAll,
    loadModels,
    runBatchTest,
    runSingleTest,
  }
}
