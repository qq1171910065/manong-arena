<script setup lang="ts">
import ArenaDialogShell from '@renderer/components/common/ArenaDialogShell.vue'
import CharacterScenarioRecordPanel from './CharacterScenarioRecordPanel.vue'
import type { Character } from '@shared/arena/types'

const show = defineModel<boolean>({ default: false })

const props = defineProps<{
  character: Character
  scenarioId: string
  scenarioName?: string
}>()
</script>

<template>
  <ArenaDialogShell
    v-model="show"
    :title="scenarioName || '场景记录'"
    variant="preview"
    size="lg"
    show-header-close
  >
    <CharacterScenarioRecordPanel
      v-if="show"
      :character="character"
      :scenario-id="scenarioId"
      :scenario-name="scenarioName"
    />
  </ArenaDialogShell>
</template>
