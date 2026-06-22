import { app, type BrowserWindow } from 'electron'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { URL } from 'node:url'

const DEFAULT_PORT = 17655

let server: Server | null = null

type WindowGetter = () => BrowserWindow | null

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'access-control-allow-origin': 'http://127.0.0.1',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  res.end(JSON.stringify(body))
}

function getRequestUrl(req: IncomingMessage): URL {
  return new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${DEFAULT_PORT}`}`)
}

function getMainWebContents(getWindow: WindowGetter): Electron.WebContents | null {
  const win = getWindow()
  if (!win || win.isDestroyed()) return null
  return win.webContents
}

async function handleScreenshot(getWindow: WindowGetter, res: ServerResponse): Promise<void> {
  const contents = getMainWebContents(getWindow)
  if (!contents) {
    sendJson(res, 404, { ok: false, error: 'main window is not available' })
    return
  }

  const image = await contents.capturePage()
  const size = image.getSize()
  res.writeHead(200, {
    'cache-control': 'no-store',
    'content-type': 'image/png',
    'x-arena-window-width': String(size.width),
    'x-arena-window-height': String(size.height),
  })
  res.end(image.toPNG())
}

async function handleClick(url: URL, getWindow: WindowGetter, res: ServerResponse): Promise<void> {
  const contents = getMainWebContents(getWindow)
  if (!contents) {
    sendJson(res, 404, { ok: false, error: 'main window is not available' })
    return
  }

  const x = Number(url.searchParams.get('x'))
  const y = Number(url.searchParams.get('y'))
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    sendJson(res, 400, { ok: false, error: 'x and y query parameters are required' })
    return
  }

  contents.sendInputEvent({ type: 'mouseMove', x, y })
  contents.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
  contents.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  sendJson(res, 200, { ok: true, x, y })
}

async function handleHover(url: URL, getWindow: WindowGetter, res: ServerResponse): Promise<void> {
  const contents = getMainWebContents(getWindow)
  if (!contents) {
    sendJson(res, 404, { ok: false, error: 'main window is not available' })
    return
  }

  const x = Number(url.searchParams.get('x'))
  const y = Number(url.searchParams.get('y'))
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    sendJson(res, 400, { ok: false, error: 'x and y query parameters are required' })
    return
  }

  contents.sendInputEvent({ type: 'mouseMove', x, y })
  sendJson(res, 200, { ok: true, x, y })
}

async function handleDom(getWindow: WindowGetter, res: ServerResponse): Promise<void> {
  const contents = getMainWebContents(getWindow)
  if (!contents) {
    sendJson(res, 404, { ok: false, error: 'main window is not available' })
    return
  }

  const result = await contents.executeJavaScript(`
    (() => {
      const active = document.activeElement
      const title = document.title
      const hash = window.location.hash
      const viewport = { width: window.innerWidth, height: window.innerHeight }
      const nodes = Array.from(document.querySelectorAll('button, a, [role="button"], input, textarea, select'))
        .slice(0, 80)
        .map((el) => {
          const rect = el.getBoundingClientRect()
          return {
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || '').trim().slice(0, 80),
            className: String(el.className || '').slice(0, 120),
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }
        })
      return {
        ok: true,
        title,
        hash,
        viewport,
        activeText: active ? (active.textContent || active.getAttribute('aria-label') || '').trim().slice(0, 80) : '',
        nodes,
      }
    })()
  `)
  sendJson(res, 200, result)
}

async function handleRoute(url: URL, getWindow: WindowGetter, res: ServerResponse): Promise<void> {
  const contents = getMainWebContents(getWindow)
  if (!contents) {
    sendJson(res, 404, { ok: false, error: 'main window is not available' })
    return
  }

  const hash = url.searchParams.get('hash') || ''
  if (!hash.startsWith('#/') && !hash.startsWith('/')) {
    sendJson(res, 400, { ok: false, error: 'hash must start with / or #/' })
    return
  }

  const nextHash = hash.startsWith('#') ? hash : `#${hash}`
  await contents.executeJavaScript(`window.location.hash = ${JSON.stringify(nextHash)}`)
  sendJson(res, 200, { ok: true, hash: nextHash })
}

async function handleRequest(req: IncomingMessage, res: ServerResponse, getWindow: WindowGetter): Promise<void> {
  try {
    const url = getRequestUrl(req)
    if (url.pathname === '/health') {
      sendJson(res, 200, { ok: true, packaged: app.isPackaged })
      return
    }
    if (url.pathname === '/screenshot') {
      await handleScreenshot(getWindow, res)
      return
    }
    if (url.pathname === '/click') {
      await handleClick(url, getWindow, res)
      return
    }
    if (url.pathname === '/hover') {
      await handleHover(url, getWindow, res)
      return
    }
    if (url.pathname === '/dom') {
      await handleDom(getWindow, res)
      return
    }
    if (url.pathname === '/route') {
      await handleRoute(url, getWindow, res)
      return
    }
    sendJson(res, 404, { ok: false, error: 'unknown debug endpoint' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) })
  }
}

export function registerDebugProbe(getWindow: WindowGetter): void {
  if (app.isPackaged || server) return

  const port = Number(process.env.ARENA_DEBUG_PORT || DEFAULT_PORT)
  server = createServer((req, res) => void handleRequest(req, res, getWindow))
  server.listen(port, '127.0.0.1', () => {
    console.info(`[arena:debug] Electron probe listening on http://127.0.0.1:${port}`)
  })
  server.on('error', (error) => {
    console.warn('[arena:debug] probe failed to start:', error)
    server = null
  })
}

export function closeDebugProbe(): void {
  const current = server
  server = null
  current?.close()
}
