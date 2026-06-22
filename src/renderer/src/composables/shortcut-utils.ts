const MODIFIERS = new Set(['CommandOrControl', 'CmdOrCtrl', 'Command', 'Control', 'Ctrl', 'Shift', 'Alt', 'Option', 'Meta'])

function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPhone|iPod|iPad/i.test(navigator.platform)
}

function normalizeKeyPart(part: string): string {
  if (part === 'Comma') return ','
  if (part === 'Plus') return '+'
  if (part === 'Minus') return '-'
  if (part === 'Space') return 'Space'
  if (part.length === 1) return part.toUpperCase()
  return part
}

export function formatAcceleratorLabel(accelerator: string): string {
  if (!accelerator) return '未设置'
  const mac = isMacPlatform()
  return accelerator
    .split('+')
    .map((part) => {
      if (part === 'CommandOrControl' || part === 'CmdOrCtrl') return mac ? '⌘' : 'Ctrl'
      if (part === 'Command' || part === 'Meta') return '⌘'
      if (part === 'Control' || part === 'Ctrl') return 'Ctrl'
      if (part === 'Shift') return 'Shift'
      if (part === 'Alt' || part === 'Option') return mac ? '⌥' : 'Alt'
      return normalizeKeyPart(part)
    })
    .join(mac ? '' : '+')
}

function electronKeyFromEvent(event: KeyboardEvent): string | null {
  const { code, key } = event
  if (code.startsWith('Key')) return code.slice(3).toUpperCase()
  if (code.startsWith('Digit')) return code.slice(5)
  if (/^F\d+$/.test(code)) return code
  const map: Record<string, string> = {
    Comma: 'Comma',
    Minus: 'Minus',
    Equal: 'Equal',
    Space: 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Tab: 'Tab',
    Enter: 'Enter',
    Escape: 'Escape',
  }
  return map[key] ?? map[code] ?? null
}

export function acceleratorFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null
  if (event.key === 'Escape') return null

  const keyPart = electronKeyFromEvent(event)
  if (!keyPart || MODIFIERS.has(keyPart)) return null

  const parts = ['CommandOrControl']
  if (event.shiftKey) parts.push('Shift')
  if (event.altKey) parts.push('Alt')
  parts.push(keyPart)
  return parts.join('+')
}

export function eventMatchesAccelerator(event: KeyboardEvent, accelerator: string): boolean {
  const parts = accelerator
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return false

  const keyPart = normalizeKeyPart(parts[parts.length - 1])
  const mods = parts.slice(0, -1)
  const mac = isMacPlatform()

  const needsShift = mods.includes('Shift')
  const needsAlt = mods.includes('Alt') || mods.includes('Option')
  const needsMod = mods.some((m) =>
    ['CommandOrControl', 'CmdOrCtrl', 'Command', 'Control', 'Ctrl', 'Meta'].includes(m)
  )

  if (needsShift !== event.shiftKey) return false
  if (needsAlt !== event.altKey) return false

  const modPressed = mac ? event.metaKey : event.ctrlKey
  if (needsMod !== modPressed) return false

  if (keyPart.startsWith('F') && /^F\d+$/.test(keyPart)) {
    return event.key === keyPart
  }

  if (keyPart === 'Space') return event.key === ' ' || event.code === 'Space'
  if (keyPart === ',') return event.key === ','

  const eventKey = event.key.length === 1 ? event.key.toUpperCase() : event.key
  if (eventKey.toUpperCase() === keyPart.toUpperCase()) return true
  if (event.code === `Key${keyPart.toUpperCase()}`) return true
  if (event.code === `Digit${keyPart}`) return true
  return false
}

export function isValidAccelerator(accelerator: string): boolean {
  const parts = accelerator
    .split('+')
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 1) return false
  const key = parts[parts.length - 1]
  if (MODIFIERS.has(key)) return false
  return true
}
