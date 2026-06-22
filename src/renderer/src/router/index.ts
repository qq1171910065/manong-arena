import { computed, readonly, ref } from 'vue'

const currentPath = ref(normalizePath(window.location.hash.replace('#', '') || '/home'))

function normalizePath(path: string): string {
  if (!path || path === '/') return '/home'
  return path.startsWith('/') ? path : `/${path}`
}

function pathWithoutQuery(path: string): string {
  const q = path.indexOf('?')
  return q >= 0 ? path.slice(0, q) : path
}

function parseRoute(path: string) {
  const normalized = normalizePath(path)
  const pathname = pathWithoutQuery(normalized)
  const segments = pathname.split('/').filter(Boolean)
  const name = (segments[0] || 'home') as string
  const id = segments[1] || null
  return { path: normalized, name, segments, id }
}

export const route = computed(() => parseRoute(currentPath.value))

export function navigate(path: string): void {
  const next = normalizePath(path)
  if (currentPath.value === next) return
  currentPath.value = next
  window.location.hash = next
}

export function goBack(fallback = '/home'): void {
  if (window.history.length > 1) {
    window.history.back()
    return
  }
  navigate(fallback)
}

export function getCurrentPath(): string {
  return currentPath.value
}

window.addEventListener('hashchange', () => {
  currentPath.value = normalizePath(window.location.hash.replace('#', '') || '/home')
})

export const router = {
  route: readonly(route),
  navigate,
  goBack,
  getCurrentPath,
}
