<script setup lang="ts">
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import CharacterGameSkillsPanel from './CharacterGameSkillsPanel.vue'
import type { Character } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

defineProps<{ character: Character }>()
const emit = defineEmits<{ updated: [Character] }>()
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    title="场景记录"
    variant="preview"
    size="xl"
    body-flush
    show-header-close
  >
    <div class="scene-records-dialog__body">
      <CharacterGameSkillsPanel :character="character" @updated="(c) => emit('updated', c)" />
    </div>
  </ArenaDialogShell>
</template>

<style scoped>
.scene-records-dialog__body {
  padding: 16px 20px 20px;
}
</style>
