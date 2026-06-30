<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { choose } from '@renderer/composables/useAppDialog'
import { saveGeneralSettings, type CloseBehavior } from '@renderer/composables/useGeneralSettings'

let offCloseChoice: (() => void) | undefined

onMounted(() => {
  offCloseChoice = window.windowControls?.onRequestCloseChoice?.(() => {
    void choose({
      title: '关闭 Manong Arena',
      message: '关闭主窗口？',
      detail:
        '最小化到托盘后应用继续在后台运行；退出将关闭 Manong Arena。正在进行的对局窗口不会被强制关闭。',
      tone: 'default',
      actionsLayout: 'row',
      rememberLabel: '记住我的选择',
      choices: [
        { id: 'tray', label: '最小化到托盘', variant: 'primary' },
        { id: 'quit', label: '退出', variant: 'danger' },
      ],
    }).then(({ choice, remember }) => {
      const normalized: 'cancel' | 'tray' | 'quit' =
        choice === 'tray' || choice === 'quit' ? choice : 'cancel'

      if (remember && (normalized === 'tray' || normalized === 'quit')) {
        saveGeneralSettings({ closeBehavior: normalized as CloseBehavior })
      }

      void window.windowControls?.submitCloseChoice?.(normalized)
    })
  })
})

onUnmounted(() => offCloseChoice?.())
</script>

<template><span /></template>
