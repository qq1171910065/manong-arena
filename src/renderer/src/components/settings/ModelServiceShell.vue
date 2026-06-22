<script setup lang="ts">
import { createModelService, provideModelService } from '@renderer/composables/useModelService'

provideModelService(createModelService())
</script>

<template>
  <slot />
</template>
