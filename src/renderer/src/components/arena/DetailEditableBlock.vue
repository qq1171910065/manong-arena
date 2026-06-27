<script setup lang="ts">
defineProps<{
  title?: string
  hint?: string
}>()
</script>

<template>
  <section class="detail-section-block">
    <header v-if="title" class="detail-section-block__head">
      <h2>{{ title }}</h2>
      <p v-if="hint" class="detail-section-block__hint">{{ hint }}</p>
    </header>
    <slot />
  </section>
</template>

<style scoped>
.detail-section-block__head {
  margin-bottom: 12px;
}

.detail-section-block__head h2 {
  margin: 0;
  color: #17205a;
  font-size: 16px;
  font-weight: 650;
}

.detail-section-block__hint {
  margin: 4px 0 0;
  color: #7a85b0;
  font-size: 12px;
  line-height: 1.5;
}
</style>
