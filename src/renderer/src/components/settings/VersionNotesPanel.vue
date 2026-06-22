<script setup lang="ts">
import changelogRaw from '@renderer/data/changelog.md?raw'
import MarkdownContent from '../common/MarkdownContent.vue'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NCard } from '../../ui'
</script>

<template>
  <ProfileSectionLayout title="版本说明" desc="当前版本能力与更新要点。">
    <NCard class="mntools-panel version-notes-card">
      <MarkdownContent :source="changelogRaw" />
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.version-notes-card :deep(.n-card__content) {
  padding-top: 8px;
}
</style>
