import { EditorSelection, type ChangeSet, type EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { FileMeta, FolderEntry, OpenRequest, SearchHit, WatchEvent } from '../../preload/api'
import { countTasks, replaceDocSpec, updateTaskCount, type EditorStats, type TaskCount } from '../editor/createEditor'
import { TAG_CLICK_EVENT } from '../editor/livePreview'
import { applyTheme, tintTheme, type ThemeMode } from '../themes'
import { ColourMenu } from './ColourMenu'
import { CommandPalette } from './CommandPalette'
import { ContextMenu, type MenuItem, type MenuState } from './ContextMenu'
import { Cat, signalCat } from './Cat'
import { Dock } from './Dock'
import { Editor, type Buffers } from './Editor'
import { EmptyState } from './EmptyState'
import { FileTree } from './FileTree'
import { FolderMenu } from './FolderMenu'
import { HistoryPanel } from './HistoryPanel'
import { LabelDialog, type LabelRenameRequest } from './LabelDialog'
import { ShortcutsPanel } from './ShortcutsPanel'
import { Picker, type PickerItem } from './Picker'
import { findLabels, tagHue, tagKey } from '../../shared/tags'
import { insertLabel, labelAt, labelWord, renameLabelHere } from '../editor/format'
import { applyLabelFilter, LABEL_FILTER_EVENT, labelFilterOf } from '../editor/labelFilter'
import { renameLabelInText } from '../../shared/tags'
import { linkForPaste } from '../editor/typing'
import { NoteHeader } from './NoteHeader'
import { QuickSwitcher } from './QuickSwitcher'
import { RenameDialog } from './RenameDialog'
import { SearchPanel } from './SearchPanel'
import { SettingsPanel } from './SettingsPanel'
import { Toast } from './Toast'
import { Autosave, errorMessage, type SaveEvent } from './state/autosave'
import {
  availableCommands,
  commandForEvent,
  commandHint,
  setShortcutOverrides,
  shortcutOf,
  commands,
  type AppActions,
  type Command,
  type CommandContext
} from './state/commands'
import { editedLabel, noteDate, relativePath } from './state/fileTree'
import { folderName, parentFolder } from './state/folderContext'
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
  closableTabs,
  isArchivedPath,
  moveTab,
  openTab,
  pinnedFirst,
  setPinned,
  setTabPath,
  suggestedNoteName,
  type Tab,
  type TabsState
} from './state/tabs'
import { TopBar } from './TopBar'
import { useFolderContext } from './useFolderContext'

const api = window.scratchpost

// New notes use LF and no BOM on both platforms.
const NEW_NOTE_META: FileMeta = { eol: '\n', bom: false, encoding: 'utf8' }

// A rename that drops the extension keeps the original one.
const NOTE_EXTENSION = /\.(md|markdown|txt)$/i

// Changes on disk are gathered for this long before the notes and tags panels
// re-read the folder.
const LISTING_REFRESH_MS = 500
const SNAPSHOT_EVERY_MS = 5 * 60 * 1000
const RECENT_WRITES = 8
const MAX_AUTO_ARCHIVE = 200 // per launch, so a long-forgotten folder never stalls
const NO_KEYBINDINGS: Record<string, string> = {}
const PARTY_WORDS = ['parrotparty', 'parrot party']

// Ctrl+Shift+T remembers this many closed tabs.
const MAX_CLOSED = 20

type Overlay = 'palette' | 'switcher' | 'search' | 'folders' | 'rename' | 'colours' | 'settings' | 'history' | 'labels' | 'shortcuts' | 'renameLabel'

// A note that changed on disk while it had unsaved edits, or was deleted.
type External = 'conflict' | 'deleted'

const CONFLICT_MESSAGE = 'changed on disk; load it or keep yours'

// Follows the OS light or dark setting, for the 'system' theme mode (3.8).
function useSystemDark(): boolean {
  const query = useMemo(() => window.matchMedia('(prefers-color-scheme: dark)'), [])
  const [dark, setDark] = useState(query.matches)
  useEffect(() => {
    const onChange = () => setDark(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [query])
  return dark
}

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
    hint: command && shortcutOf(command) ? formatShortcut(shortcutOf(command)!) : undefined,
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
  const [treeOpen, setTreeOpen] = useState(true) // the notes column is part of the layout (D33)
  const [tagFilter, setTagFilter] = useState<string | null>(null) // lowercased
  // When each file was last saved this session, so the tree's times and
  // recent-first order are current without re-reading the folder.
  const [savedAt, setSavedAt] = useState<Record<string, number>>({})
  const [party, setParty] = useState(false) // typing "parrot party" toggles rainbow text
  // The label each tab is filtered to (5.5), and the label being renamed (5.6).
  const [labelFilters, setLabelFilters] = useState<Record<string, string | null>>({})
  const [renamingLabel, setRenamingLabel] = useState<string | null>(null)

  const buffers = useRef<Buffers>({ states: new Map(), initial: new Map(), scroll: new Map() }).current
  const metas = useRef(new Map<string, FileMeta>()).current
  const viewRef = useRef<EditorView | null>(null)
  const closedPaths = useRef<string[]>([])

  // Replaced when the scratch folder setting changes; saves read the ref.
  const [scratchDir, setScratchDirPromise] = useState(() => {
    const dir = api.getScratchDir()
    dir.catch(() => {}) // failures surface where it's awaited
    return dir
  })
  const scratchDirRef = useRef(scratchDir)
  useEffect(() => {
    scratchDirRef.current = scratchDir
  }, [scratchDir])

  const folder = useFolderContext(scratchDir, setNotice)

  // What each tab's file held when last read or written, and what a save in
  // flight is writing. External changes are told apart from our own by these.
  const diskText = useRef(new Map<string, string>()).current
  const writing = useRef(new Map<string, string>()).current
  // The last few texts each tab wrote, so a late watcher event for one of our
  // own writes (or the empty file a new note starts as) is never a conflict.
  const recentWrites = useRef(new Map<string, string[]>()).current
  const rememberWrite = useCallback(
    (id: string, text: string) => {
      recentWrites.set(id, [...(recentWrites.get(id) ?? []), text].slice(-RECENT_WRITES))
    },
    [recentWrites]
  )
  const externalRef = useRef<Record<string, External>>({})
  const [external, setExternalState] = useState<Record<string, External>>({})
  const setExternal = useCallback((id: string, value: External | null) => {
    const current = externalRef.current
    if ((current[id] ?? null) === value) return
    const next = { ...current }
    if (value) next[id] = value
    else delete next[id]
    externalRef.current = next
    setExternalState(next)
  }, [])
  const reloading = useRef(false) // a doc change from disk, not from typing

  const systemDark = useSystemDark()

  // The saved theme, applied whenever it or the OS setting changes. See D33.
  const theme = folder.theme
  const themeMode: ThemeMode =
    theme?.mode === 'system' ? (systemDark ? 'dark' : 'light') : (theme?.mode ?? 'dark')
  useEffect(() => {
    if (theme) applyTheme(tintTheme(theme.seed, themeMode))
  }, [theme, themeMode])

  const fontSize = folder.settings?.fontSize ?? 13
  const noteColumns = folder.settings?.noteColumns ?? 80
  const catOn = folder.settings?.cat ?? true
  const catSpot = folder.settings?.catSpot ?? 'dock'
  useEffect(() => {
    document.documentElement.style.setProperty('--note-size', `${fontSize}px`)
    document.documentElement.style.setProperty('--note-columns', String(noteColumns))
    viewRef.current?.requestMeasure()
  }, [fontSize, noteColumns])

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
          diskText.set(id, content)
          void api.historySnapshot(saved.path, content).catch(() => {})
          lines[id] = firstContentLine(content.split('\n'))
          restored.push({
            id,
            path: saved.path,
            scratch: dir !== null && isInside(saved.path, dir),
            ...(saved.pinned ? { pinned: true } : {})
          })
          if (index === session.activeIndex) activeRestored = id
        }

        setFirstLines((prev) => ({ ...prev, ...lines }))
        updateTabs((s) => ({
          tabs: pinnedFirst([...restored, ...s.tabs]),
          activeId: s.activeId ?? activeRestored ?? restored.at(-1)?.id ?? null
        }))
      } catch {
        // No session is the same as an empty one.
      } finally {
        sessionReady.current = true
        setRestoring(false)
      }
    })()
  }, [buffers, metas, diskText, scratchDir, updateTabs])

  // --- Autosave ---

  const autosave = useMemo(
    () =>
      new Autosave(
        async (id) => {
          const tab = tabsRef.current.tabs.find((t) => t.id === id)
          if (!tab || !buffers.states.has(id)) return
          // Never write over a version from disk the user hasn't seen (3.1).
          if (externalRef.current[id] === 'conflict') throw new Error(CONFLICT_MESSAGE)
          let path = tab.path
          if (!path) {
            // First keystroke in a new note: the file is created now, never before.
            const created = await api.createNote(await scratchDirRef.current)
            rememberWrite(id, '')
            updateTabs((s) => setTabPath(s, id, created))
            path = created
          }
          const state = buffers.states.get(id)
          if (!state) return
          const text = state.doc.toString()
          writing.set(id, text)
          rememberWrite(id, text)
          try {
            await api.writeFile(path, text, metas.get(id) ?? NEW_NOTE_META)
          } finally {
            writing.delete(id)
          }
          diskText.set(id, text)
          setExternal(id, null) // a deleted note is back
          const written = path
          setSavedAt((prev) => ({ ...prev, [written]: Date.now() }))
        },
        (id, event) =>
          setSaveStates((prev) => (event.kind === 'ok' ? without(prev, id) : { ...prev, [id]: event }))
      ),
    [buffers, metas, diskText, writing, rememberWrite, setExternal, updateTabs]
  )

  // --- Version history (3.6, D38) ---
  // A snapshot on open, every five minutes while the text changes, on close
  // and quit, and before anything replaces the text. Main skips repeats.
  const snapshotted = useRef(new Map<string, string>()).current
  const snapshot = useCallback(
    (id: string, text?: string): Promise<void> => {
      const path = tabsRef.current.tabs.find((t) => t.id === id)?.path
      const value = text ?? buffers.states.get(id)?.doc.toString() ?? buffers.initial.get(id)?.doc
      if (!path || value === undefined || snapshotted.get(path) === value) return Promise.resolve()
      snapshotted.set(path, value)
      return api.historySnapshot(path, value).catch(() => {
        snapshotted.delete(path)
      })
    },
    [buffers, snapshotted]
  )
  const snapshotAll = useCallback(
    () => Promise.all(tabsRef.current.tabs.map((tab) => snapshot(tab.id))).then(() => {}),
    [snapshot]
  )
  useEffect(() => {
    const timer = setInterval(() => void snapshotAll(), SNAPSHOT_EVERY_MS)
    return () => clearInterval(timer)
  }, [snapshotAll])

  // The cat notices typing, a finished checklist and "meow" (3.9).
  const taskCounts = useRef(new Map<string, TaskCount>()).current
  const tellCat = useCallback(
    (id: string, state: EditorState, previous: EditorState, changes: ChangeSet) => {
      signalCat('typing')
      // The whole note is counted once per tab; after that only the lines a
      // change touched are read, so a long note costs no more than a short one.
      const before = taskCounts.get(id) ?? countTasks(previous.doc)
      const count = updateTaskCount(before, changes, previous.doc, state.doc)
      taskCounts.set(id, count)
      if (before.open > 0 && count.open === 0 && count.done > before.done) signalCat('checklist')
      const head = state.selection.main.head
      if (state.sliceDoc(head - 4, head).toLowerCase() === 'meow') signalCat('meow')
      const typed = (word: string) => state.sliceDoc(head - word.length, head).toLowerCase() === word
      const grew = state.doc.length > previous.doc.length
      if (grew && PARTY_WORDS.some(typed)) {
        setParty((on) => !on)
        signalCat('party')
      }
    },
    [taskCounts]
  )

  const onDocChange = useCallback(
    (id: string, state: EditorState, previous: EditorState, changes: ChangeSet) => {
      const line = firstContentLine(state.doc.iterLines())
      setFirstLines((prev) => (prev[id] === line ? prev : { ...prev, [id]: line }))
      if (reloading.current) return // loaded from disk; nothing to save
      tellCat(id, state, previous, changes)
      const tab = tabsRef.current.tabs.find((t) => t.id === id)
      autosave.schedule(id, !tab?.path)
    },
    [autosave, tellCat]
  )

  useEffect(() => {
    const onBlur = () => {
      void autosave.flushAll()
      void saveSessionNow()
    }
    window.addEventListener('blur', onBlur)
    const offBeforeClose = api.onBeforeClose(async () => {
      await autosave.flushAll()
      await Promise.all([saveSessionNow(), snapshotAll()])
    })
    return () => {
      window.removeEventListener('blur', onBlur)
      offBeforeClose()
    }
  }, [autosave, saveSessionNow, snapshotAll])

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
    diskText.delete(id)
    recentWrites.delete(id)
    setExternal(id, null)
    setSaveStates((prev) => without(prev, id))
  }

  // Closing never prompts; pending edits are written first. If that write
  // fails the tab stays open, so edits that aren't on disk are never dropped.
  const close = async (id: string) => {
    if (!(await autosave.flush(id))) {
      if (externalRef.current[id] === 'conflict') setNotice('pick a version before closing this note')
      return
    }
    const tab = tabsRef.current.tabs.find((t) => t.id === id)
    const text = buffers.states.get(id)?.doc.toString() ?? buffers.initial.get(id)?.doc
    void snapshot(id, text)
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
      const dir = await scratchDirRef.current.catch(() => null)
      const id = crypto.randomUUID()
      const hit = target ? selectionForHit(content, target.line, target.query) : null
      buffers.initial.set(id, { doc: content, cursor: hit?.head ?? 0, anchor: hit?.anchor })
      if (hit) buffers.scroll.set(id, hit.scrollTo)
      metas.set(id, meta)
      diskText.set(id, content)
      setFirstLines((prev) => ({ ...prev, [id]: firstContentLine(content.split('\n')) }))
      flushActive()
      updateTabs((s) => openTab(s, { id, path, scratch: dir !== null && isInside(path, dir) }))
      void api.historySnapshot(path, content).catch(() => {})
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
      movePinned(path, null)
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
      setExternal(tab.id, null) // the old path's unlink is ours
      movePinned(tab.path, to)
    } catch (err) {
      setNotice(`couldn't rename ${oldName}: ${errorMessage(err)}`)
    }
  }

  // --- Pinning, closing many, archiving (3.2) ---

  const closeMany = async (keep: string | null) => {
    for (const tab of closableTabs(tabsRef.current, keep)) await close(tab.id)
  }

  // Archiving closes the note's tab; Ctrl+Shift+T reopens it from the archive.
  // Moving out of the archive keeps the tab open at the new path. See D36.
  const moveArchive = async (path: string, out: boolean) => {
    const tab = tabsRef.current.tabs.find((t) => t.path === path)
    if (tab && !(await autosave.flush(tab.id))) return
    try {
      const to = out ? await api.unarchiveFile(path) : await api.archiveFile(path)
      closedPaths.current = closedPaths.current.filter((p) => p !== path)
      movePinned(path, to)
      if (tab && out) {
        updateTabs((s) => setTabPath(s, tab.id, to))
        setExternal(tab.id, null)
      } else if (tab) {
        discardTab(tab.id)
        closedPaths.current = [...closedPaths.current, to].slice(-MAX_CLOSED)
      }
      setNotice(out ? `moved ${fileName(to)} out of the archive` : `archived ${fileName(path)}`)
      void refreshFolder()
    } catch (err) {
      setNotice(`couldn't ${out ? 'move' : 'archive'} ${fileName(path)}: ${errorMessage(err)}`)
    }
  }

  // Notes pinned to the notes panel (4.7), kept in settings by path.
  const pinnedNotes = folder.settings?.pinnedNotes ?? []
  const setNotePinned = (path: string, pinned: boolean) => {
    const current = folder.settings?.pinnedNotes ?? []
    const next = pinned ? [...current.filter((p) => p !== path), path] : current.filter((p) => p !== path)
    void folder.persist({ pinnedNotes: next })
  }
  const movePinned = (from: string, to: string | null) => {
    const current = folder.settings?.pinnedNotes ?? []
    if (!current.includes(from)) return
    void folder.persist({ pinnedNotes: current.flatMap((p) => (p !== from ? [p] : to ? [to] : [])) })
  }
  const pinNoteItem = (path: string): MenuItem =>
    pinnedNotes.includes(path)
      ? menuItem('note.unpin', () => setNotePinned(path, false))
      : menuItem('note.pin', () => setNotePinned(path, true))

  const archiveItem = (path: string): MenuItem =>
    isArchivedPath(path)
      ? menuItem('file.unarchive', () => void moveArchive(path, true))
      : menuItem('file.archive', () => void moveArchive(path, false))

  // --- Context menus ---

  const pathItems = (path: string): MenuItem[] => [
    pinNoteItem(path),
    archiveItem(path),
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
            }),
            menuItem('file.history', () => {
              activate(tab.id)
              void snapshot(tab.id)
              setOverlay('history')
            })
          ]
        : []),
      tab.pinned
        ? menuItem('tab.unpin', () => updateTabs((s) => setPinned(s, tab.id, false)))
        : menuItem('tab.pin', () => updateTabs((s) => setPinned(s, tab.id, true))),
      menuItem('tab.close', () => void close(tab.id)),
      ...(tabsRef.current.tabs.length > 1 ? [menuItem('tab.closeOthers', () => void closeMany(tab.id))] : []),
      ...(tab.path ? pathItems(tab.path) : [])
    ]
    setMenu({ ...at, items })
  }

  // Right-click in the note (4.9): clipboard, formatting, label, headings and
  // list types, all from the registry. A click outside the selection moves the
  // cursor there first, so word commands act on the clicked word.
  const openEditorMenu = (event: React.MouseEvent) => {
    const view = viewRef.current
    if (!view || !(event.target instanceof Element) || !event.target.closest('.cm-content')) return
    event.preventDefault()
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    const inSelection = view.state.selection.ranges.some((r) => !r.empty && pos !== null && pos >= r.from && pos <= r.to)
    if (pos !== null && !inSelection) view.dispatch({ selection: { anchor: pos } })
    const hasSelection = view.state.selection.ranges.some((r) => !r.empty)
    const clipboard = (action: 'cut' | 'copy') => () => {
      view.focus()
      document.execCommand(action)
    }
    const paste = () => {
      view.focus()
      navigator.clipboard.readText().then(
        (text) => {
          const insert = linkForPaste(view.state, text) ?? text
          view.dispatch(view.state.replaceSelection(insert), { userEvent: 'input.paste', scrollIntoView: true })
        },
        () => setNotice("couldn't read the clipboard")
      )
    }
    const run = (id: string) => menuItem(id, () => runById(id))
    const label = pos === null ? null : labelAt(view.state, pos)
    const items: MenuItem[] = [
      ...(label
        ? [
            {
              label: `Show only ${label} lines`,
              run: () => filterByLabel(labelFilterOf(view.state) === label ? null : label)
            },
            {
              label: `Rename ${label}…`,
              run: () => {
                setRenamingLabel(label)
                setOverlay('renameLabel')
              }
            }
          ]
        : []),
      ...(hasSelection
        ? [
            { label: 'Cut', hint: 'Ctrl+X', divider: Boolean(label), run: clipboard('cut') },
            { label: 'Copy', hint: 'Ctrl+C', run: clipboard('copy') },
            run('note.fromSelectionMove'),
            run('note.fromSelectionCopy')
          ]
        : []),
      { label: 'Paste', hint: 'Ctrl+V', divider: Boolean(label) && !hasSelection, run: paste },
      { ...run('format.bold'), divider: true },
      run('format.italic'),
      run('format.strike'),
      run('format.code'),
      run('format.link'),
      run('label.insert'),
      { ...run('heading.1'), divider: true },
      run('heading.2'),
      run('heading.3'),
      run('heading.none'),
      { ...run('list.bullet'), divider: true },
      run('list.task'),
      run('list.ordered')
    ]
    setMenu({ x: event.clientX, y: event.clientY, items })
  }

  // The label picker's list: your labels from Settings, then the ones already
  // in this note (4.10). Typing a new word inserts it.
  const labelItems = (): PickerItem[] => {
    const own = folder.settings?.labels ?? []
    const seen = new Set(own.map(tagKey))
    const inNote: string[] = []
    const doc = viewRef.current?.state.doc
    if (doc) {
      for (const line of doc.iterLines()) {
        for (const match of findLabels(line)) {
          if (seen.has(tagKey(match.word))) continue
          seen.add(tagKey(match.word))
          inNote.push(match.word)
        }
      }
    }
    return [
      ...own.map((word) => ({ id: word, label: word, detail: 'your labels', swatch: tagHue(word) })),
      ...inNote.map((word) => ({ id: word, label: word, detail: 'in this note', swatch: tagHue(word) }))
    ]
  }
  const newLabelItem = useCallback((query: string): PickerItem | null => {
    const word = labelWord(query)
    return word ? { id: word, label: word, detail: 'new label', swatch: tagHue(word) } : null
  }, [])
  const pickLabel = (item: PickerItem) => {
    setOverlay(null)
    const view = viewRef.current
    if (!view) return
    insertLabel(item.id)(view)
    view.focus()
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

  // --- Opening from outside the app ---
  // Command-line paths, "Open with", a second launch and drops all end up here.
  // Requests are taken only after the session is restored. See D32.

  const openRequest = async (request: OpenRequest) => {
    const target = request.folders.at(-1)
    if (target) {
      folder.switchTo(target)
      setTreeOpen(true)
    }
    for (const path of request.files) await openPath(path)
    if (request.skipped.length > 0) {
      setNotice(`couldn't open ${request.skipped.map(fileName).join(', ')}: not a text file`)
    }
  }
  const openRequestRef = useRef(openRequest)
  useEffect(() => {
    openRequestRef.current = openRequest
  })

  useEffect(() => {
    if (restoring) return
    return api.onOpenPaths((request) => void openRequestRef.current(request))
  }, [restoring])

  // Capture phase, so CodeMirror never sees a file drop and inserts its text.
  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.stopPropagation()
      event.dataTransfer!.dropEffect = 'copy'
    }
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      event.stopPropagation()
      const paths = [...event.dataTransfer!.files].map((file) => api.pathForFile(file)).filter(Boolean)
      if (paths.length === 0) return
      api.resolvePaths(paths).then(
        (request) => void openRequestRef.current(request),
        () => {}
      )
    }
    window.addEventListener('dragover', onDragOver, true)
    window.addEventListener('drop', onDrop, true)
    return () => {
      window.removeEventListener('dragover', onDragOver, true)
      window.removeEventListener('drop', onDrop, true)
    }
  }, [])

  // --- External changes (3.1) ---
  // Main watches the folder context and every open file. A change to an open
  // note reloads it if the tab has nothing unsaved; otherwise the tab is held
  // in conflict until the user picks a version. See ARCHITECTURE.md and D35.

  const pathsToWatch = tabsState.tabs.flatMap((tab) => (tab.path ? [tab.path] : []))
  const watchKey = pathsToWatch.join('\n')
  const watchRoot = folder.root
  useEffect(() => {
    api.watch(watchRoot, watchKey ? watchKey.split('\n') : []).catch(() => {})
  }, [watchRoot, watchKey])

  const currentText = (id: string) => buffers.states.get(id)?.doc.toString() ?? buffers.initial.get(id)?.doc ?? null

  // Puts disk text into a tab, keeping the cursor where the text is unchanged.
  const loadFromDisk = (id: string, content: string, meta: FileMeta) => {
    void snapshot(id)
    metas.set(id, meta)
    diskText.set(id, content)
    const view = viewRef.current
    const state = buffers.states.get(id)
    if (state) {
      const spec = replaceDocSpec(state, content)
      if (spec && view && tabsRef.current.activeId === id) {
        reloading.current = true
        try {
          view.dispatch(spec)
        } finally {
          reloading.current = false
        }
      } else if (spec) {
        buffers.states.set(id, state.update(spec).state)
      }
    } else {
      const initial = buffers.initial.get(id)
      if (initial) buffers.initial.set(id, { doc: content, cursor: Math.min(initial.cursor, content.length) })
    }
    setFirstLines((prev) => ({ ...prev, [id]: firstContentLine(content.split('\n')) }))
    autosave.forget(id)
    setSaveStates((prev) => without(prev, id))
    setExternal(id, null)
  }

  const onExternalChange = async (change: WatchEvent) => {
    const root = folder.root
    if (root && (change.path === root || isInside(change.path, root))) scheduleListingRefresh()

    const tab = tabsRef.current.tabs.find((t) => t.path === change.path)
    if (!tab) return
    if (change.type === 'unlink') {
      setExternal(tab.id, 'deleted')
      return
    }

    let payload
    try {
      payload = await api.readFile(change.path)
    } catch {
      return // gone again, or unreadable; the next event will tell
    }
    const { content, meta } = payload
    const current = currentText(tab.id)
    const known = diskText.get(tab.id)
    const ours = recentWrites.get(tab.id)?.includes(content) ?? false
    if (content === known || ours || content === writing.get(tab.id) || content === current) {
      // Our own write, or the same text: nothing to do.
      if (content === current) diskText.set(tab.id, content)
      if (externalRef.current[tab.id] === 'deleted') setExternal(tab.id, null)
      return
    }
    const unsaved = current !== known || autosave.isPending(tab.id)
    if (unsaved) setExternal(tab.id, 'conflict')
    else loadFromDisk(tab.id, content, meta)
  }
  const onExternalRef = useRef(onExternalChange)
  useEffect(() => {
    onExternalRef.current = onExternalChange
  })
  useEffect(() => api.onWatchEvent((change) => void onExternalRef.current(change)), [])

  const listingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const scheduleListingRefresh = () => {
    clearTimeout(listingTimer.current)
    listingTimer.current = setTimeout(() => void refreshFolder(), LISTING_REFRESH_MS)
  }

  // Conflict choices for the active tab.
  const loadDiskVersion = async (id: string) => {
    const path = tabsRef.current.tabs.find((t) => t.id === id)?.path
    if (!path) return
    try {
      const { content, meta } = await api.readFile(path)
      loadFromDisk(id, content, meta)
    } catch (err) {
      setNotice(`couldn't load ${fileName(path)}: ${errorMessage(err)}`)
    }
  }
  const keepMine = (id: string) => {
    setExternal(id, null)
    autosave.schedule(id, true)
  }

  const historyUsage = useCallback(() => api.historyUsage(), [])
  const clearHistory = useCallback(async () => {
    snapshotted.clear()
    await api.historyClear().catch((err) => setNotice(`couldn't clear the history: ${errorMessage(err)}`))
  }, [snapshotted])

  // History panel data for the active note. Restoring is an ordinary edit, so
  // Ctrl+Z undoes it; the text it replaces is snapshotted first.
  const historyPath = tabsState.tabs.find((t) => t.id === tabsState.activeId)?.path ?? null
  const listHistory = useCallback(
    () => (historyPath ? api.historyList(historyPath) : Promise.resolve([])),
    [historyPath]
  )
  const readHistory = useCallback(
    (versionId: string) => (historyPath ? api.historyRead(historyPath, versionId) : Promise.reject(new Error('no note'))),
    [historyPath]
  )
  const restoreVersion = (text: string) => {
    const id = tabsRef.current.activeId
    const view = viewRef.current
    if (!id || !view) return
    void snapshot(id)
    const spec = replaceDocSpec(view.state, text)
    if (spec) view.dispatch({ ...spec, userEvent: 'input.restore', scrollIntoView: true })
    closeOverlay()
    setNotice('restored the version; Ctrl+Z undoes it')
  }

  // --- Settings (3.4) ---

  const changeScratchDir = async (path: string | null) => {
    await folder.persist({ scratchDir: path })
    const dir = api.getScratchDir()
    dir.catch((err) => setNotice(`couldn't use that folder: ${errorMessage(err)}`))
    setScratchDirPromise(dir)
  }
  const pickScratchDir = async () => {
    const path = await api.pickFolder()
    if (path) await changeScratchDir(path)
  }

  // A tag clicked in a note filters the tree to the notes that share it (D34).
  // The filter belongs to one folder and is cleared on switch.
  useEffect(() => setTagFilter(null), [folderRoot])
  useEffect(() => {
    const onTag = (event: Event) => {
      setTagFilter((event as CustomEvent<string>).detail)
      setTreeOpen(true)
      void refreshFolder()
    }
    window.addEventListener(TAG_CLICK_EVENT, onTag)
    return () => window.removeEventListener(TAG_CLICK_EVENT, onTag)
  }, [refreshFolder])

  // The editor owns the filter; this keeps the bar above the note in step.
  useEffect(() => {
    const onFilter = (event: Event) => {
      const id = tabsRef.current.activeId
      if (!id) return
      setLabelFilters((prev) => ({ ...prev, [id]: (event as CustomEvent<string | null>).detail }))
    }
    window.addEventListener(LABEL_FILTER_EVENT, onFilter)
    return () => window.removeEventListener(LABEL_FILTER_EVENT, onFilter)
  }, [])

  const filterByLabel = (word: string | null) => {
    const view = viewRef.current
    if (view) applyLabelFilter(view, word)
  }

  // Renaming a label: in this note as an undoable edit, or across the folder
  // through main, which rewrites the files (D44).
  const renameLabel = async ({ from, to, scope, inList }: LabelRenameRequest) => {
    setOverlay(null)
    setRenamingLabel(null)
    if (inList) {
      const labels = folder.settings?.labels ?? []
      void folder.persist({ labels: labels.map((word) => (word.toLowerCase() === from.toLowerCase() ? to : word)) })
    }
    const view = viewRef.current
    if (scope === 'note') {
      if (view) {
        renameLabelHere(from, to)(view)
        view.focus()
      }
    } else {
      const root = folder.root
      if (!root) return
      // Pending edits land first, so main never rewrites a stale file.
      await autosave.flushAll()
      try {
        const { files, failed } = await api.renameLabel(root, from, to)
        setNotice(
          files === 0
            ? `no notes mention ${from}`
            : `renamed ${from} to ${to} in ${files} ${files === 1 ? 'note' : 'notes'}` +
                (failed.length > 0 ? `, ${failed.length} couldn't be changed` : '')
        )
        void refreshFolder()
      } catch (err) {
        setNotice(`couldn't rename ${from}: ${errorMessage(err)}`)
        return
      }
    }
    // Keep a filter on the old name pointing at the new one.
    if (view && labelFilterOf(view.state)?.toLowerCase() === from.toLowerCase()) applyLabelFilter(view, to)
  }

  const closeMenu = useCallback(() => setMenu(null), [])

  // --- Auto-archive (5.8, D45) ---
  // Once per launch, and only when switched on: scratch notes nobody has
  // touched for a while move into archive/. Open and pinned notes stay, and
  // the toast says what moved.

  const autoArchived = useRef(false)
  const autoArchiveDays = folder.settings?.autoArchiveDays ?? 0
  useEffect(() => {
    if (restoring || autoArchived.current || autoArchiveDays === 0) return
    autoArchived.current = true
    void (async () => {
      const dir = await scratchDirRef.current.catch(() => null)
      if (!dir) return
      const entries = await api.listFolder(dir).catch(() => [])
      const cutoff = Date.now() - autoArchiveDays * 24 * 60 * 60 * 1000
      const open = new Set(tabsRef.current.tabs.map((tab) => tab.path))
      const pinned = new Set(pinnedNotesRef.current)
      const stale = entries
        .filter(
          (entry) =>
            !entry.isDir &&
            !isArchivedPath(entry.path) &&
            entry.modified !== null &&
            entry.modified < cutoff &&
            !open.has(entry.path) &&
            !pinned.has(entry.path)
        )
        .slice(0, MAX_AUTO_ARCHIVE)
      let moved = 0
      for (const entry of stale) {
        try {
          await api.archiveFile(entry.path)
          moved++
        } catch {
          // A note that can't move is left where it is.
        }
      }
      if (moved > 0) {
        setNotice(`archived ${moved} ${moved === 1 ? 'note' : 'notes'} untouched for ${autoArchiveDays} days`)
        void refreshFolder()
      }
    })()
  }, [restoring, autoArchiveDays, refreshFolder])

  // --- Welcome note ---
  // Offered once, on a first launch with nothing to restore and no notes yet.
  // The flag is set first, so a failure never retries on every launch. See D30.

  const welcomeChecked = useRef(false)
  const { welcomed, markWelcomed } = folder
  useEffect(() => {
    if (restoring || welcomed !== false || welcomeChecked.current) return
    welcomeChecked.current = true
    markWelcomed()
    if (tabsRef.current.tabs.length > 0) return
    api.createWelcomeNote(true).then(
      (path) => {
        if (path) void openPath(path)
      },
      () => {}
    )
  })

  const openWelcome = () => {
    api.createWelcomeNote(false).then(
      (path) => {
        if (path) void openPath(path)
      },
      (err) => setNotice(`couldn't open the welcome note: ${errorMessage(err)}`)
    )
  }

  // --- Commands ---

  const closeOverlay = () => {
    setOverlay(null)
    viewRef.current?.focus()
  }

  const actionsRef = useRef<AppActions | null>(null)
  useEffect(() => {
    actionsRef.current = {
      openPalette: () => setOverlay('palette'),
      openWelcome,
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
      previousTab: () => cycleTab(-1),
      toggleMode: () => {
        if (theme) void folder.setTheme({ ...theme, mode: themeMode === 'dark' ? 'light' : 'dark' })
      },
      openColours: () => setOverlay('colours'),
      openSettings: () => setOverlay('settings'),
      pinActive: (pinned) => {
        const id = tabsRef.current.activeId
        if (id) updateTabs((s) => setPinned(s, id, pinned))
      },
      closeOthers: () => void closeMany(tabsRef.current.activeId),
      closeAll: () => void closeMany(null),
      archiveActive: () => {
        const path = activeTab()?.path
        if (path) void moveArchive(path, false)
      },
      unarchiveActive: () => {
        const path = activeTab()?.path
        if (path) void moveArchive(path, true)
      },
      pinNoteActive: (pinned) => {
        const path = activeTab()?.path
        if (path) setNotePinned(path, pinned)
      },
      openShortcuts: () => setOverlay('shortcuts'),
      // The selected lines become a note of their own (5.7). The file is
      // written at once, since the user asked for a note, not a blank tab.
      selectionToNote: (move) => {
        const view = viewRef.current
        if (!view) return
        const { from, to } = view.state.selection.main
        const text = view.state.sliceDoc(from, to)
        if (text.trim() === '') return
        void (async () => {
          try {
            const dir = await scratchDirRef.current
            const path = await api.createNote(dir)
            await api.writeFile(path, text, NEW_NOTE_META)
            if (move) {
              view.dispatch({ changes: { from, to, insert: '' }, userEvent: 'delete.selection' })
            }
            await openPath(path)
            void refreshFolder()
          } catch (err) {
            setNotice(`couldn't make a note: ${errorMessage(err)}`)
          }
        })()
      },
      renameLabelAtCursor: () => {
        const view = viewRef.current
        const word = view ? labelAt(view.state, view.state.selection.main.head) : null
        if (!word) return
        setRenamingLabel(word)
        setOverlay('renameLabel')
      },
      clearLabelFilter: () => filterByLabel(null),
      openLabels: () => {
        if (viewRef.current) setOverlay('labels')
      },
      openHistory: () => {
        const tab = activeTab()
        if (!tab?.path) return
        void snapshot(tab.id)
        setOverlay('history')
      }
    }
  })

  const keybindings = folder.settings?.keybindings ?? NO_KEYBINDINGS
  setShortcutOverrides(keybindings)
  const pinnedNotesRef = useRef(pinnedNotes)
  pinnedNotesRef.current = pinnedNotes
  const isScratchContext = folder.isScratch
  const commandContext = useCallback((): CommandContext => {
    const tab = activeTab()
    return {
      view: tab ? viewRef.current : null,
      activePath: tab?.path ?? null,
      isScratchContext,
      mode: themeMode,
      activePinned: Boolean(tab?.pinned),
      activeArchived: tab?.path ? isArchivedPath(tab.path) : false,
      activeNotePinned: tab?.path ? pinnedNotesRef.current.includes(tab.path) : false,
      labelAtCursor: viewRef.current ? labelAt(viewRef.current.state, viewRef.current.state.selection.main.head) : null,
      labelFiltered: viewRef.current ? labelFilterOf(viewRef.current.state) !== null : false,
      hasSelection: viewRef.current ? viewRef.current.state.selection.ranges.some((r) => !r.empty) : false,
      tabCount: tabsRef.current.tabs.length,
      actions: actionsRef.current!
    }
  }, [activeTab, isScratchContext, themeMode])

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
  // A conflict has its own bar; its save error would only repeat it.
  const failure = failures.filter((f) => f.message !== CONFLICT_MESSAGE).find((f) => f.tab.id === activeId) ??
    failures.find((f) => f.message !== CONFLICT_MESSAGE)
  const problem = failure
    ? { text: `save failed: ${nameOf(failure.tab)}: ${failure.message}`, error: true }
    : Object.values(saveStates).some((s) => s.kind === 'slow')
      ? { text: 'saving', error: false }
      : null

  // The note header: where the active note lives, when it changed, its length.
  const activeModified = active?.path
    ? (savedAt[active.path] ?? entriesByPath.get(active.path)?.modified ?? null)
    : null
  const activeParent = active?.path ? parentFolder(active.path) : null
  const meta = active
    ? [
        activeParent ? folderName(activeParent) : 'new note',
        ...(activeModified !== null ? [editedLabel(activeModified, Date.now())] : []),
        `${stats.words} ${stats.words === 1 ? 'word' : 'words'}`
      ]
    : []
  const date = active?.path ? noteDate(fileName(active.path), activeModified) : null
  const dismissNotice = useCallback(() => setNotice(null), [])

  const contextName = folder.root ? folderName(folder.root) : ''

  // Bean sits in one spot while a note is open (D42). The tags spot needs the
  // notes column; without it Bean goes back to the dock.
  const beanSpot = catSpot === 'tags' && !treeOpen ? 'dock' : catSpot
  const beanAt = (spot: typeof catSpot) =>
    catOn && active && beanSpot === spot ? <Cat key={spot} mood="awake" className={`cat-spot cat-spot-${spot}`} /> : null

  return (
    <div className="app">
      <TopBar
        tabs={tabs.map((tab) => ({
          id: tab.id,
          name: nameOf(tab),
          failed: saveStates[tab.id]?.kind === 'error' || tab.id in external,
          pinned: Boolean(tab.pinned)
        }))}
        activeId={activeId}
        onActivate={activate}
        onClose={(id) => void close(id)}
        onMove={(id, toIndex) => updateTabs((s) => moveTab(s, id, toIndex))}
        onTabMenu={openTabMenu}
        onFind={() => runById('switcher.open')}
        onNew={() => runById('note.new')}
        findHint={commandHint('switcher.open')}
        findShortcut={formatShortcut('Ctrl+P')}
        newHint={commandHint('note.new')}
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
            tagFilter={tagFilter}
            onTagFilter={setTagFilter}
            onTags={beanAt('tags')}
            pinned={pinnedNotes.map((path) => ({
              path,
              name: fileName(path),
              isDir: false,
              firstLine: openFirstLines.has(path)
                ? openFirstLines.get(path)!
                : (entriesByPath.get(path)?.firstLine ?? null),
              modified: entriesByPath.get(path)?.modified ?? null
            }))}
          />
        )}
        <main
          className={['note-panel', party && 'parrot-party', beanSpot === 'date' && catOn && 'bean-on-date']
            .filter(Boolean)
            .join(' ')}
          onContextMenu={openEditorMenu}
        >
          <div className="note-column">
          {active && (
            <NoteHeader
              meta={meta}
              problem={problem?.text ?? null}
              problemIsError={problem?.error ?? false}
              date={date}
              onDate={beanAt('date')}
            />
          )}
          {active && labelFilters[active.id] && (
            <div className="note-filter" role="status">
              <span>
                Showing lines with{' '}
                <span className="label-pill" style={{ '--tag-hue': tagHue(labelFilters[active.id]!) } as CSSProperties}>
                  {labelFilters[active.id]}
                </span>
              </span>
              <button className="secondary" onClick={() => filterByLabel(null)}>
                Show all
              </button>
            </div>
          )}
          {active && external[active.id] === 'conflict' && (
            <div className="note-conflict" role="alert">
              <span>This note changed on disk while you had unsaved edits.</span>
              <button className="secondary" onClick={() => keepMine(active.id)}>
                Keep mine
              </button>
              <button className="primary" onClick={() => void loadDiskVersion(active.id)}>
                Load disk version
              </button>
            </div>
          )}
          {active && external[active.id] === 'deleted' && (
            <div className="note-conflict" role="status">
              <span>This note was deleted on disk. Typing saves it again.</span>
              <button className="secondary" onClick={() => void close(active.id)}>
                Close
              </button>
            </div>
          )}
          </div>
          {beanAt('corner')}
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
            (restoring ? (
              <div className="editor-blank" />
            ) : (
              <EmptyState onNewNote={() => runById('note.new')} cat={catOn} />
            ))}
          <Dock
            groups={[
              [
                { command: 'tree.toggle', icon: 'notes', pressed: treeOpen },
                { command: 'search.open', icon: 'search' },
                ...(active?.path ? [{ command: 'file.history', icon: 'history' as const }] : []),
                { command: 'file.open', icon: 'open' },
                { command: 'folder.switch', icon: 'folder' }
              ],
              [
                { command: 'settings.open', icon: 'settings' },
                { command: 'palette.open', icon: 'command' }
              ]
            ]}
            onRun={runById}
          >
            {beanAt('dock')}
          </Dock>
          {notice && <Toast text={notice} onDismiss={dismissNotice} />}
        </main>
        {beanAt('top')}
      </div>

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
      {overlay === 'colours' && theme && (
        <ColourMenu
          current={theme.seed}
          onPick={(seed) => {
            closeOverlay()
            folder.setTheme({ ...theme, seed })
          }}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'settings' && theme && folder.settings && (
        <SettingsPanel
          theme={theme}
          fontSize={fontSize}
          scratchDir={folder.scratchDir ?? ''}
          customScratch={folder.settings.scratchDir !== null}
          onTheme={(next) => void folder.setTheme(next)}
          onFontSize={(size) => void folder.persist({ fontSize: size })}
          cat={catOn}
          catSpot={catSpot}
          onCatSpot={(spot) => void folder.persist({ catSpot: spot })}
          labels={folder.settings.labels}
          onLabels={(labels) => void folder.persist({ labels })}
          noteColumns={noteColumns}
          onNoteColumns={(columns) => void folder.persist({ noteColumns: columns })}
          autoArchiveDays={autoArchiveDays}
          onAutoArchiveDays={(days) => void folder.persist({ autoArchiveDays: days })}
          onShortcuts={() => setOverlay('shortcuts')}
          historyUsage={historyUsage}
          onClearHistory={clearHistory}
          onCat={(on) => void folder.persist({ cat: on })}
          onPickScratch={() => void pickScratchDir()}
          onDefaultScratch={() => void changeScratchDir(null)}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'history' && active?.path && (
        <HistoryPanel
          name={nameOf(active)}
          current={currentText(active.id) ?? ''}
          list={listHistory}
          read={readHistory}
          onRestore={restoreVersion}
          onCopy={(text) =>
            navigator.clipboard.writeText(text).then(
              () => setNotice('copied the version'),
              () => setNotice("couldn't copy the version")
            )
          }
          onClose={closeOverlay}
        />
      )}
      {overlay === 'labels' && active && (
        <Picker
          items={labelItems()}
          placeholder={
            (folder.settings?.labels.length ?? 0) > 0 ? 'Label…' : 'Label… (add your usual ones in Settings)'
          }
          ariaLabel="Insert label"
          create={newLabelItem}
          onPick={pickLabel}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'shortcuts' && (
        <ShortcutsPanel
          keybindings={keybindings}
          onChange={(next) => void folder.persist({ keybindings: next })}
          onClose={closeOverlay}
        />
      )}
      {overlay === 'renameLabel' && renamingLabel && (
        <LabelDialog
          label={renamingLabel}
          folderName={contextName}
          inList={(folder.settings?.labels ?? []).some((word) => word.toLowerCase() === renamingLabel.toLowerCase())}
          onSubmit={(request) => void renameLabel(request)}
          onClose={() => {
            setRenamingLabel(null)
            closeOverlay()
          }}
        />
      )}
      {menu && <ContextMenu {...menu} onClose={closeMenu} />}
    </div>
  )
}
