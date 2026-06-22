import { computed, ref } from 'vue'
import type { ShellLayout } from '@shared/types'

const STORAGE_KEY = 'mntools.dev.shellLayout'

function readOverride(): ShellLayout | null {
  if (typeof localStorage === 'undefined') return null
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'compact' || v === 'sidebar' ? v : null
}

const overrideRef = ref<ShellLayout | null>(readOverride())

/** 开发时覆盖 app.config 中的 shellLayout（仅 DEV 设置页写入） */
export function useEffectiveShellLayout(configured: ShellLayout) {
  const effectiveShellLayout = computed(() => overrideRef.value ?? configured)

  function setShellLayoutOverride(layout: ShellLayout | null) {
    overrideRef.value = layout
    if (layout) localStorage.setItem(STORAGE_KEY, layout)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return {
    effectiveShellLayout,
    shellLayoutOverride: overrideRef,
    setShellLayoutOverride,
  }
}

export function getShellLayoutOverride(): ShellLayout | null {
  return overrideRef.value ?? readOverride()
}
