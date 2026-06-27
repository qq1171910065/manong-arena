<script setup lang="ts">

import type { ArenaSettings } from '@shared/arena/types'

import SettingsBlock from './SettingsBlock.vue'

import SettingsRow from './SettingsRow.vue'

import SettingsSegment from './SettingsSegment.vue'

import SettingsVolumeRow from './SettingsVolumeRow.vue'



defineProps<{

  settings: ArenaSettings

  boolOptions: Array<{ label: string; value: boolean }>

  identityModeOptions: Array<{ label: string; value: string }>

}>()



const emit = defineEmits<{

  update: [key: keyof ArenaSettings, value: ArenaSettings[keyof ArenaSettings]]

  matchDefault: [key: keyof ArenaSettings['matchDefaults'], value: ArenaSettings['matchDefaults'][keyof ArenaSettings['matchDefaults']]]

  evolution: [key: keyof ArenaSettings['characterEvolution'], value: ArenaSettings['characterEvolution'][keyof ArenaSettings['characterEvolution']]]

  save: []

}>()

</script>



<template>

  <SettingsBlock title="开局默认" desc="身份分配与开赛前确认。">

    <SettingsRow label="默认身份分配" hint="创建对局预选方式">

      <SettingsSegment

        :model-value="settings.defaultIdentityAssignMode"

        :options="identityModeOptions"

        @update:model-value="

          (v) => emit('update', 'defaultIdentityAssignMode', v as ArenaSettings['defaultIdentityAssignMode'])

        "

      />

    </SettingsRow>

    <SettingsRow label="开局前确认" hint="开局前展示规则确认">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.confirmBeforeStart"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'confirmBeforeStart', Boolean(v))"

      />

    </SettingsRow>

  </SettingsBlock>



  <SettingsBlock title="局内推进" desc="自动推进、节奏与信息展示。">

    <SettingsRow label="自动推进" hint="继续时自动执行下一步">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.autoAdvance"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'autoAdvance', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="自动下一轮" hint="复核后直接进入下一轮">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.autoNextRound"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'autoNextRound', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="快速节奏" hint="缩短自动推进间隔">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.fastMode"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'fastMode', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="模型调用提示" hint="显示等待与阶段提示">

      <SettingsSegment

        variant="bool"

        :model-value="settings.modelCallHints"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'modelCallHints', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="裁判解说" hint="完整裁判叙事与提醒">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.narratorEnabled"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'narratorEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="情绪标签" hint="发言旁显示表达分析">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.showEmotionTags"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'showEmotionTags', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="默认房间版式" hint="标准分栏或沉浸圆桌">

      <SettingsSegment

        :model-value="settings.matchDefaults.matchRoomLayout"

        :options="[

          { label: '标准分栏', value: 'classic' },

          { label: '沉浸圆桌', value: 'immersive' },

        ]"

        @update:model-value="(v) => emit('matchDefault', 'matchRoomLayout', v === 'immersive' ? 'immersive' : 'classic')"

      />

    </SettingsRow>

  </SettingsBlock>



  <SettingsBlock title="角色演化" desc="赛后复盘与行为准则。">

    <SettingsRow label="赛后复盘" hint="结束后自动复盘微调">

      <SettingsSegment

        variant="bool"

        :model-value="settings.characterEvolution.postGameReviewEnabled"

        :options="boolOptions"

        @update:model-value="(v) => emit('evolution', 'postGameReviewEnabled', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="自动应用准则" hint="复盘建议写入行为原则">

      <SettingsSegment

        variant="bool"

        :model-value="settings.characterEvolution.autoApplyBehaviorChanges"

        :options="boolOptions"

        @update:model-value="(v) => emit('evolution', 'autoApplyBehaviorChanges', Boolean(v))"

      />

    </SettingsRow>

  </SettingsBlock>



  <SettingsBlock title="余额保护" desc="低余额提醒与暂停策略。">

    <SettingsRow label="低余额暂停" hint="低于阈值时暂停确认">

      <SettingsSegment

        variant="bool"

        :model-value="settings.matchDefaults.pauseOnLowBalance"

        :options="boolOptions"

        @update:model-value="(v) => emit('matchDefault', 'pauseOnLowBalance', Boolean(v))"

      />

    </SettingsRow>

    <SettingsRow label="余额提醒" hint="余额不足界面提醒">

      <SettingsSegment

        variant="bool"

        :model-value="settings.balanceReminder"

        :options="boolOptions"

        @update:model-value="(v) => emit('update', 'balanceReminder', Boolean(v))"

      />

    </SettingsRow>

    <SettingsVolumeRow

      :model-value="settings.balanceReminderThresholdCents"

      label="提醒阈值"

      :hint="`${(settings.balanceReminderThresholdCents / 100).toFixed(2)} 元`"

      :min="100"

      :max="5000"

      :step="100"

      @update:model-value="(v) => emit('update', 'balanceReminderThresholdCents', v)"

      @change="emit('save')"

    />

  </SettingsBlock>

</template>

