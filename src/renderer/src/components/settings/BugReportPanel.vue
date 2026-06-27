<script setup lang="ts">
import { computed, ref } from 'vue'
import { MessageSquare } from 'lucide-vue-next'
import type { PortalTicketRecord } from '@renderer/services'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import {
  NButton,
  NForm,
  NFormItem,
  NInput,
  NModal,
  NSelect,
  NSpace,
  NTag,
} from '../../ui'

const props = defineProps<{
  tickets: PortalTicketRecord[]
  loading?: boolean
  onSubmit: (payload: {
    title: string
    content: string
    priority: 'low' | 'normal' | 'high'
  }) => Promise<void>
}>()

const ticketModalOpen = ref(false)
const ticketTitle = ref('')
const ticketContent = ref('')
const ticketPriority = ref<'low' | 'normal' | 'high'>('normal')
const ticketSubmitting = ref(false)
const page = ref(1)
const pageSize = ref(10)

const ticketPriorityOptions = [
  { label: '低', value: 'low' },
  { label: '普通', value: 'normal' },
  { label: '高', value: 'high' },
]

const sortedTickets = computed(() =>
  [...props.tickets].sort((a, b) => {
    const ta = a.createTime ? new Date(a.createTime).getTime() : 0
    const tb = b.createTime ? new Date(b.createTime).getTime() : 0
    return tb - ta
  })
)

const paginatedTickets = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return sortedTickets.value.slice(start, start + pageSize.value)
})

function formatShortTime(raw: string) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return raw
  return d.toLocaleString()
}

function ticketStatusLabel(status?: string) {
  switch (status) {
    case 'open':
      return '待处理'
    case 'processing':
      return '处理中'
    case 'resolved':
      return '已解决'
    case 'closed':
      return '已关闭'
    default:
      return status || '已提交'
  }
}

function openTicketModal() {
  ticketTitle.value = ''
  ticketContent.value = ''
  ticketPriority.value = 'normal'
  ticketModalOpen.value = true
}

async function submitTicket() {
  const title = ticketTitle.value.trim()
  const content = ticketContent.value.trim()
  if (!title || !content) return
  ticketSubmitting.value = true
  try {
    await props.onSubmit({ title, content, priority: ticketPriority.value })
    ticketModalOpen.value = false
  } catch {
    // 错误由父组件提示
  } finally {
    ticketSubmitting.value = false
  }
}

function onPageChange(next: number) {
  page.value = next
}

function onPageSizeChange(next: number) {
  pageSize.value = next
  page.value = 1
}
</script>

<template>
  <ProfileSectionLayout title="报 Bug" desc="记录可复现问题、异常状态或体验瑕疵，保留完整历史。">
    <template #actions>
      <NButton type="primary" size="small" @click="openTicketModal">填写反馈</NButton>
    </template>

    <section class="portal-plain-block profile-list-region">
      <h4 class="portal-plain-block__title">反馈历史</h4>

      <ul v-if="paginatedTickets.length" class="profile-record-list">
        <li v-for="item in paginatedTickets" :key="item.id" class="profile-record-item">
          <div class="profile-record-item__main">
            <strong>{{ item.title }}</strong>
            <p v-if="item.content">{{ item.content }}</p>
          </div>
          <div class="profile-record-item__meta">
            <NTag size="small" :bordered="false">{{ ticketStatusLabel(item.status) }}</NTag>
            <NTag v-if="item.priority" size="small" :bordered="false">{{ item.priority }}</NTag>
            <span v-if="item.createTime">{{ formatShortTime(item.createTime) }}</span>
          </div>
        </li>
      </ul>
      <div v-else class="profile-empty profile-empty--compact">
        <MessageSquare :size="24" />
        <p>暂无反馈记录</p>
        <span>提交问题后将在此展示完整历史</span>
      </div>

      <div v-if="sortedTickets.length > pageSize" class="bug-report-pagination">
        <NButton size="small" :disabled="page <= 1" @click="onPageChange(page - 1)">上一页</NButton>
        <span class="text-muted">{{ page }} / {{ Math.ceil(sortedTickets.length / pageSize) }}</span>
        <NButton
          size="small"
          :disabled="page >= Math.ceil(sortedTickets.length / pageSize)"
          @click="onPageChange(page + 1)"
        >
          下一页
        </NButton>
        <NSelect
          :value="pageSize"
          :options="[
            { label: '10 条/页', value: 10 },
            { label: '20 条/页', value: 20 },
            { label: '50 条/页', value: 50 },
          ]"
          size="small"
          style="width: 110px"
          @update:value="onPageSizeChange"
        />
      </div>
    </section>

    <NModal
      v-model:show="ticketModalOpen"
      preset="card"
      title="提交反馈"
      style="max-width: 520px"
      :mask-closable="!ticketSubmitting"
    >
      <NForm label-placement="top">
        <NFormItem label="标题">
          <NInput v-model:value="ticketTitle" maxlength="120" placeholder="简要描述问题" />
        </NFormItem>
        <NFormItem label="优先级">
          <NSelect v-model:value="ticketPriority" :options="ticketPriorityOptions" />
        </NFormItem>
        <NFormItem label="详细说明">
          <NInput
            v-model:value="ticketContent"
            type="textarea"
            :rows="5"
            maxlength="2000"
            placeholder="请描述复现步骤、期望结果、实际表现或模型调用相关问题"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton :disabled="ticketSubmitting" @click="ticketModalOpen = false">取消</NButton>
          <NButton
            type="primary"
            :loading="ticketSubmitting"
            :disabled="!ticketTitle.trim() || !ticketContent.trim()"
            @click="submitTicket"
          >
            提交
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </ProfileSectionLayout>
</template>

<style scoped>
.bug-report-pagination {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
}
</style>
