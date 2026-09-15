import { useCallback, useState } from 'react'
import type { EditorStats } from '../editor/createEditor'
import { Editor } from './Editor'
import {
  activateTab,
  closeTab,
  displayName,
  emptyTabs,
  moveTab,
  openTab,
  type TabsState
} from './state/tabs'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'

const initialTabs = (): TabsState =>
  openTab(emptyTabs, { id: crypto.randomUUID(), path: null, scratch: true })

export function App() {
  const [tabsState, setTabsState] = useState(initialTabs)
  const [firstLines, setFirstLines] = useState<Record<string, string | null>>({})
  const [stats, setStats] = useState<EditorStats>({ line: 1, column: 1, words: 0 })

  const onFirstLine = useCallback((id: string, line: string | null) => {
    setFirstLines((prev) => (prev[id] === line ? prev : { ...prev, [id]: line }))
  }, [])

  const { tabs, activeId } = tabsState

  return (
    <div className="app">
      <TabBar
        tabs={tabs.map((tab) => ({ id: tab.id, name: displayName(tab, firstLines[tab.id] ?? null) }))}
        activeId={activeId}
        onActivate={(id) => setTabsState((s) => activateTab(s, id))}
        onClose={(id) => setTabsState((s) => closeTab(s, id))}
        onMove={(id, toIndex) => setTabsState((s) => moveTab(s, id, toIndex))}
      />
      <Editor
        activeId={activeId}
        openIds={tabs.map((tab) => tab.id)}
        onStats={setStats}
        onFirstLine={onFirstLine}
      />
      {/* The no-tabs empty state replaces this in 1.12. */}
      {!activeId && <div className="editor-blank" />}
      <StatusBar folderName="Scratchpost" stats={stats} />
    </div>
  )
}
