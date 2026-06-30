<script setup lang="ts">
import type { Component } from 'vue'
import DetailRegionEmpty from './DetailRegionEmpty.vue'

const props = withDefaults(
  defineProps<{
    title?: string
    hint?: string
    editable?: boolean
    empty?: boolean
    emptyTitle?: string
    emptyDescription?: string
    emptyIcon?: Component
    flat?: boolean
  }>(),
  {
    editable: true,
    flat: false,
  }
)

const emit = defineEmits<{
  edit: []
}>()

function onBlockClick(event: MouseEvent) {
  if (props.editable === false) return
  const target = event.target as HTMLElement | null
  if (target?.closest('button, input, textarea, select, a, label, [data-no-edit]')) return
  emit('edit')
}
</script>

<template>
  <article
    class="detail-editable-block"
    :class="{
      'detail-editable-block--empty': empty,
      'detail-editable-block--flat': flat,
      'detail-editable-block--clickable': editable !== false,
    }"
    @click="onBlockClick"
  >
    <header v-if="title" class="detail-editable-block__head">
      <div class="detail-editable-block__titles">
        <h3>{{ title }}</h3>
        <p v-if="hint" class="detail-editable-block__hint">{{ hint }}</p>
      </div>
    </header>
    <div class="detail-editable-block__body">
      <slot v-if="!empty" />
      <slot v-else name="empty">
        <DetailRegionEmpty
          :title="emptyTitle || (title ? `暂无${title}` : '暂无内容')"
          :description="emptyDescription"
          :icon="emptyIcon"
        />
      </slot>
    </div>
  </article>
</template>

<style scoped>
.detail-editable-block {
  --detail-block-min-height: 168px;
  overflow: hidden;
  min-height: var(--detail-block-min-height);
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.detail-editable-block--flat {
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
}

.detail-editable-block--clickable {
  cursor: pointer;
}

.detail-editable-block--clickable:hover:not(.detail-editable-block--flat) {
  border-color: rgba(91, 87, 243, 0.22);
}

.detail-editable-block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 0;
}

.detail-editable-block--flat .detail-editable-block__head {
  padding: 0 0 8px;
}

.detail-editable-block__titles h3 {
  margin: 0;
  color: #17205a;
  font-size: 14px;
  font-weight: 650;
  line-height: 1.3;
}

.detail-editable-block__hint {
  margin: 4px 0 0;
  color: #9aa3c7;
  font-size: 11px;
  line-height: 1.45;
}

.detail-editable-block__body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: calc(var(--detail-block-min-height) - 40px);
  padding: 10px 14px 14px;
}

.detail-editable-block--flat .detail-editable-block__body {
  min-height: calc(var(--detail-block-min-height) - 28px);
  padding: 0;
}

.detail-editable-block--flat.detail-editable-block--clickable:hover .detail-editable-block__titles h3 {
  color: #5b57f3;
}
</style>
