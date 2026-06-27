<script setup lang="ts">
import { createModelService, provideModelService } from '@renderer/composables/useModelService'

provideModelService(createModelService())
</script>

<template>
  <div class="model-service-shell">
    <slot />
  </div>
</template>

<style scoped>
.model-service-shell {
  flex: 1 1 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.model-service-shell :deep(.profile-section) {
  flex: 1 1 0;
  min-height: 0;
}
</style>
