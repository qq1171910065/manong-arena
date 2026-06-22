import { ref, watch } from 'vue'
import { getGeneralSettings } from './useGeneralSettings'

const STORAGE_KEY = 'mntools-sidebar-collapsed'
const searchFocusTick = ref(0)

function readCollapsed(): boolean {
  if (typeof localStorage === 'undefined') return getGeneralSettings().sidebarDefaultCollapsed
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw !== null) return raw === '1'
  return getGeneralSettings().sidebarDefaultCollapsed
}

const collapsed = ref(readCollapsed())

watch(collapsed, (v) => {
  localStorage.setItem(STORAGE_KEY, v ? '1' : '0')
  document.documentElement.dataset.sidebarCollapsed = v ? '1' : '0'
})

document.documentElement.dataset.sidebarCollapsed = collapsed.value ? '1' : '0'

export function useSidebar() {
  function toggle() {
    collapsed.value = !collapsed.value
  }

  return { collapsed, toggle }
}

export function toggleSidebarCollapsed(): void {
  collapsed.value = !collapsed.value
}

export function setSidebarCollapsed(value: boolean): void {
  collapsed.value = value
}

export function requestSidebarSearchFocus(): void {
  searchFocusTick.value += 1
}

export function useSidebarSearchFocus(onFocus: () => void): void {
  watch(searchFocusTick, () => onFocus())
}
