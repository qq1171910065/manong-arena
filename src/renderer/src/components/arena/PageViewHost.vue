<script setup lang="ts">
import { computed } from 'vue'
import ArenaPageSkeleton from './ArenaPageSkeleton.vue'
import { resolveRouteSkeleton } from './skeleton-variants'
import type { Component } from 'vue'

const props = defineProps<{
  pageComponent: Component | null
  pageError: string | null
  pageLoading: boolean
  pageKey: string
}>()

const emit = defineEmits<{ retry: [] }>()

const skeletonVariant = computed(() => resolveRouteSkeleton(props.pageKey))

const skeletonToolbar = computed(
  () => skeletonVariant.value === 'grid-cards' || skeletonVariant.value === 'list-rows'
)

const skeletonToolbarAction = computed(() => props.pageKey.split('?')[0] === '/characters')
</script>

<template>
  <div class="page-view-host">
    <Transition name="page-route">
      <div
        v-if="pageLoading || !pageComponent"
        key="loading"
        class="page-view-host__panel page-view-host__skeleton"
        role="status"
        aria-live="polite"
        aria-label="加载页面"
      >
        <ArenaPageSkeleton
          :variant="skeletonVariant"
          label="加载页面"
          :toolbar="skeletonToolbar"
          :toolbar-action="skeletonToolbarAction"
        />
      </div>
      <div v-else-if="pageError" key="error" class="page app-empty-state page-view-host__panel">
        <strong class="app-empty-state__title">页面加载失败</strong>
        <p class="app-empty-state__desc">{{ pageError || '当前页面暂时无法打开，请重试。' }}</p>
        <div class="app-empty-state__actions">
          <button type="button" class="btn primary" @click="emit('retry')">重试</button>
        </div>
      </div>
      <component :is="pageComponent" v-else :key="pageKey" class="page-view-host__page" />
    </Transition>
  </div>
</template>
