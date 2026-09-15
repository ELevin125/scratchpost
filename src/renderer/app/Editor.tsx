import { useEffect, useRef } from 'react'
import { createEditor, type EditorStats } from '../editor/createEditor'

export function Editor({ onStats }: { onStats: (stats: EditorStats) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const onStatsRef = useRef(onStats)

  useEffect(() => {
    onStatsRef.current = onStats
  })

  useEffect(() => {
    const view = createEditor(host.current!, { onStats: (stats) => onStatsRef.current(stats) })
    view.focus()
    return () => view.destroy()
  }, [])

  return <div className="editor" ref={host} />
}
