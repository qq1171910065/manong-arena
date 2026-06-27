<script setup lang="ts">
import ProfileSectionHeader from './ProfileSectionHeader.vue'

defineProps<{
  title?: string
  desc?: string
}>()
</script>

<template>
  <div class="profile-section">
    <ProfileSectionHeader v-if="title" :title="title" :desc="desc">
      <template v-if="$slots.actions" #actions>
        <slot name="actions" />
      </template>
    </ProfileSectionHeader>

    <div class="profile-section__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.profile-section {
  flex: 1 1 0;
  min-height: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.profile-section__body {
  flex: 1 1 0;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  gap: var(--profile-body-gap, 16px);
  padding: var(--profile-body-padding-block) var(--profile-body-padding-inline);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.profile-section__body :deep(.n-spin-container) {
  flex: 0 1 auto;
  min-height: 0;
  height: auto;
  overflow: visible;
  display: block;
}

.profile-section__body :deep(.n-spin-content) {
  flex: 0 1 auto;
  min-height: 0;
  height: auto;
  overflow: visible;
  display: block;
}
</style>
