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
  // Tabs not yet shown. anchor is set when opening with a selection.
  initial: Map<string, { doc: string; cursor: number; anchor?: number }>
  scroll: Map<string, number> // per tab: document position of the top visible line
}

interface EditorProps {
  activeId: string | null
  openIds: string[]
  buffers: Buffers
  viewRef: { current: EditorView | null } // lets commands reach the view
  onStats: (stats: EditorStats) => void
  onDocChange: (id: string, state: EditorState) => void
  onViewChange: () => void // cursor moved or scrolled; the session needs saving
}

function topVisiblePos(view: EditorView): number {
  const scrolled = view.scrollDOM.getBoundingClientRect().top - view.documentTop
  return view.lineBlockAtHeight(Math.max(0, scrolled)).from
}

// One EditorView; each tab keeps its own EditorState (doc, undo, selection)
// and scroll position, swapped in when the tab is activated.
export function Editor({
  activeId,
  openIds,
  buffers,
  viewRef,
  onStats,
  onDocChange,
  onViewChange
}: EditorProps) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const shownId = useRef<string | null>(null)
  const callbacks = useRef({ onStats, onDocChange, onViewChange })

  useEffect(() => {
    callbacks.current = { onStats, onDocChange, onViewChange }
  })

  const extensions = useMemo(
    () =>
      editorExtensions((update) => {
        const id = shownId.current
        if (!id) return
        buffers.states.set(id, update.state)
        if (update.docChanged || update.selectionSet) callbacks.current.onStats(statsFor(update.state))
        if (update.docChanged) callbacks.current.onDocChange(id, update.state)
        if (update.selectionSet) callbacks.current.onViewChange()
      }),
    [buffers]
  )

  useEffect(() => {
    const v = new EditorView({ parent: host.current! })
    view.current = v
    viewRef.current = v

    const onScroll = () => {
      const id = shownId.current
      if (!id) return
      buffers.scroll.set(id, topVisiblePos(v))
      callbacks.current.onViewChange()
    }
    v.scrollDOM.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      v.scrollDOM.removeEventListener('scroll', onScroll)
      v.destroy()
      view.current = null
      viewRef.current = null
      shownId.current = null
    }
  }, [buffers, viewRef])

  // A string key, so a new openIds array with the same ids doesn't re-run this.
  const openKey = openIds.join('\n')

  useEffect(() => {
    const v = view.current
    if (!v) return

    const open = new Set(openKey.split('\n'))
    for (const id of buffers.states.keys()) {
      if (!open.has(id)) buffers.states.delete(id)
    }
    for (const id of buffers.scroll.keys()) {
      if (!open.has(id)) buffers.scroll.delete(id)
    }

    if (!activeId) {
      shownId.current = null
      return
    }
    if (shownId.current === activeId) return
    if (shownId.current && open.has(shownId.current)) {
      buffers.scroll.set(shownId.current, topVisiblePos(v))
    }

    let next = buffers.states.get(activeId)
    if (!next) {
      const initial = buffers.initial.get(activeId)
      next = createEditorState(initial?.doc ?? '', extensions, initial?.cursor ?? 0, initial?.anchor)
      buffers.states.set(activeId, next)
      buffers.initial.delete(activeId)
    }
    v.setState(next)
    shownId.current = activeId

    const top = buffers.scroll.get(activeId)
    if (top !== undefined && top > 0) {
      v.dispatch({ effects: EditorView.scrollIntoView(Math.min(top, next.doc.length), { y: 'start' }) })
    }
    callbacks.current.onStats(statsFor(next))
    v.focus()
  }, [activeId, openKey, buffers, extensions])

  return <div className="editor" ref={host} hidden={!activeId} />
}
