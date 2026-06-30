<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Loader2 } from 'lucide-vue-next'
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import { characterChatService, characterGrowthService, formatUserMessage, postGameReviewService } from '@renderer/services/arena'
import { buildCharacterGrowthLogItems, type CharacterGrowthLogItem } from '@shared/arena/growth-display'
import type { Character } from '@shared/arena/types'

const PAGE_SIZE = 16

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
}>()

const loading = ref(false)
const loadingMore = ref(false)
const error = ref('')
const allItems = ref<CharacterGrowthLogItem[]>([])
const visibleCount = ref(PAGE_SIZE)
const scrollRef = ref<HTMLElement | null>(null)
const sentinelRef = ref<HTMLElement | null>(null)

let observer: IntersectionObserver | null = null

const visibleItems = computed(() => allItems.value.slice(0, visibleCount.value))
const hasMore = computed(() => visibleCount.value < allItems.value.length)
const totalLabel = computed(() => (allItems.value.length ? `${allItems.value.length} 条记录` : '暂无记录'))

function formatTimelineDate(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function loadItems() {
  loading.value = true
  error.value = ''
  try {
    const [snapshots, records, behaviorChanges] = await Promise.all([
      characterGrowthService.listSnapshots(props.character.id),
      characterChatService.listGrowth(props.character.id),
      postGameReviewService.listBehaviorChanges(props.character.id),
    ])
    allItems.value = buildCharacterGrowthLogItems(snapshots, records, behaviorChanges)
    visibleCount.value = PAGE_SIZE
  } catch (err) {
    error.value = formatUserMessage(err)
    allItems.value = []
  } finally {
    loading.value = false
    await nextTick(setupObserver)
  }
}

function loadMore() {
  if (!hasMore.value || loadingMore.value || loading.value) return
  loadingMore.value = true
  visibleCount.value = Math.min(visibleCount.value + PAGE_SIZE, allItems.value.length)
  loadingMore.value = false
}

function teardownObserver() {
  observer?.disconnect()
  observer = null
}

function setupObserver() {
  teardownObserver()
  const root = scrollRef.value
  const target = sentinelRef.value
  if (!show.value || !root || !target || !hasMore.value) return

  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore()
    },
    { root, rootMargin: '80px', threshold: 0 },
  )
  observer.observe(target)
}

watch(hasMore, () => {
  void nextTick(setupObserver)
})

watch(show, (open) => {
  if (open) void loadItems()
  else teardownObserver()
})

onMounted(() => {
  if (show.value) void loadItems()
})

onBeforeUnmount(() => {
  teardownObserver()
})
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    title="成长记录"
    :subtitle="`${character.name} · ${totalLabel} · 全部交互`"
    variant="preview"
    size="lg"
    height="min(76vh, 720px)"
    show-header-close
  >
    <div ref="scrollRef" class="growth-log-dialog__body">
      <div v-if="loading" class="growth-log-dialog__loading">
        <Loader2 :size="20" class="spin" />
        加载成长记录…
      </div>

      <p v-else-if="error" class="growth-log-dialog__error">{{ error }}</p>

      <p v-else-if="!allItems.length" class="growth-log-dialog__empty">
        参与对局、私聊、复盘或场景学习后，成长轨迹会记录在这里。
      </p>

      <ol v-else class="growth-log-timeline">
        <li v-for="item in visibleItems" :key="item.id" class="growth-log-timeline__item">
          <div class="growth-log-timeline__rail" aria-hidden="true">
            <span class="growth-log-timeline__dot" />
          </div>
          <article class="growth-log-timeline__body">
            <div class="growth-log-timeline__meta">
              <span class="growth-log-timeline__source">{{ item.source }}</span>
              <time :datetime="item.createdAt">{{ formatTimelineDate(item.createdAt) }}</time>
            </div>
            <p>{{ item.summary }}</p>
          </article>
        </li>
      </ol>

      <div v-if="!loading && allItems.length" ref="sentinelRef" class="growth-log-dialog__sentinel">
        <span v-if="loadingMore || hasMore" class="growth-log-dialog__more">
          <Loader2 v-if="loadingMore" :size="16" class="spin" />
          {{ loadingMore ? '加载更多…' : '继续下滑加载更多' }}
        </span>
        <span v-else class="growth-log-dialog__end">已显示全部记录</span>
      </div>
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.growth-log-dialog__body {
  height: 100%;
  overflow: auto;
  scrollbar-width: thin;
}

.growth-log-dialog__loading,
.growth-log-dialog__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #7a85b0;
  font-size: 13px;
}

.growth-log-dialog__error {
  margin: 0;
  color: #c2410c;
  font-size: 13px;
  line-height: 1.6;
}

.growth-log-dialog__empty {
  margin: 0;
  padding: 24px 8px;
  color: #7a85b0;
  font-size: 13px;
  line-height: 1.65;
  text-align: center;
}

.growth-log-timeline {
  margin: 0;
  padding: 0;
  list-style: none;
}

.growth-log-timeline__item {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  gap: 12px;
}

.growth-log-timeline__rail {
  position: relative;
  display: flex;
  justify-content: center;
}

.growth-log-timeline__rail::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(130, 142, 207, 0.16);
}

.growth-log-timeline__item:first-child .growth-log-timeline__rail::before {
  top: 14px;
}

.growth-log-timeline__item:last-child .growth-log-timeline__rail::before {
  bottom: auto;
  height: 14px;
}

.growth-log-timeline__dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  margin-top: 14px;
  border-radius: 50%;
  background: #7b61ff;
  box-shadow: 0 0 0 4px rgba(123, 97, 255, 0.14);
}

.growth-log-timeline__body {
  padding: 6px 0 20px;
  min-width: 0;
}

.growth-log-timeline__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.growth-log-timeline__source {
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  font-size: 11px;
  font-weight: 650;
}

.growth-log-timeline__meta time {
  color: #9aa3c7;
  font-size: 11px;
}

.growth-log-timeline__body p {
  margin: 0;
  color: #17205a;
  font-size: 14px;
  line-height: 1.6;
}

.growth-log-dialog__sentinel {
  min-height: 40px;
  display: grid;
  place-items: center;
  padding: 8px 0 4px;
}

.growth-log-dialog__end {
  color: #b0b8d4;
  font-size: 12px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
