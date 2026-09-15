// Tab model: pure functions over an immutable state. No React, no IO.

export interface Tab {
  id: string
  path: string | null // null until a new note's first keystroke creates its file
  scratch: boolean // lives in the scratch folder; decides the display name
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

export function moveTab(state: TabsState, id: string, toIndex: number): TabsState {
  const from = state.tabs.findIndex((t) => t.id === id)
  if (from === -1) return state
  const tabs = [...state.tabs]
  const [tab] = tabs.splice(from, 1)
  tabs.splice(Math.max(0, Math.min(toIndex, tabs.length)), 0, tab)
  return { ...state, tabs }
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

// Scratch notes show their first line of content without leading `#` and
// whitespace; files from elsewhere show their real filename. See DESIGN.md.
export function displayName(tab: Tab, firstLine: string | null): string {
  if (!tab.scratch && tab.path) return fileName(tab.path)
  const name = (firstLine ?? '').replace(/^[#\s]+/, '').trimEnd()
  if (name === '') return 'untitled'
  return name.length > DISPLAY_NAME_MAX ? name.slice(0, DISPLAY_NAME_MAX - 1) + '…' : name
}
