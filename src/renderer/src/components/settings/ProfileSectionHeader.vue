<script setup lang="ts">
defineProps<{
  title: string
  desc?: string
}>()
</script>

<template>
  <div class="profile-section__head">
    <div class="profile-section__intro">
      <h3 class="profile-section__title">{{ title }}</h3>
      <p v-if="desc" class="profile-section__desc" :title="desc">{{ desc }}</p>
    </div>
    <div v-if="$slots.actions" class="profile-section__actions">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.profile-section__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  flex: 0 0 auto;
  min-height: 42px;
  margin: 0;
  padding: var(--profile-head-padding-block) var(--profile-head-padding-inline) 14px;
  border-bottom: 1px solid var(--profile-head-border);
}

.profile-section__intro {
  flex: 1 1 auto;
  min-width: 0;
}

.profile-section__actions {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.profile-section__actions :deep(.n-button:not(.n-button--tiny)) {
  height: 28px;
  min-height: 28px;
  padding-inline: 12px;
  font-size: var(--text-sm);
}

.profile-section__actions :deep(.n-button.n-button--text-type) {
  padding-inline: 8px;
}

.profile-section__title {
  margin: 0;
  color: var(--text);
  font-size: var(--text-xl);
  font-weight: 680;
  line-height: 1.2;
}

.profile-section__desc {
  margin: 5px 0 0;
  max-width: 100%;
  color: var(--muted);
  font-size: var(--text-sm);
  line-height: 1.45;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
