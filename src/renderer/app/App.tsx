import type { EditorState } from '@codemirror/state'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileMeta } from '../../preload/api'
import type { EditorStats } from '../editor/createEditor'
import { Editor, type Buffers } from './Editor'
import { EmptyState } from './EmptyState'
import { Autosave, errorMessage, type SaveEvent } from './state/autosave'
import { SESSION_SAVE_DELAY_MS, snapshotSession } from './state/session'
import {
  activateTab,
  closeTab,
  displayName,
  emptyTabs,
  fileName,
  firstContentLine,
  isInside,
  moveTab,
  openTab,
  setTabPath,
  type Tab,
  type TabsState
} from './state/tabs'
import { StatusBar, type StatusMessage } from './StatusBar'
import { TabBar } from './TabBar'

const api = window.scratchpost

// New notes use LF and no BOM on both platforms.
const NEW_NOTE_META: FileMeta = { eol: '\n', bom: false, encoding: 'utf8' }

const newNoteTab = (): Tab => ({ id: crypto.randomUUID(), path: null, scratch: true })

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

export function App() {
  const [tabsState, setTabsState] = useState<TabsState>(emptyTabs)
  const [restoring, setRestoring] = useState(true)
  const [firstLines, setFirstLines] = useState<Record<string, string | null>>({})
  const [stats, setStats] = useState<EditorStats>({ line: 1, column: 1, words: 0 })
  // Only tabs with something to report: a slow write or a failed one.
  const [saveStates, setSaveStates] = useState<Record<string, SaveEvent>>({})
  const [notice, setNotice] = useState<string | null>(null)

  const buffers = useRef<Buffers>({ states: new Map(), initial: new Map(), scroll: new Map() }).current
  const metas = useRef(new Map<string, FileMeta>()).current

  const scratchDir = useMemo(() => {
    const dir = api.getScratchDir()
    dir.catch(() => {}) // failures surface where it's awaited
    return dir
  }, [])

  // Saves read tabs from this ref, not render state, so a path set by
  // createNote is visible to the very next save.
  const tabsRef = useRef(tabsState)
  const updateTabs = useCallback((change: (s: TabsState) => TabsState) => {
    tabsRef.current = change(tabsRef.current)
    setTabsState(tabsRef.current)
  }, [])

  // --- Session ---

  const sessionReady = useRef(false) // never save before restore finishes
  const sessionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionWrites = useRef<Promise<void>>(Promise.resolve())

  const saveSessionNow = useCallback((): Promise<void> => {
    clearTimeout(sessionTimer.current)
    if (!sessionReady.current) return sessionWrites.current
    const session = snapshotSession(tabsRef.current, (id) => ({
      cursor: buffers.states.get(id)?.selection.main.head ?? buffers.initial.get(id)?.cursor ?? 0,
      scroll: buffers.scroll.get(id) ?? 0
    }))
    // Serialised so two writes never race on the same tmp file. Failures are
    // silent: a stale session costs tab positions, never note content.
    sessionWrites.current = sessionWrites.current.then(() => api.setSession(session)).catch(() => {})
    return sessionWrites.current
  }, [buffers])

  const scheduleSession = useCallback(() => {
    clearTimeout(sessionTimer.current)
    sessionTimer.current = setTimeout(() => void saveSessionNow(), SESSION_SAVE_DELAY_MS)
  }, [saveSessionNow])

  useEffect(() => {
    scheduleSession()
  }, [tabsState, scheduleSession])

  const restoreStarted = useRef(false)
  useEffect(() => {
    if (restoreStarted.current) return
    restoreStarted.current = true

    void (async () => {
      try {
        const [session, dir] = await Promise.all([api.getSession(), scratchDir.catch(() => null)])
        const results = await Promise.allSettled(session.tabs.map((saved) => api.readFile(saved.path)))

        const restored: Tab[] = []
        const lines: Record<string, string | null> = {}
        let activeRestored: string | null = null
        for (const [index, result] of results.entries()) {
          // A file that's gone or unreadable is dropped silently.
          if (result.status !== 'fulfilled') continue
          const saved = session.tabs[index]
          const { content, meta } = result.value
          const id = crypto.randomUUID()
          buffers.initial.set(id, { doc: content, cursor: Math.min(saved.cursor, content.length) })
          buffers.scroll.set(id, Math.min(saved.scroll, content.length))
          metas.set(id, meta)
          lines[id] = firstContentLine(content.split('\n'))
          restored.push({ id, path: saved.path, scratch: dir !== null && isInside(saved.path, dir) })
          if (index === session.activeIndex) activeRestored = id
        }

        setFirstLines((prev) => ({ ...prev, ...lines }))
        updateTabs((s) => ({
          tabs: [...restored, ...s.tabs],
          activeId: s.activeId ?? activeRestored ?? restored.at(-1)?.id ?? null
        }))
      } catch {
        // No session is the same as an empty one.
      } finally {
        sessionReady.current = true
        setRestoring(false)
      }
    })()
  }, [buffers, metas, scratchDir, updateTabs])

  // --- Autosave ---

  const autosave = useMemo(
    () =>
      new Autosave(
        async (id) => {
          const tab = tabsRef.current.tabs.find((t) => t.id === id)
          if (!tab || !buffers.states.has(id)) return
          let path = tab.path
          if (!path) {
            // First keystroke in a new note: the file is created now, never before.
            const created = await api.createNote(await scratchDir)
            updateTabs((s) => setTabPath(s, id, created))
            path = created
          }
          const state = buffers.states.get(id)
          if (!state) return
          await api.writeFile(path, state.doc.toString(), metas.get(id) ?? NEW_NOTE_META)
        },
        (id, event) =>
          setSaveStates((prev) => (event.kind === 'ok' ? without(prev, id) : { ...prev, [id]: event }))
      ),
    [buffers, metas, scratchDir, updateTabs]
  )

  const onDocChange = useCallback(
    (id: string, state: EditorState) => {
      const line = firstContentLine(state.doc.iterLines())
      setFirstLines((prev) => (prev[id] === line ? prev : { ...prev, [id]: line }))
      const tab = tabsRef.current.tabs.find((t) => t.id === id)
      autosave.schedule(id, !tab?.path)
    },
    [autosave]
  )

  useEffect(() => {
    const onBlur = () => {
      void autosave.flushAll()
      void saveSessionNow()
    }
    window.addEventListener('blur', onBlur)
    const offBeforeClose = api.onBeforeClose(async () => {
      await autosave.flushAll()
      await saveSessionNow()
    })
    return () => {
      window.removeEventListener('blur', onBlur)
      offBeforeClose()
    }
  }, [autosave, saveSessionNow])

  // --- Tab actions ---

  const flushActive = () => {
    const active = tabsRef.current.activeId
    if (active) void autosave.flush(active)
  }

  const activate = (id: string) => {
    if (tabsRef.current.activeId !== id) flushActive()
    updateTabs((s) => activateTab(s, id))
  }

  // Closing never prompts; pending edits are written first. If that write
  // fails the tab stays open, so edits that aren't on disk are never dropped.
  const close = async (id: string) => {
    if (!(await autosave.flush(id))) return
    autosave.forget(id)
    updateTabs((s) => closeTab(s, id))
    buffers.initial.delete(id)
    metas.delete(id)
    setSaveStates((prev) => without(prev, id))
  }

  const newNote = () => {
    setNotice(null)
    flushActive()
    updateTabs((s) => openTab(s, newNoteTab()))
  }

  const openFile = async () => {
    setNotice(null)
    const path = await api.pickFile()
    if (!path) return
    const existing = tabsRef.current.tabs.find((t) => t.path === path)
    if (existing) return activate(existing.id)

    try {
      const { content, meta } = await api.readFile(path)
      const dir = await scratchDir.catch(() => null)
      const id = crypto.randomUUID()
      buffers.initial.set(id, { doc: content, cursor: 0 })
      metas.set(id, meta)
      setFirstLines((prev) => ({ ...prev, [id]: firstContentLine(content.split('\n')) }))
      flushActive()
      updateTabs((s) => openTab(s, { id, path, scratch: dir !== null && isInside(path, dir) }))
    } catch (err) {
      setNotice(`couldn't open ${fileName(path)}: ${errorMessage(err)}`)
    }
  }

  // --- Render ---

  const { tabs, activeId } = tabsState
  const nameOf = (tab: Tab) => displayName(tab, firstLines[tab.id] ?? null)

  // Silent while saves succeed. Failures win, the active tab's first.
  const failures = tabs.flatMap((tab) => {
    const state = saveStates[tab.id]
    return state?.kind === 'error' ? [{ tab, message: state.message }] : []
  })
  const failure = failures.find((f) => f.tab.id === activeId) ?? failures[0]
  const statusMessage: StatusMessage | null = failure
    ? { text: `save failed: ${nameOf(failure.tab)}: ${failure.message}`, error: true }
    : notice
      ? { text: notice, error: true }
      : Object.values(saveStates).some((s) => s.kind === 'slow')
        ? { text: 'saving', error: false }
        : null

  return (
    <div className="app">
      <TabBar
        tabs={tabs.map((tab) => ({
          id: tab.id,
          name: nameOf(tab),
          failed: saveStates[tab.id]?.kind === 'error'
        }))}
        activeId={activeId}
        onActivate={activate}
        onClose={(id) => void close(id)}
        onMove={(id, toIndex) => updateTabs((s) => moveTab(s, id, toIndex))}
        onNew={newNote}
        onOpen={() => void openFile()}
      />
      <Editor
        activeId={activeId}
        openIds={tabs.map((tab) => tab.id)}
        buffers={buffers}
        onStats={setStats}
        onDocChange={onDocChange}
        onViewChange={scheduleSession}
      />
      {/* Blank while the session loads, so the empty state never flashes. */}
      {!activeId && (restoring ? <div className="editor-blank" /> : <EmptyState onNewNote={newNote} />)}
      <StatusBar folderName="Scratchpost" stats={stats} message={statusMessage} />
    </div>
  )
}
