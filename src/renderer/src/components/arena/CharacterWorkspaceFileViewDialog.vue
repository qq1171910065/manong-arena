<script setup lang="ts">

import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'

import type { CharacterWorkspaceFile } from '@shared/arena/character-agent'



const show = defineModel<boolean>({ default: false })



defineProps<{

  file: CharacterWorkspaceFile | null

  content: string

}>()

</script>



<template>

  <ArenaDialogShell

    v-model="show"

    :title="file?.name || '文件'"

    variant="preview"

    size="lg"
    show-header-close
  >

    <pre class="workspace-file-view__pre">{{ content }}</pre>

  </ArenaDialogShell>

</template>



<style scoped>

.workspace-file-view__pre {

  margin: 0;

  color: #3a4578;

  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace;

  font-size: 12px;

  line-height: 1.65;

  white-space: pre-wrap;

  word-break: break-word;

}

</style>


