import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileMeta } from '../../preload/api'
import type { EditorStats } from '../editor/createEditor'
import { CommandPalette } from './CommandPalette'
import { Editor, type Buffers } from './Editor'
import { EmptyState } from './EmptyState'
import { RenameDialog } from './RenameDialog'
import { Autosave, errorMessage, type SaveEvent } from './state/autosave'
import {
  availableCommands,
  commandForEvent,
  commandHint,
  commands,
  type AppActions,
  type Command,
  type CommandContext
} from './state/commands'
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

// A rename that drops the extension keeps the original one.
const NOTE_EXTENSION = /\.(md|markdown|txt)$/i

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
  const [overlay, setOverlay] = useState<'palette' | 'rename' | null>(null)

  const buffers = useRef<Buffers>({ states: new Map(), initial: new Map(), scroll: new Map() }).current
  const metas = useRef(new Map<string, FileMeta>()).current
  const viewRef = useRef<EditorView | null>(null)

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

  const activeTab = useCallback((): Tab | null => {
    const { tabs, activeId } = tabsRef.current
    return tabs.find((t) => t.id === activeId) ?? null
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
    const tab = tabsRef.current.tabs.find((t) => t.id === id)
    const text = buffers.states.get(id)?.doc.toString() ?? buffers.initial.get(id)?.doc

    autosave.forget(id)
    updateTabs((s) => closeTab(s, id))
    buffers.initial.delete(id)
    metas.delete(id)
    setSaveStates((prev) => without(prev, id))

    // An empty scratch note leaves nothing behind (D23). Main re-checks the
    // file on disk and refuses anything outside the scratch folder.
    if (tab?.path && tab.scratch && text !== undefined && text.trim() === '') {
      api.deleteIfEmpty(tab.path).catch(() => {})
    }
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

  const rename = async (input: string) => {
    setOverlay(null)
    viewRef.current?.focus()
    const tab = activeTab()
    if (!tab?.path) return

    const oldName = fileName(tab.path)
    if (/[\\/]/.test(input)) {
      setNotice("a file name can't contain / or \\")
      return
    }
    const extension = NOTE_EXTENSION.exec(oldName)?.[0] ?? ''
    const newName = NOTE_EXTENSION.test(input) ? input : input + extension
    if (newName === oldName) return
    const to = tab.path.slice(0, tab.path.length - oldName.length) + newName

    // Flush first, so no pending save can land on the old path afterwards.
    if (!(await autosave.flush(tab.id))) return
    try {
      await api.renameFile(tab.path, to)
      updateTabs((s) => setTabPath(s, tab.id, to))
    } catch (err) {
      setNotice(`couldn't rename ${oldName}: ${errorMessage(err)}`)
    }
  }

  // --- Commands ---

  const actionsRef = useRef<AppActions | null>(null)
  useEffect(() => {
    actionsRef.current = {
      openPalette: () => setOverlay('palette'),
      newNote,
      openFile: () => void openFile(),
      renameActive: () => {
        if (activeTab()?.path) setOverlay('rename')
      },
      closeActive: () => {
        const id = tabsRef.current.activeId
        if (id) void close(id)
      }
    }
  })

  const commandContext = useCallback((): CommandContext => {
    const tab = activeTab()
    return { view: tab ? viewRef.current : null, activePath: tab?.path ?? null, actions: actionsRef.current! }
  }, [activeTab])

  const runCommand = (command: Command) => {
    setOverlay(null)
    command.run(commandContext())
  }

  const runById = (id: string) => {
    const command = commands.find((c) => c.id === id)
    if (command) runCommand(command)
  }

  const closeOverlay = () => {
    setOverlay(null)
    viewRef.current?.focus()
  }

  // Every shortcut in the app goes through here. Capture phase, so registry
  // shortcuts win over CodeMirror's keys. Text inputs (palette, rename) are
  // left alone so typing there never triggers a command. See D24.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const target = event.target
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
      const command = commandForEvent(commands, event, commandContext())
      if (!command) return
      event.preventDefault()
      event.stopPropagation()
      command.run(commandContext())
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [commandContext])

  // --- Render ---

  const { tabs, activeId } = tabsState
  const active = tabs.find((t) => t.id === activeId) ?? null
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
        onNew={() => runById('note.new')}
        onOpen={() => runById('file.open')}
        newHint={commandHint('note.new')}
        openHint={commandHint('file.open')}
      />
      <Editor
        activeId={activeId}
        openIds={tabs.map((tab) => tab.id)}
        buffers={buffers}
        viewRef={viewRef}
        onStats={setStats}
        onDocChange={onDocChange}
        onViewChange={scheduleSession}
      />
      {/* Blank while the session loads, so the empty state never flashes. */}
      {!activeId && (restoring ? <div className="editor-blank" /> : <EmptyState onNewNote={() => runById('note.new')} />)}
      <StatusBar
        folderName="Scratchpost"
        stats={stats}
        message={statusMessage}
        onPalette={() => runById('palette.open')}
        paletteHint={commandHint('palette.open')}
      />

      {overlay === 'palette' && (
        <CommandPalette
          commands={availableCommands(commands, commandContext())}
          onRun={runCommand}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'rename' && active?.path && (
        <RenameDialog name={fileName(active.path)} onSubmit={(name) => void rename(name)} onClose={closeOverlay} />
      )}
    </div>
  )
}
