import { app } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

function iconRoots(): string[] {
  if (app.isPackaged) {
    return [join(process.resourcesPath, 'icons'), process.resourcesPath]
  }
  return [join(app.getAppPath(), 'build'), join(process.cwd(), 'build')]
}

export function resolveAppIcon(): string | undefined {
  for (const root of iconRoots()) {
    const winIcon = join(root, 'icon.ico')
    if (process.platform === 'win32' && existsSync(winIcon)) return winIcon
    const pngIcon = join(root, 'icon.png')
    if (existsSync(pngIcon)) return pngIcon
  }
  return undefined
}

export function appIconOptions(): { icon?: string } {
  const icon = resolveAppIcon()
  return icon ? { icon } : {}
}
