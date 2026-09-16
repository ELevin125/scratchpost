// Tab model: pure functions over an immutable state. No React, no IO.

export interface Tab {
  id: string
  path: string | null // null until a new note's first keystroke creates its file
  scratch: boolean // lives in the scratch folder; decides the display name
  pinned?: boolean // pinned tabs sit first and survive "close all" (3.2)
}

export interface TabsState {
  tabs: Tab[]
  activeId: string | null
}

export const emptyTabs: TabsState = { tabs: [], activeId: null }

// Opening a path that is already open activates the existing tab instead.
export function openTab(state: TabsState, tab: Tab): TabsState {
  const existing = tab.path ? state.tabs.find((t) => t.path === tab.path) : undefined
  if (existing) return { ...state, activeId: existing.id }
  return { tabs: [...state.tabs, tab], activeId: tab.id }
}

// Closing the active tab activates its right neighbour, else its left.
export function closeTab(state: TabsState, id: string): TabsState {
  const index = state.tabs.findIndex((t) => t.id === id)
  if (index === -1) return state
  const tabs = state.tabs.filter((t) => t.id !== id)
  if (state.activeId !== id) return { ...state, tabs }
  const neighbour = tabs[index] ?? tabs[index - 1] ?? null
  return { tabs, activeId: neighbour?.id ?? null }
}

export function activateTab(state: TabsState, id: string): TabsState {
  return state.tabs.some((t) => t.id === id) ? { ...state, activeId: id } : state
}

// Pinned tabs first, each group keeping its order.
export function pinnedFirst(tabs: readonly Tab[]): Tab[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]
}

// A tab only moves within its own group: pinned among pinned, the rest after.
export function moveTab(state: TabsState, id: string, toIndex: number): TabsState {
  const from = state.tabs.findIndex((t) => t.id === id)
  if (from === -1) return state
  const tabs = [...state.tabs]
  const [tab] = tabs.splice(from, 1)
  const pinnedCount = tabs.filter((t) => t.pinned).length
  const [min, max] = tab.pinned ? [0, pinnedCount] : [pinnedCount, tabs.length]
  tabs.splice(Math.max(min, Math.min(toIndex, max)), 0, tab)
  return { ...state, tabs }
}

// Pinning moves a tab to the end of the pinned group; unpinning, to the start
// of the rest.
export function setPinned(state: TabsState, id: string, pinned: boolean): TabsState {
  const tab = state.tabs.find((t) => t.id === id)
  if (!tab || Boolean(tab.pinned) === pinned) return state
  const others = state.tabs.filter((t) => t.id !== id)
  const pinnedCount = others.filter((t) => t.pinned).length
  const tabs = [...others]
  tabs.splice(pinnedCount, 0, { ...tab, pinned })
  return { ...state, tabs }
}

// The tabs "close others" (keep given) and "close all" (keep null) close.
// Pinned tabs are never among them.
export function closableTabs(state: TabsState, keep: string | null): Tab[] {
  return state.tabs.filter((t) => !t.pinned && t.id !== keep)
}

export function setTabPath(state: TabsState, id: string, path: string): TabsState {
  return { ...state, tabs: state.tabs.map((t) => (t.id === id ? { ...t, path } : t)) }
}

const normalisePath = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')

// A note directly inside a folder named `archive` (D36).
export const isArchivedPath = (path: string): boolean => /(^|\/)archive\/[^/]+$/.test(normalisePath(path))

// True for files anywhere under dir, including subfolders.
export function isInside(path: string, dir: string): boolean {
  return normalisePath(path).startsWith(normalisePath(dir) + '/')
}

export const DISPLAY_NAME_MAX = 24

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

export function firstContentLine(lines: Iterable<string>): string | null {
  for (const line of lines) {
    if (line.trim() !== '') return line
  }
  return null
}

// YYYY-MM-DD-HHmm.md, with an optional -2, -3 collision suffix: the name a new
// note is created with.
export const AUTO_NOTE_NAME = /^\d{4}-\d{2}-\d{2}-\d{4}(-\d+)?\.md$/

const truncate = (name: string) =>
  name.length > DISPLAY_NAME_MAX ? name.slice(0, DISPLAY_NAME_MAX - 1) + '…' : name

// See DESIGN.md, "Tabs", and D26:
// - files from outside the scratch folder show their real filename;
// - scratch notes you have renamed show that name, without .md;
// - scratch notes still named by timestamp show their first line.
export function displayName(tab: Tab, firstLine: string | null): string {
  if (tab.path) {
    const name = fileName(tab.path)
    if (!tab.scratch) return name
    if (!AUTO_NOTE_NAME.test(name)) return truncate(name.replace(/\.md$/i, ''))
  }
  const line = (firstLine ?? '').replace(/^[#\s]+/, '').trimEnd()
  return line === '' ? 'untitled' : truncate(line)
}

// F2 on a timestamp-named note suggests a filename from its first line:
// "# Grocery list" → "grocery-list.md". Null when there is nothing to use.
export function suggestedNoteName(firstLine: string | null): string | null {
  const slug = (firstLine ?? '')
    .replace(/^[#\s]+/, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+/, '')
    .slice(0, 60)
    .replace(/-+$/, '')
  return slug === '' ? null : `${slug}.md`
}
