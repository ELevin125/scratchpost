// Shortcut strings in the command registry look like "Ctrl+Shift+P",
// "Alt+ArrowUp" or "F2": modifiers, then a KeyboardEvent.key value.

export interface KeyEventLike {
  key: string
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  metaKey: boolean
}

// Letters compare case-insensitively, since Shift changes event.key's case.
const normaliseKey = (key: string) => (key.length === 1 ? key.toUpperCase() : key)

export function matchesShortcut(shortcut: string, event: KeyEventLike): boolean {
  const parts = shortcut.split('+')
  const key = parts.pop()!
  const modifiers = new Set(parts)
  return (
    normaliseKey(event.key) === normaliseKey(key) &&
    event.ctrlKey === modifiers.has('Ctrl') &&
    event.shiftKey === modifiers.has('Shift') &&
    event.altKey === modifiers.has('Alt') &&
    event.metaKey === modifiers.has('Meta')
  )
}

const KEY_LABELS: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→'
}

export function formatShortcut(shortcut: string): string {
  return shortcut
    .split('+')
    .map((part) => KEY_LABELS[part] ?? part)
    .join('+')
}
