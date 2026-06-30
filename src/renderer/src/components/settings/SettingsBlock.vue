<script setup lang="ts">
defineProps<{
  title?: string
  desc?: string
}>()
</script>

<template>
  <section class="portal-plain-block">
    <h4 v-if="title" class="portal-plain-block__title">{{ title }}</h4>
    <p v-if="desc" class="portal-plain-block__desc" :title="desc">{{ desc }}</p>
    <div class="settings-panel-body">
      <slot />
    </div>
  </section>
</template>
