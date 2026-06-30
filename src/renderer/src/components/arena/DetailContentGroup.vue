<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  description?: string
  icon?: Component
}>()
</script>

<template>
  <section class="detail-content-group">
    <header class="detail-content-group__head">
      <div v-if="icon" class="detail-content-group__icon" aria-hidden="true">
        <component :is="icon" :size="18" />
      </div>
      <div class="detail-content-group__copy">
        <h2>{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
      </div>
    </header>
    <div class="detail-content-group__body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.detail-content-group {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.52);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9), 0 12px 32px rgba(91, 101, 174, 0.07);
  backdrop-filter: blur(18px);
}

.detail-content-group__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 4px 2px 0;
}

.detail-content-group__icon {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: rgba(112, 105, 255, 0.1);
  color: #5b57f3;
  flex: none;
}

.detail-content-group__copy h2 {
  margin: 0;
  color: #17205a;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.25;
}

.detail-content-group__copy p {
  margin: 4px 0 0;
  color: #7a85b0;
  font-size: 12px;
  line-height: 1.5;
}

.detail-content-group__body {
  display: grid;
  gap: 10px;
}
</style>
