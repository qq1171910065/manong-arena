type FileDialogFilters = Array<{ name: string; extensions: string[] }>

export async function saveJsonFile(defaultName: string, data: unknown): Promise<boolean> {
  const json = JSON.stringify(data, null, 2)
  if (window.api.saveFileDialog && window.api.writeTextFile) {
    const picked = await window.api.saveFileDialog(defaultName)
    if (!picked.success || !picked.path) return false
    const written = await window.api.writeTextFile(picked.path, json)
    if (!written.success) throw new Error(written.error || '写入文件失败')
    return true
  }

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = defaultName
  link.click()
  URL.revokeObjectURL(url)
  return true
}

export async function pickJsonFile(): Promise<{ content: string; name: string; path?: string } | null> {
  if (!window.api.openFileDialog || !window.api.readTextFile) {
    throw new Error('当前环境不支持文件选择')
  }
  const picked = await window.api.openFileDialog()
  if (!picked.success || !picked.path) return null
  const read = await window.api.readTextFile(picked.path)
  if (!read.success || read.content == null) {
    throw new Error(read.error || '读取文件失败')
  }
  return { content: read.content, name: read.name || 'import.json', path: picked.path }
}

export async function pickCharacterImportFile(): Promise<{ path: string; name: string } | null> {
  if (!window.api.openFileDialog) {
    throw new Error('当前环境不支持文件选择')
  }
  const filters: FileDialogFilters = [{ name: '角色包', extensions: ['zip', 'json'] }]
  const picked = await window.api.openFileDialog({ filters })
  if (!picked.success || !picked.path) return null
  const name = picked.path.split(/[\\/]/).pop() || 'import'
  return { path: picked.path, name }
}

export async function pickCharacterExportPath(defaultName: string): Promise<string | null> {
  if (!window.api.saveFileDialog) {
    throw new Error('当前环境不支持文件选择')
  }
  const filters: FileDialogFilters = [{ name: '角色包', extensions: ['zip'] }]
  const picked = await window.api.saveFileDialog(defaultName, { filters })
  if (!picked.success || !picked.path) return null
  return picked.path.toLowerCase().endsWith('.zip') ? picked.path : `${picked.path}.zip`
}

export function parseJsonFile<T>(content: string): T {
  return JSON.parse(content) as T
}
