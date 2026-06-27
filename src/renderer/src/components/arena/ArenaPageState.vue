<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import ArenaPageSkeleton from './ArenaPageSkeleton.vue'
import type { ArenaSkeletonVariant } from './skeleton-variants'

const props = withDefaults(
  defineProps<{
    loading?: boolean
    error?: string
    empty?: boolean
    loadingLabel?: string
    minRevealMs?: number
    stagger?: boolean
    skeleton?: ArenaSkeletonVariant
  }>(),
  {
    loading: false,
    error: '',
    empty: false,
    loadingLabel: '加载中...',
    minRevealMs: 360,
    stagger: true,
    skeleton: 'generic',
  }
)

const emit = defineEmits<{ retry: [] }>()

const holdLoading = ref(props.loading)
let loadingStartedAt = 0
let revealTimer: number | undefined

watch(
  () => props.loading,
  (next) => {
    window.clearTimeout(revealTimer)
    if (next) {
      loadingStartedAt = Date.now()
      holdLoading.value = true
      return
    }
    const delay = Math.max(0, props.minRevealMs - (Date.now() - loadingStartedAt))
    revealTimer = window.setTimeout(() => {
      holdLoading.value = false
    }, delay)
  },
  { immediate: true }
)

onUnmounted(() => window.clearTimeout(revealTimer))
</script>

<template>
  <div class="arena-page-state">
    <div class="arena-page-state__frame">
      <div v-show="holdLoading" class="arena-page-state__skeleton">
        <slot name="skeleton">
          <ArenaPageSkeleton :variant="skeleton" :label="loadingLabel" />
        </slot>
      </div>
      <div v-show="!holdLoading" class="arena-page-state__revealed">
        <Transition name="arena-state">
          <div v-if="error" key="error" class="arena-page-state__panel arena-page-state__error">
            <p>{{ error }}</p>
            <button type="button" class="arena-page-state__retry" @click="emit('retry')">重试</button>
          </div>
          <div v-else-if="empty" key="empty" class="arena-page-state__panel arena-page-state__empty">
            <slot name="empty" />
          </div>
          <div v-else key="content" class="arena-page-state__content" :class="{ 'arena-stagger': stagger }">
            <slot />
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<style scoped>
.arena-page-state {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.arena-page-state__frame,
.arena-page-state__skeleton,
.arena-page-state__revealed {
  display: flex;
  flex-direction: column;
}

.arena-page-state__revealed {
  position: relative;
}
</style>
