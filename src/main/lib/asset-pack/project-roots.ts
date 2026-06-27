import { app } from 'electron'
import { join } from 'node:path'

/** electron-vite dev 时 app.getAppPath() 可能不是项目根，需多路径探测 */
export function getProjectRoots(): string[] {
  const roots: string[] = []
  const add = (value: string) => {
    const trimmed = value.trim()
    if (trimmed && !roots.includes(trimmed)) roots.push(trimmed)
  }

  add(app.getAppPath())
  if (!app.isPackaged) {
    add(process.cwd())
    add(join(__dirname, '..', '..'))
    add(join(__dirname, '..'))
  }
  return roots
}
