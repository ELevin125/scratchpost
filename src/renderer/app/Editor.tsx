import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useMemo, useRef } from 'react'
import {
  createEditorState,
  editorExtensions,
  statsFor,
  type EditorStats
} from '../editor/createEditor'
import { firstContentLine } from './state/tabs'

interface EditorProps {
  activeId: string | null
  openIds: string[]
  onStats: (stats: EditorStats) => void
  onFirstLine: (id: string, line: string | null) => void
}

// One EditorView; each tab keeps its own EditorState (doc, undo, selection),
// swapped in when the tab is activated.
export function Editor({ activeId, openIds, onStats, onFirstLine }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const states = useRef(new Map<string, EditorState>())
  const shownId = useRef<string | null>(null)
  const callbacks = useRef({ onStats, onFirstLine })

  useEffect(() => {
    callbacks.current = { onStats, onFirstLine }
  })

  const extensions = useMemo(
    () =>
      editorExtensions((update) => {
        if (update.docChanged || update.selectionSet) callbacks.current.onStats(statsFor(update.state))
        if (update.docChanged && shownId.current) {
          callbacks.current.onFirstLine(shownId.current, firstContentLine(update.state.doc.iterLines()))
        }
      }),
    []
  )

  useEffect(() => {
    const v = new EditorView({ parent: host.current! })
    view.current = v
    return () => {
      v.destroy()
      view.current = null
      shownId.current = null
    }
  }, [])

  // A string key, so a new openIds array with the same ids doesn't re-run this.
  const openKey = openIds.join('\n')

  useEffect(() => {
    const v = view.current
    if (!v) return

    if (shownId.current) states.current.set(shownId.current, v.state)
    const open = new Set(openKey.split('\n'))
    for (const id of states.current.keys()) {
      if (!open.has(id)) states.current.delete(id)
    }

    if (!activeId) {
      shownId.current = null
      return
    }
    if (shownId.current === activeId) return

    const next = states.current.get(activeId) ?? createEditorState('', extensions)
    v.setState(next)
    shownId.current = activeId
    callbacks.current.onStats(statsFor(next))
    v.focus()
  }, [activeId, openKey, extensions])

  return <div className="editor" ref={host} hidden={!activeId} />
}
