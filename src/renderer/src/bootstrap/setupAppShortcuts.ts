import { getGeneralSettings } from '../composables/useGeneralSettings'
import { requestSidebarSearchFocus, toggleSidebarCollapsed } from '../composables/useSidebar'
import {
  getShortcutBinding,
  SHORTCUT_CATALOG,
  type ShortcutActionId,
} from '../composables/useShortcutSettings'
import { eventMatchesAccelerator } from '../composables/shortcut-utils'
import { navigate } from '../router'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return target.isContentEditable
}

function executeShortcutAction(id: ShortcutActionId): void {
  switch (id) {
    case 'goSettings':
      navigate('/settings')
      break
    case 'focusSearch':
      requestSidebarSearchFocus()
      break
    case 'toggleSidebar':
      toggleSidebarCollapsed()
      break
  }
}

export function applyAppShortcuts(): void {
  // 应用内快捷键，无需额外注册
}

export function setupAppShortcuts(): () => void {
  function onKeyDown(event: KeyboardEvent) {
    if (!getGeneralSettings().enableShortcuts) return
    if (isTypingTarget(event.target)) return

    for (const item of SHORTCUT_CATALOG) {
      const binding = getShortcutBinding(item.id)
      if (!binding.enabled || !binding.accelerator.trim()) continue
      if (!eventMatchesAccelerator(event, binding.accelerator.trim())) continue
      event.preventDefault()
      executeShortcutAction(item.id)
      return
    }
  }

  document.addEventListener('keydown', onKeyDown)
  return () => document.removeEventListener('keydown', onKeyDown)
}
