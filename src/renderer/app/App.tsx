import { EditorSelection, type EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileMeta, FolderEntry, SearchHit } from '../../preload/api'
import type { EditorStats } from '../editor/createEditor'
import { CommandPalette } from './CommandPalette'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'
import { Editor, type Buffers } from './Editor'
import { EmptyState } from './EmptyState'
import { FileTree } from './FileTree'
import { FolderMenu } from './FolderMenu'
import { QuickSwitcher } from './QuickSwitcher'
import { RenameDialog } from './RenameDialog'
import { SearchPanel } from './SearchPanel'
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
import { relativePath } from './state/fileTree'
import { folderName, parentFolder, shortPath } from './state/folderContext'
import { selectionForHit } from './state/searchHits'
import { SESSION_SAVE_DELAY_MS, snapshotSession } from './state/session'
import { formatShortcut } from './state/shortcuts'
import {
  activateTab,
  AUTO_NOTE_NAME,
  closeTab,
  displayName,
  emptyTabs,
  fileName,
  firstContentLine,
  isInside,
  moveTab,
  openTab,
  setTabPath,
  suggestedNoteName,
  type Tab,
  type TabsState
} from './state/tabs'
import { StatusBar, type StatusMessage } from './StatusBar'
import { TabBar } from './TabBar'
import { useFolderContext } from './useFolderContext'

const api = window.scratchpost

// New notes use LF and no BOM on both platforms.
const NEW_NOTE_META: FileMeta = { eol: '\n', bom: false, encoding: 'utf8' }

// A rename that drops the extension keeps the original one.
const NOTE_EXTENSION = /\.(md|markdown|txt)$/i

// Ctrl+Shift+T remembers this many closed tabs.
const MAX_CLOSED = 20

type Overlay = 'palette' | 'switcher' | 'search' | 'folders' | 'rename'

// Where to land when opening a file from a search result.
interface HitTarget {
  line: number
  query: string
}

const newNoteTab = (): Tab => ({ id: crypto.randomUUID(), path: null, scratch: true })

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record
  const next = { ...record }
  delete next[key]
  return next
}

// A context menu item that takes its label and shortcut from the registry.
function menuItem(id: string, run: () => void): MenuItem {
  const command = commands.find((c) => c.id === id)
  return {
    label: command?.label ?? id,
    hint: command?.shortcut ? formatShortcut(command.shortcut) : undefined,
    run
  }
}

export function App() {
  const [tabsState, setTabsState] = useState<TabsState>(emptyTabs)
  const [restoring, setRestoring] = useState(true)
  const [firstLines, setFirstLines] = useState<Record<string, string | null>>({})
  const [stats, setStats] = useState<EditorStats>({ line: 1, column: 1, words: 0 })
  // Only tabs with something to report: a slow write or a failed one.
  const [saveStates, setSaveStates] = useState<Record<string, SaveEvent>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [treeOpen, setTreeOpen] = useState(false) // hidden by default
  // When each file was last saved this session, so the tree's times and
  // recent-first order are current without re-reading the folder.
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})

  const buffers = useRef<Buffers>({ states: new Map(), initial: new Map(), scroll: new Map() }).current
  const metas = useRef(new Map<string, FileMeta>()).current
  const viewRef = useRef<EditorView | null>(null)
  const closedPaths = useRef<string[]>([])

  const scratchDir = useMemo(() => {
    const dir = api.getScratchDir()
    dir.catch(() => {}) // failures surface where it's awaited
    return dir
  }, [])

  const folder = useFolderContext(scratchDir, setNotice)

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
          const written = path
          setSavedAt((prev) => ({ ...prev, [written]: Date.now() }))
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

  // --- Folder listing refresh ---
  // No watching until 3.1, so the tree, switcher and tag index re-read the
  // folder when the window regains focus and whenever an open file is created,
  // renamed or closed.

  const { refresh: refreshFolder } = folder
  useEffect(() => {
    const onFocus = () => void refreshFolder()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refreshFolder])

  const pathsKey = tabsState.tabs.map((tab) => tab.path ?? '').join('\n')
  useEffect(() => {
    if (treeOpen) void refreshFolder()
  }, [pathsKey, treeOpen, refreshFolder])

  // --- Tab actions ---

  const flushActive = () => {
    const active = tabsRef.current.activeId
    if (active) void autosave.flush(active)
  }

  const activate = (id: string) => {
    if (tabsRef.current.activeId !== id) flushActive()
    updateTabs((s) => activateTab(s, id))
  }

  const cycleTab = (step: 1 | -1) => {
    const { tabs, activeId } = tabsRef.current
    if (tabs.length < 2) return
    const index = tabs.findIndex((t) => t.id === activeId)
    activate(tabs[(index + step + tabs.length) % tabs.length].id)
  }

  // Removes a tab and everything held for it, without saving.
  const discardTab = (id: string) => {
    autosave.forget(id)
    updateTabs((s) => closeTab(s, id))
    buffers.initial.delete(id)
    metas.delete(id)
    setSaveStates((prev) => without(prev, id))
  }

  // Closing never prompts; pending edits are written first. If that write
  // fails the tab stays open, so edits that aren't on disk are never dropped.
  const close = async (id: string) => {
    if (!(await autosave.flush(id))) return
    const tab = tabsRef.current.tabs.find((t) => t.id === id)
    const text = buffers.states.get(id)?.doc.toString() ?? buffers.initial.get(id)?.doc
    discardTab(id)
    if (!tab?.path) return

    // An empty scratch note leaves nothing behind (D23). Main re-checks the
    // file on disk and refuses anything outside the scratch folder.
    if (tab.scratch && text !== undefined && text.trim() === '') {
      api.deleteIfEmpty(tab.path).then(() => refreshFolder(), () => {})
    } else {
      closedPaths.current = [...closedPaths.current.filter((p) => p !== tab.path), tab.path].slice(-MAX_CLOSED)
    }
  }

  const newNote = () => {
    setNotice(null)
    flushActive()
    updateTabs((s) => openTab(s, newNoteTab()))
  }

  // Put an already-open tab's selection on a search hit.
  const revealInTab = (id: string, target: HitTarget, wasActive: boolean) => {
    const state = buffers.states.get(id)
    if (state) {
      const hit = selectionForHit(state.doc.toString(), target.line, target.query)
      const selection = EditorSelection.single(hit.anchor, hit.head)
      const view = viewRef.current
      if (wasActive && view) {
        view.dispatch({ selection, effects: EditorView.scrollIntoView(hit.head, { y: 'center' }) })
        view.focus()
      } else {
        buffers.states.set(id, state.update({ selection }).state)
        buffers.scroll.set(id, hit.scrollTo)
      }
      return
    }
    // Restored but never shown yet.
    const initial = buffers.initial.get(id)
    if (initial) {
      const hit = selectionForHit(initial.doc, target.line, target.query)
      buffers.initial.set(id, { doc: initial.doc, cursor: hit.head, anchor: hit.anchor })
      buffers.scroll.set(id, hit.scrollTo)
    }
  }

  const openPath = async (path: string, target?: HitTarget) => {
    setNotice(null)
    const existing = tabsRef.current.tabs.find((t) => t.path === path)
    if (existing) {
      const wasActive = tabsRef.current.activeId === existing.id
      activate(existing.id)
      if (target) revealInTab(existing.id, target, wasActive)
      return
    }

    try {
      const { content, meta } = await api.readFile(path)
      const dir = await scratchDir.catch(() => null)
      const id = crypto.randomUUID()
      const hit = target ? selectionForHit(content, target.line, target.query) : null
      buffers.initial.set(id, { doc: content, cursor: hit?.head ?? 0, anchor: hit?.anchor })
      if (hit) buffers.scroll.set(id, hit.scrollTo)
      metas.set(id, meta)
      setFirstLines((prev) => ({ ...prev, [id]: firstContentLine(content.split('\n')) }))
      flushActive()
      updateTabs((s) => openTab(s, { id, path, scratch: dir !== null && isInside(path, dir) }))
    } catch (err) {
      setNotice(`couldn't open ${fileName(path)}: ${errorMessage(err)}`)
    }
  }

  const reopenClosed = () => {
    const open = new Set(tabsRef.current.tabs.map((t) => t.path))
    while (closedPaths.current.length > 0) {
      const path = closedPaths.current.pop()!
      if (!open.has(path)) {
        void openPath(path)
        return
      }
    }
  }

  // To the OS trash, without a prompt: the trash is the undo (D29).
  const deleteNote = async (path: string) => {
    const tab = tabsRef.current.tabs.find((t) => t.path === path)
    if (tab) {
      // Let an in-flight save land first, so it can't recreate the file afterwards.
      await autosave.flush(tab.id)
      discardTab(tab.id)
    }
    closedPaths.current = closedPaths.current.filter((p) => p !== path)
    try {
      await api.trashFile(path)
      setNotice(`moved ${fileName(path)} to the trash`)
    } catch (err) {
      setNotice(`couldn't delete ${fileName(path)}: ${errorMessage(err)}`)
    }
    void refreshFolder()
  }

  const revealPath = (path: string) => {
    api.showInFolder(path).catch(() => {})
  }

  const copyPath = (path: string) => {
    navigator.clipboard.writeText(path).then(
      () => setNotice(`copied ${path}`),
      () => setNotice("couldn't copy the path")
    )
  }

  const openFile = async () => {
    const path = await api.pickFile()
    if (path) await openPath(path)
  }

  const openFolder = async () => {
    const path = await api.pickFolder()
    if (path) folder.switchTo(path)
  }

  const folderRoot = folder.root
  const searchFolder = useCallback(
    (query: string) => (folderRoot ? api.searchFolder(folderRoot, query) : Promise.resolve([])),
    [folderRoot]
  )

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
      closedPaths.current = closedPaths.current.filter((p) => p !== tab.path)
      updateTabs((s) => setTabPath(s, tab.id, to))
    } catch (err) {
      setNotice(`couldn't rename ${oldName}: ${errorMessage(err)}`)
    }
  }

  // --- Context menus ---

  const pathItems = (path: string): MenuItem[] => [
    menuItem('file.reveal', () => revealPath(path)),
    menuItem('file.copyPath', () => copyPath(path)),
    menuItem('file.delete', () => void deleteNote(path))
  ]

  const openTabMenu = (id: string, at: { x: number; y: number }) => {
    const tab = tabsRef.current.tabs.find((t) => t.id === id)
    if (!tab) return
    const items: MenuItem[] = [
      ...(tab.path
        ? [
            menuItem('file.rename', () => {
              activate(tab.id)
              setOverlay('rename')
            })
          ]
        : []),
      menuItem('tab.close', () => void close(tab.id)),
      ...(tab.path ? pathItems(tab.path) : [])
    ]
    setMenu({ ...at, items })
  }

  const openEntryMenu = (entry: FolderEntry, at: { x: number; y: number }) => {
    const items: MenuItem[] = entry.isDir
      ? [
          { label: 'Use as folder', run: () => folder.switchTo(entry.path) },
          menuItem('file.reveal', () => revealPath(entry.path)),
          menuItem('file.copyPath', () => copyPath(entry.path))
        ]
      : [
          { label: 'Open', run: () => void openPath(entry.path) },
          menuItem('file.rename', () => void openPath(entry.path).then(() => setOverlay('rename'))),
          ...pathItems(entry.path)
        ]
    setMenu({ ...at, items })
  }

  const closeMenu = useCallback(() => setMenu(null), [])

  // --- Commands ---

  const closeOverlay = () => {
    setOverlay(null)
    viewRef.current?.focus()
  }

  const actionsRef = useRef<AppActions | null>(null)
  useEffect(() => {
    actionsRef.current = {
      openPalette: () => setOverlay('palette'),
      openSwitcher: () => {
        void refreshFolder()
        setOverlay('switcher')
      },
      openSearch: () => {
        void refreshFolder() // search results use the listing for display names
        setOverlay('search')
      },
      openFolderMenu: () => setOverlay('folders'),
      newNote,
      openFile: () => void openFile(),
      openFolder: () => void openFolder(),
      openParentFolder: () => {
        const parent = folder.root ? parentFolder(folder.root) : null
        if (parent) folder.switchTo(parent)
      },
      useScratchFolder: () => folder.switchTo(null),
      toggleTree: () => setTreeOpen((open) => !open),
      renameActive: () => {
        if (activeTab()?.path) setOverlay('rename')
      },
      deleteActive: () => {
        const path = activeTab()?.path
        if (path) void deleteNote(path)
      },
      revealActive: () => {
        const path = activeTab()?.path
        if (path) revealPath(path)
      },
      copyActivePath: () => {
        const path = activeTab()?.path
        if (path) copyPath(path)
      },
      closeActive: () => {
        const id = tabsRef.current.activeId
        if (id) void close(id)
      },
      reopenClosed,
      nextTab: () => cycleTab(1),
      previousTab: () => cycleTab(-1)
    }
  })

  const isScratchContext = folder.isScratch
  const commandContext = useCallback((): CommandContext => {
    const tab = activeTab()
    return {
      view: tab ? viewRef.current : null,
      activePath: tab?.path ?? null,
      isScratchContext,
      actions: actionsRef.current!
    }
  }, [activeTab, isScratchContext])

  const runCommand = (command: Command) => {
    setOverlay(null)
    command.run(commandContext())
  }

  const runById = (id: string) => {
    const command = commands.find((c) => c.id === id)
    if (command) runCommand(command)
  }

  // Every shortcut in the app goes through here. Capture phase, so registry
  // shortcuts win over CodeMirror's keys. Text inputs (palette, rename, find
  // bar) are left alone so typing there never triggers a command. See D24.
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

  // The window title follows the active note, for Alt+Tab and the taskbar.
  const titleName = active ? nameOf(active) : null
  useEffect(() => {
    document.title = titleName ? `${titleName} — Scratchpost` : 'Scratchpost'
  }, [titleName])

  // Folder entries use the same display-name rules as tabs. For a note that is
  // open, its live first line wins over the listing, which is only as fresh as
  // the last folder read (a new note's file is read while still empty).
  const openFirstLines = new Map(
    tabs.flatMap((tab) => (tab.path ? [[tab.path, firstLines[tab.id] ?? null] as const] : []))
  )
  const entryName = (entry: FolderEntry) =>
    displayName(
      { id: entry.path, path: entry.path, scratch: folder.scratchDir !== null && isInside(entry.path, folder.scratchDir) },
      openFirstLines.has(entry.path) ? openFirstLines.get(entry.path)! : entry.firstLine
    )
  const entriesByPath = useMemo(
    () => new Map((folder.listing?.entries ?? []).map((entry) => [entry.path, entry])),
    [folder.listing]
  )
  const pathName = (path: string) => {
    const entry = entriesByPath.get(path)
    return entry ? entryName(entry) : fileName(path)
  }

  // F2 on a timestamp-named note suggests a name from its first line (D26).
  const renameSuggestion = (tab: Tab & { path: string }) => {
    const current = fileName(tab.path)
    if (!tab.scratch || !AUTO_NOTE_NAME.test(current)) return current
    return suggestedNoteName(firstLines[tab.id] ?? null) ?? current
  }

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

  const contextName = folder.root ? folderName(folder.root) : ''

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
        onTabMenu={openTabMenu}
        treeOpen={treeOpen}
        onToggleTree={() => runById('tree.toggle')}
        onNew={() => runById('note.new')}
        onOpen={() => runById('file.open')}
        treeHint={commandHint('tree.toggle')}
        newHint={commandHint('note.new')}
        openHint={commandHint('file.open')}
      />
      <div className="workspace">
        {treeOpen && (
          <FileTree
            key={folder.root ?? ''}
            folderName={contextName}
            isScratch={folder.isScratch}
            listing={folder.listing}
            activePath={active?.path ?? null}
            savedAt={savedAt}
            nameOf={entryName}
            onOpen={(path) => void openPath(path)}
            onOpenFolder={() => runById('folder.open')}
            onFolderMenu={() => runById('folder.switch')}
            onUseScratch={() => runById('folder.scratch')}
            onEntryMenu={openEntryMenu}
          />
        )}
        <div className="main-column">
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
          {!activeId &&
            (restoring ? <div className="editor-blank" /> : <EmptyState onNewNote={() => runById('note.new')} />)}
        </div>
      </div>
      <StatusBar
        folderLabel={folder.root ? shortPath(folder.root) : ''}
        folderPath={folder.root ?? ''}
        stats={stats}
        message={statusMessage}
        onFolder={() => runById('folder.switch')}
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
      {overlay === 'switcher' && folder.root && (
        <QuickSwitcher
          files={(folder.listing?.entries ?? [])
            .filter((entry) => !entry.isDir)
            .map((entry) => ({ path: entry.path, label: entryName(entry), detail: relativePath(entry.path, folder.root!) }))}
          onOpen={(path) => {
            setOverlay(null)
            void openPath(path)
          }}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'search' && (
        <SearchPanel
          folderName={contextName}
          nameOf={pathName}
          search={searchFolder}
          onOpen={(hit: SearchHit, query: string) => {
            setOverlay(null)
            void openPath(hit.path, { line: hit.line, query })
          }}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'folders' && (
        <FolderMenu
          scratchDir={folder.scratchDir}
          recentFolders={folder.recentFolders}
          current={folder.isScratch ? null : folder.root}
          parent={folder.root ? parentFolder(folder.root) : null}
          onSwitch={(path) => {
            closeOverlay()
            folder.switchTo(path)
          }}
          onOpenFolder={() => {
            closeOverlay()
            void openFolder()
          }}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'rename' && active?.path && (
        <RenameDialog
          name={renameSuggestion({ ...active, path: active.path })}
          onSubmit={(name) => void rename(name)}
          onClose={closeOverlay}
        />
      )}
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  )
}
