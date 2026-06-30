<script setup lang="ts">
import type { Component } from 'vue'
import { Inbox } from 'lucide-vue-next'

withDefaults(
  defineProps<{
    title?: string
    description?: string
    icon?: Component
    hint?: string
  }>(),
  {
    hint: '点击此区域添加',
  }
)
</script>

<template>
  <div class="detail-region-empty">
    <div class="detail-region-empty__icon" aria-hidden="true">
      <component :is="icon || Inbox" :size="28" />
    </div>
    <strong class="detail-region-empty__title">{{ title || '暂无内容' }}</strong>
    <p v-if="description" class="detail-region-empty__desc">{{ description }}</p>
    <span v-if="hint" class="detail-region-empty__hint">{{ hint }}</span>
  </div>
</template>

<style scoped>
.detail-region-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  min-height: calc(var(--detail-block-min-height, 168px) - 28px);
  padding: 20px 16px;
  text-align: center;
  border: 1px dashed rgba(130, 142, 207, 0.22);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.35);
}

.detail-region-empty__icon {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(112, 105, 255, 0.06);
  color: #9aa3c7;
}

.detail-region-empty__title {
  color: #59649b;
  font-size: 13px;
  font-weight: 650;
}

.detail-region-empty__desc {
  margin: 0;
  max-width: 28ch;
  color: #9aa3c7;
  font-size: 12px;
  line-height: 1.45;
}

.detail-region-empty__hint {
  color: #b4bddb;
  font-size: 11px;
}
</style>
