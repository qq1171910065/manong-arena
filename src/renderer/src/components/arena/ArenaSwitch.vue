<script setup lang="ts">
const model = defineModel<boolean>({ default: false })

defineProps<{
  disabled?: boolean
}>()
</script>

<template>
  <button
    type="button"
    class="arena-switch"
    :class="{ active: model }"
    :disabled="disabled"
    :aria-pressed="model"
    @click="model = !model"
  />
</template>

<style scoped>
.arena-switch {
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 23px;
  border: 0;
  border-radius: 999px;
  background: #dbe0f3;
  cursor: pointer;
  transition: background 0.18s ease;
}

.arena-switch::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 3px 8px rgba(40, 48, 96, 0.16);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.arena-switch.active {
  background: #6c63ff;
}

.arena-switch.active::after {
  transform: translateX(17px);
}

.arena-switch:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
