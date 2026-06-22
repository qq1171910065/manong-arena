export type MntoolsRuntime = 'electron' | 'tauri' | 'web'

export function getMntoolsRuntime(): MntoolsRuntime {
  const raw = import.meta.env.VITE_MNTOOLS_RUNTIME
  if (raw === 'web' || raw === 'tauri') return raw
  return 'electron'
}

export function isWebRuntime(): boolean {
  return getMntoolsRuntime() === 'web'
}

export function isDesktopRuntime(): boolean {
  return !isWebRuntime()
}
