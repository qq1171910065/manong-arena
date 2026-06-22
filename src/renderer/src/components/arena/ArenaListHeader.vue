<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
}>()
</script>

<template>
  <header class="aa-list-head">
    <div class="aa-list-head__main">
      <h1>{{ title }}</h1>
      <p v-if="desc" class="aa-list-head__desc">{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="aa-list-head__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.aa-list-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 48px;
}

.aa-list-head__main {
  min-width: 0;
}

.aa-list-head h1 {
  margin: 0;
  color: #111a51;
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
}

.aa-list-head__desc {
  margin: 4px 0 0;
  color: #6b759f;
  font-size: 13px;
}

.aa-list-head__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}
</style>
