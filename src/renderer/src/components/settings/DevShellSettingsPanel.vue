<script setup lang="ts">
import { computed } from 'vue'
import { getRuntimeConfig } from '@renderer/composables/runtime-config'
import { useEffectiveShellLayout } from '@renderer/composables/useDevShellLayout'
import SettingsRow from './SettingsRow.vue'
import SettingsSegment from './SettingsSegment.vue'
import type { ShellLayout } from '@shared/types'
import { NAlert, NButton, NRadio, NRadioGroup, NSpace, useMessage } from '../../ui'

const message = useMessage()
const config = getRuntimeConfig()
const { effectiveShellLayout, shellLayoutOverride, setShellLayoutOverride } = useEffectiveShellLayout(
  config.shellLayout
)

const selected = computed({
  get: () => effectiveShellLayout.value,
  set: (v: ShellLayout) => setShellLayoutOverride(v),
})

const usingOverride = computed(() => shellLayoutOverride.value != null)

function resetLayout() {
  setShellLayoutOverride(null)
  message.success('已恢复为 app.config 默认布局')
}
</script>

<template>
  <NSpace vertical :size="16">
    <NAlert type="info" :bordered="false">
      仅在开发模式可用：切换单页面 / 双栏布局，便于调试脚手架 Shell，不影响打包产物配置。
    </NAlert>

    <SettingsSegment title="排版布局" description="覆盖 app.config 中的 shellLayout，立即生效">
      <SettingsRow label="Shell 形态" hint="单页面无侧栏；双栏带左侧导航">
        <NRadioGroup v-model:value="selected" name="dev-shell-layout">
          <NSpace>
            <NRadio value="compact">单页面</NRadio>
            <NRadio value="sidebar">双栏布局</NRadio>
          </NSpace>
        </NRadioGroup>
      </SettingsRow>

      <SettingsRow label="项目默认" :hint="`app.config: ${config.shellLayout}`">
        <span class="text-muted">{{ config.shellLayout === 'compact' ? '单页面' : '双栏布局' }}</span>
      </SettingsRow>

      <SettingsRow label="当前生效">
        <span>
          {{ effectiveShellLayout === 'compact' ? '单页面' : '双栏布局' }}
          <span v-if="usingOverride" class="text-muted">（开发覆盖）</span>
        </span>
      </SettingsRow>

      <div style="margin-top: 8px">
        <NButton :disabled="!usingOverride" @click="resetLayout">恢复项目默认</NButton>
      </div>
    </SettingsSegment>
  </NSpace>
</template>
