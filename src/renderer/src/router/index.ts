import { computed, readonly, ref } from 'vue'

const currentPath = ref(
  normalizePath(resolveLegacyEditPath(window.location.hash.replace('#', '') || '/home'))
)

function normalizePath(path: string): string {
  if (!path || path === '/') return '/home'
  return path.startsWith('/') ? path : `/${path}`
}

function pathWithoutQuery(path: string): string {
  const q = path.indexOf('?')
  return q >= 0 ? path.slice(0, q) : path
}

function resolveLegacyEditPath(path: string): string {
  const pathname = pathWithoutQuery(normalizePath(path))
  if (pathname === '/character-edit/new') return '/characters?create=1'
  const charEdit = pathname.match(/^\/character-edit\/(.+)$/)
  if (charEdit?.[1]) return `/character-detail/${charEdit[1]}`
  const modeEdit = pathname.match(/^\/game-mode-edit\/(.+)$/)
  if (modeEdit?.[1]) return `/game-mode-detail/${modeEdit[1]}`
  return path
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
  const next = normalizePath(resolveLegacyEditPath(path))
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
  const raw = normalizePath(window.location.hash.replace('#', '') || '/home')
  const resolved = normalizePath(resolveLegacyEditPath(raw))
  if (resolved !== raw) {
    currentPath.value = resolved
    window.location.hash = resolved
    return
  }
  currentPath.value = raw
})

export const router = {
  route: readonly(route),
  navigate,
  goBack,
  getCurrentPath,
}
