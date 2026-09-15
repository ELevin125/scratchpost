import type { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useMemo, useRef } from 'react'
import {
  createEditorState,
  editorExtensions,
  statsFor,
  type EditorStats
} from '../editor/createEditor'

export interface Buffers {
  states: Map<string, EditorState> // per tab, kept current on every update
  initial: Map<string, string> // file content for tabs not yet shown
}

interface EditorProps {
  activeId: string | null
  openIds: string[]
  buffers: Buffers
  onStats: (stats: EditorStats) => void
  onDocChange: (id: string, state: EditorState) => void
}

// One EditorView; each tab keeps its own EditorState (doc, undo, selection),
// swapped in when the tab is activated.
export function Editor({ activeId, openIds, buffers, onStats, onDocChange }: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const shownId = useRef<string | null>(null)
  const callbacks = useRef({ onStats, onDocChange })

  useEffect(() => {
    callbacks.current = { onStats, onDocChange }
  })

  const extensions = useMemo(
    () =>
      editorExtensions((update) => {
        const id = shownId.current
        if (!id) return
        buffers.states.set(id, update.state)
        if (update.docChanged || update.selectionSet) callbacks.current.onStats(statsFor(update.state))
        if (update.docChanged) callbacks.current.onDocChange(id, update.state)
      }),
    [buffers]
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

    const open = new Set(openKey.split('\n'))
    for (const id of buffers.states.keys()) {
      if (!open.has(id)) buffers.states.delete(id)
    }

    if (!activeId) {
      shownId.current = null
      return
    }
    if (shownId.current === activeId) return

    let next = buffers.states.get(activeId)
    if (!next) {
      next = createEditorState(buffers.initial.get(activeId) ?? '', extensions)
      buffers.states.set(activeId, next)
      buffers.initial.delete(activeId)
    }
    v.setState(next)
    shownId.current = activeId
    callbacks.current.onStats(statsFor(next))
    v.focus()
  }, [activeId, openKey, buffers, extensions])

  return <div className="editor" ref={host} hidden={!activeId} />
}
