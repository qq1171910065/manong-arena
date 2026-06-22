import { ipcMain } from 'electron'

let db: any = null

export function registerDatabaseHandlers(appId: string): void {
  ipcMain.removeHandler('database:query')
  ipcMain.handle('database:query', async (_event, sql: string, params?: any[]): Promise<any> => {
    if (!db) {
      throw new Error('Database not initialized')
    }
    return db.prepare(sql).all(...(params || []))
  })

  ipcMain.removeHandler('database:execute')
  ipcMain.handle('database:execute', async (_event, sql: string, params?: any[]): Promise<void> => {
    if (!db) {
      throw new Error('Database not initialized')
    }
    db.prepare(sql).run(...(params || []))
  })
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}
