<script setup lang="ts">
import { RotateCcw } from 'lucide-vue-next'
import ProfileSectionLayout from './ProfileSectionLayout.vue'
import { NButton } from '../../ui'

defineProps<{
  title: string
  desc: string
  saving?: boolean
}>()

defineEmits<{
  reset: []
}>()
</script>

<template>
  <ProfileSectionLayout :title="title" :desc="desc">
    <template #actions>
      <NButton quaternary size="small" :loading="saving" @click="$emit('reset')">
        <template #icon><RotateCcw :size="14" /></template>
        恢复默认
      </NButton>
    </template>
    <slot />
  </ProfileSectionLayout>
</template>
