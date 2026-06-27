<script setup lang="ts">

import type { ArenaSettings } from '@shared/arena/types'

import { MIMO_TTS_VOICES } from '@shared/arena/voice-presets'

import SettingsBlock from './SettingsBlock.vue'

import SettingsRow from './SettingsRow.vue'

import SettingsSegment from './SettingsSegment.vue'

import SettingsVolumeRow from './SettingsVolumeRow.vue'



defineProps<{

  settings: ArenaSettings

  boolOptions: Array<{ label: string; value: boolean }>

}>()



const emit = defineEmits<{

  update: [key: keyof ArenaSettings, value: ArenaSettings[keyof ArenaSettings]]

  matchDefault: [key: keyof ArenaSettings['matchDefaults'], value: ArenaSettings['matchDefaults'][keyof ArenaSettings['matchDefaults']]]

  save: []

}>()



const judgeVoiceOptions = MIMO_TTS_VOICES.filter((item) => item.lang === 'zh').map((item) => ({

  value: item.id,

  label: item.label,

}))

</script>



<template>

  <SettingsBlock title="环境与操作音" desc="大厅音乐与界面操作音效。">

    <SettingsRow label="背景音乐" hint="大厅与设置页环境音乐">

      <SettingsSegment

        variant="bool"

        :model-value="settings.bgmEnabled"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'bgmEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="界面音效" hint="按钮与对局推进反馈音">

      <SettingsSegment

        variant="bool"

        :model-value="settings.sfxEnabled"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'sfxEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsVolumeRow

      :model-value="settings.bgmVolume"

      label="音乐音量"

      :hint="`${settings.bgmVolume}%`"

      @update:model-value="(v) => emit('update', 'bgmVolume', v)"

      @change="emit('save')"

    />

    <SettingsVolumeRow

      :model-value="settings.sfxVolume"

      label="音效音量"

      :hint="`${settings.sfxVolume}%`"

      @update:model-value="(v) => emit('update', 'sfxVolume', v)"

      @change="emit('save')"

    />

  </SettingsBlock>



  <SettingsBlock title="对局语音播报" desc="角色发言与裁判公告朗读。">

    <SettingsRow label="发言播报" hint="按角色音色朗读发言">

      <SettingsSegment

        variant="bool"

        :model-value="settings.ttsEnabled"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'ttsEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsVolumeRow

      :model-value="settings.ttsVolume"

      label="播报音量"

      :hint="`${settings.ttsVolume}%`"

      @update:model-value="(v) => emit('update', 'ttsVolume', v)"

      @change="emit('save')"

    />

    <SettingsRow label="裁判播报" :hint="settings.ttsEnabled ? '裁判裁定与公告 TTS' : '需先开启发言播报'">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.judgeTtsEnabled"

        :options="boolOptions"

        :disabled="!settings.ttsEnabled"

        @update:model-value="(v) => emit('matchDefault', 'judgeTtsEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="裁判音色" :hint="settings.ttsEnabled ? '裁判与解说预置音色' : '需先开启发言播报'">

      <SettingsSegment

        :model-value="settings.judgeVoiceId"

        :options="judgeVoiceOptions"

        :disabled="!settings.ttsEnabled"

        @update:model-value="(v) => emit('update', 'judgeVoiceId', String(v))"

      />

    </SettingsRow>

  </SettingsBlock>

</template>

