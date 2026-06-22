<script setup lang="ts">
defineProps<{
  placeholder?: string
}>()

const model = defineModel<string>('keyword', { default: '' })
</script>

<template>
  <div class="app-filter-bar">
    <div class="app-filter-bar__search">
      <slot name="prefix" />
      <input
        v-model="model"
        type="search"
        class="field app-filter-bar__input"
        :placeholder="placeholder ?? '搜索…'"
        autocomplete="off"
      />
    </div>
    <div v-if="$slots.filters" class="app-filter-bar__filters">
      <slot name="filters" />
    </div>
    <div v-if="$slots.actions" class="app-filter-bar__actions">
      <slot name="actions" />
    </div>
  </div>
</template>
