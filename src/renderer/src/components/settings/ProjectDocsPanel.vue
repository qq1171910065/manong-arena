<script setup lang="ts">
import projectDocsRaw from '@renderer/data/project-docs.md?raw'
import MarkdownContent from '../common/MarkdownContent.vue'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
</script>

<template>
  <ProfileSectionLayout
    title="项目文档"
    desc="Agent Arena 完整使用说明，帮助中心问答基于本文档。"
  >
    <div class="portal-doc-content">
      <MarkdownContent :source="projectDocsRaw" />
    </div>
  </ProfileSectionLayout>
</template>
