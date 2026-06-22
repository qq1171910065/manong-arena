<script setup lang="ts">
import { computed, h, ref } from 'vue'
import { Activity } from 'lucide-vue-next'
import type { DataTableColumns } from '../../ui'
import { useModelService } from '@renderer/composables/useModelService'
import type { GatewayModelInfo } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NInput,
  NSpace,
  NSpin,
  NTag,
  useMessage,
} from '../../ui'

const message = useMessage()
const {
  models,
  modelsLoading,
  testReport,
  rowTests,
  testingModel,
  batchTesting,
  runBatchTest,
  runSingleTest,
} = useModelService()
const modelFilter = ref('')

const filteredModels = computed(() => {
  const q = modelFilter.value.trim().toLowerCase()
  if (!q) return models.value
  return models.value.filter((m) => {
    const hay = `${m.id} ${m.tags.join(' ')} ${m.endpointTypes.join(' ')}`.toLowerCase()
    return hay.includes(q)
  })
})

const columns: DataTableColumns<GatewayModelInfo> = [
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
          onClick: () => void runSingle(row.id),
        },
        () => '测试'
      ),
  },
]

async function runSingle(modelId: string) {
  try {
    const result = await runSingleTest(modelId)
    if (result?.ok) message.success(`${modelId} 可用 (${result.latencyMs}ms)`)
    else message.error(result?.message || `${modelId} 不可用`)
  } catch (e) {
    message.error(e instanceof Error ? e.message : '测试失败')
  }
}

async function runBatch() {
  try {
    const report = await runBatchTest()
    if (report?.ok) {
      message.success(`连通性测试通过 ${report.successCount}/${report.testedCount}`)
    } else {
      message.warning(report?.message || '连通性测试未通过')
    }
  } catch (e) {
    message.error(e instanceof Error ? e.message : '测试失败')
  }
}

</script>

<template>
  <ProfileSectionLayout
    title="连通性调试"
    desc="浏览可用模型并执行 ping 测试，验证网关鉴权与模型可达性。"
  >
    <template #actions>
      <NButton type="primary" :loading="batchTesting" @click="runBatch">
        <template #icon><Activity :size="14" /></template>
        批量连通性测试
      </NButton>
    </template>

    <NAlert
      v-if="testReport"
      :type="testReport.ok ? 'success' : 'warning'"
      :bordered="false"
    >
      测试 {{ testReport.testedCount }} 个模型，成功 {{ testReport.successCount }} 个 · 共
      {{ testReport.modelCount }} 个可用模型
      <span v-if="testReport.message"> · {{ testReport.message }}</span>
    </NAlert>

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
        :max-height="420"
        :pagination="{ pageSize: 12 }"
      />
    </NCard>
  </ProfileSectionLayout>
</template>
