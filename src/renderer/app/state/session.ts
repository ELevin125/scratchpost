import type { Session } from '../../../preload/api'
import type { TabsState } from './tabs'

export const SESSION_SAVE_DELAY_MS = 500

export interface TabPosition {
  cursor: number
  scroll: number
}

// Tabs in order, with positions. New notes without a file yet are skipped:
// there is nothing on disk to reopen.
export function snapshotSession(state: TabsState, positionOf: (id: string) => TabPosition): Session {
  const saved = state.tabs.filter((tab) => tab.path !== null)
  return {
    tabs: saved.map((tab) => ({ path: tab.path!, ...positionOf(tab.id), ...(tab.pinned ? { pinned: true } : {}) })),
    activeIndex: saved.findIndex((tab) => tab.id === state.activeId)
  }
}
