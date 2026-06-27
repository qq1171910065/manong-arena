<script setup lang="ts">
defineProps<{
  toolsLabel?: string
}>()
</script>

<template>
  <div class="aa-detail-rail-actions">
    <div v-if="$slots.hero" class="aa-detail-rail-actions__hero">
      <slot name="hero" />
    </div>
    <div v-if="$slots.main" class="aa-detail-rail-actions__main">
      <slot name="main" />
    </div>
    <div v-if="$slots.row" class="aa-detail-rail-actions__row">
      <slot name="row" />
    </div>
    <div v-if="$slots.tools" class="aa-detail-rail-actions__tools">
      <span v-if="toolsLabel" class="aa-detail-rail-actions__label">{{ toolsLabel }}</span>
      <div class="aa-detail-rail-actions__tools-grid">
        <slot name="tools" />
      </div>
    </div>
    <div v-if="$slots.danger" class="aa-detail-rail-actions__danger">
      <slot name="danger" />
    </div>
  </div>
</template>
