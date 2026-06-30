<script setup lang="ts">
import { Pencil } from 'lucide-vue-next'

defineProps<{
  title?: string
  hint?: string
  editable?: boolean
  empty?: boolean
}>()

const emit = defineEmits<{
  edit: []
}>()
</script>

<template>
  <article class="detail-editable-block" :class="{ 'detail-editable-block--empty': empty }">
    <header v-if="title" class="detail-editable-block__head">
      <div class="detail-editable-block__titles">
        <h3>{{ title }}</h3>
        <p v-if="hint" class="detail-editable-block__hint">{{ hint }}</p>
      </div>
      <button
        v-if="editable !== false"
        type="button"
        class="detail-editable-block__edit"
        :aria-label="`编辑${title}`"
        @click="emit('edit')"
      >
        <Pencil :size="14" />
        <span>编辑</span>
      </button>
    </header>
    <div class="detail-editable-block__body">
      <slot />
    </div>
  </article>
</template>

<style scoped>
.detail-editable-block {
  overflow: hidden;
  border: 1px solid rgba(130, 142, 207, 0.14);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.92);
}

.detail-editable-block--empty {
  border-style: dashed;
  background: rgba(255, 255, 255, 0.48);
}

.detail-editable-block__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 0;
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

.detail-editable-block__edit {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  height: 28px;
  padding: 0 10px;
  border: 1px solid rgba(130, 142, 207, 0.16);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  color: #66709d;
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.detail-editable-block__edit:hover {
  border-color: rgba(91, 87, 243, 0.28);
  background: rgba(112, 105, 255, 0.08);
  color: #5b57f3;
}

.detail-editable-block__body {
  padding: 10px 14px 14px;
}
</style>
