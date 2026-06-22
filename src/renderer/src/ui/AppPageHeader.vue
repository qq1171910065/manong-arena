<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="app-page-header">
    <div class="app-page-header__main">
      <slot name="breadcrumb" />
      <h1 class="app-page-header__title">{{ title }}</h1>
      <p v-if="description || $slots.description" class="app-page-header__desc text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="app-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>
