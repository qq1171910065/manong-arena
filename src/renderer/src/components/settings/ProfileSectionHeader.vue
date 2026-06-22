<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="profile-section__head">
    <div>
      <h3 class="profile-section__title">{{ title }}</h3>
      <p v-if="desc" class="profile-section__desc">{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="profile-section__actions">
      <slot name="actions" />
    </div>
  </div>
</template>
