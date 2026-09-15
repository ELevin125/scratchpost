import { useState } from 'react'
import type { EditorStats } from '../editor/createEditor'
import { Editor } from './Editor'
import { StatusBar } from './StatusBar'
import { TabBar } from './TabBar'

export function App() {
  const [stats, setStats] = useState<EditorStats>({ line: 1, column: 1, words: 0 })

  return (
    <div className="app">
      <TabBar tabs={[{ id: 'untitled', name: 'untitled' }]} activeId="untitled" />
      <Editor onStats={setStats} />
      <StatusBar folderName="Scratchpost" stats={stats} />
    </div>
  )
}
