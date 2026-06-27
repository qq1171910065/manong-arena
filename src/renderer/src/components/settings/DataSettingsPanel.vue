<script setup lang="ts">

import type { ArenaSettings } from '@shared/arena/types'

import DataManagementPanel from './DataManagementPanel.vue'

import SettingsBlock from './SettingsBlock.vue'

import SettingsRow from './SettingsRow.vue'

import SettingsSegment from './SettingsSegment.vue'



defineProps<{

  settings: ArenaSettings

  boolOptions: Array<{ label: string; value: boolean }>

  retentionDayOptions: Array<{ label: string; value: string }>

}>()



const emit = defineEmits<{

  update: [key: keyof ArenaSettings, value: ArenaSettings[keyof ArenaSettings]]

  error: [message: string]

}>()

</script>



<template>

  <SettingsBlock title="记录策略" desc="自动保存与保留周期。">

    <SettingsRow label="自动保存记录" hint="对局结束后保留复盘">

      <SettingsSegment

        variant="bool"

        :model-value="settings.autoSaveMatch"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'autoSaveMatch', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="记录保留周期" hint="本地对局与日志保留">

      <SettingsSegment

        :model-value="String(settings.dataRetentionDays)"

        :options="retentionDayOptions"

        @update:model-value="(v) => emit('update', 'dataRetentionDays', Number(v) as ArenaSettings['dataRetentionDays'])"

      />

    </SettingsRow>

  </SettingsBlock>



  <SettingsBlock title="本地数据与素材" desc="备份、清理与恢复出厂。">

    <DataManagementPanel

      :retention-days="settings.dataRetentionDays"

      @error="(msg) => emit('error', msg)"

    />

  </SettingsBlock>

</template>

