<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { choose } from '@renderer/composables/useAppDialog'

let offCloseChoice: (() => void) | undefined

onMounted(() => {
  offCloseChoice = window.windowControls?.onRequestCloseChoice?.(() => {
    void choose({
      title: '关闭 Manong Arena',
      message: '关闭主窗口？',
      detail:
        '最小化到托盘后应用继续在后台运行；退出将关闭 Manong Arena。正在进行的对局窗口不会被强制关闭。',
      tone: 'default',
      choices: [
        { id: 'cancel', label: '取消', variant: 'default' },
        { id: 'tray', label: '最小化到托盘', variant: 'primary' },
        { id: 'quit', label: '退出', variant: 'danger' },
      ],
    }).then((choice) => {
      const normalized: 'cancel' | 'tray' | 'quit' =
        choice === 'tray' || choice === 'quit' ? choice : 'cancel'
      void window.windowControls?.submitCloseChoice?.(normalized)
    })
  })
})

onUnmounted(() => offCloseChoice?.())
</script>

<template><span /></template>
