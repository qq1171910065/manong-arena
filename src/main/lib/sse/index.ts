import { ipcMain, type BrowserWindow } from 'electron'

let currentController: AbortController | null = null

function formatSseFetchError(err: unknown): string {
  const e = err as Error & { code?: string; cause?: unknown }
  const code = e?.code || (e?.cause as NodeJS.ErrnoException)?.code
  const msg = e?.message || String(err)
  if (code === 'ECONNRESET' || /ECONNRESET/i.test(msg)) {
    return '连接被服务器或网关重置（可能超时），请重试'
  }
  if (e?.name === 'AbortError') return '请求已取消'
  return msg || 'SSE 请求失败'
}

export function registerSseHandlers(getTargetWindow: () => BrowserWindow | null): void {
  ipcMain.handle(
    'request:fetch-sse',
    async (
      _event,
      payload: { url: string; method?: string; body?: string; token?: string }
    ) => {
      const { url, method = 'POST', body, token } = payload
      const win = getTargetWindow()
      if (!win) throw new Error('目标窗口不可用')

      if (currentController) currentController.abort()
      currentController = new AbortController()

      try {
        const headers: Record<string, string> = {
          Accept: 'text/event-stream',
          'Accept-Encoding': 'identity',
          'Content-Type': 'application/json',
          Connection: 'close',
          'User-Agent': 'mntools-electron/1.0',
        }
        if (token) headers.Authorization = `Bearer ${token}`

        const response = await fetch(url, {
          method,
          headers,
          body,
          signal: currentController.signal,
        })

        if (!response.ok) {
          const errMsg = `HTTP ${response.status}`
          win.webContents.send('sse:error', errMsg)
          throw new Error(errMsg)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          const errMsg = '无法读取响应流'
          win.webContents.send('sse:error', errMsg)
          throw new Error(errMsg)
        }

        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            win.webContents.send('sse:chunk', trimmed)
          }
        }

        if (buf.trim()) {
          win.webContents.send('sse:chunk', buf.trim())
        }

        win.webContents.send('sse:end')
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        const errMsg = formatSseFetchError(err)
        win.webContents.send('sse:error', errMsg)
        throw new Error(errMsg)
      } finally {
        currentController = null
      }
    }
  )

  ipcMain.handle('request:cancel-sse', async () => {
    if (currentController) {
      currentController.abort()
      currentController = null
    }
  })
}
