import { ipcMain } from 'electron'
import { EventEmitter } from 'node:events'

const bus = new EventEmitter()

export function registerBusHandlers(): void {
  ipcMain.removeHandler('bus:emit')
  ipcMain.handle('bus:emit', (_event, channel: string, data?: any): void => {
    bus.emit(channel, data)
  })

  ipcMain.removeHandler('bus:on')
  ipcMain.handle('bus:on', (event, channel: string): void => {
    const handler = (data: any): void => {
      event.sender.send(`bus:event:${channel}`, data)
    }
    bus.on(channel, handler)
    event.sender.once('destroyed', () => {
      bus.off(channel, handler)
    })
  })
}
