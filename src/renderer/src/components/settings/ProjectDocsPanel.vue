<script setup lang="ts">
import projectDocsRaw from '@renderer/data/project-docs.md?raw'
import MarkdownContent from '../common/MarkdownContent.vue'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NCard } from '../../ui'
</script>

<template>
  <ProfileSectionLayout
    title="项目文档"
    desc="Agent Arena 完整使用说明，帮助中心问答基于本文档。"
  >
    <NCard class="mntools-panel project-docs-card">
      <MarkdownContent :source="projectDocsRaw" />
    </NCard>
  </ProfileSectionLayout>
</template>

<style scoped>
.project-docs-card :deep(.n-card__content) {
  padding-top: 8px;
}
</style>
