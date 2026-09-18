import { useCallback, useEffect, useRef, useState } from 'react'
import type { FolderEntry, Settings, TagSummary } from '../../preload/api'
import { errorMessage } from './state/autosave'
import { folderName, withRecent } from './state/folderContext'

const api = window.scratchpost

export interface Listing {
  root: string
  entries: FolderEntry[]
  tags: TagSummary[]
  error: string | null // the folder couldn't be listed
}

const DEFAULT_SETTINGS: Settings = {
  folderContext: null,
  recentFolders: [],
  welcomed: false,
  theme: { seed: 172, mode: 'dark' },
  scratchDir: null,
  fontSize: 13,
  cat: true,
  catSpot: 'dock',
  keybindings: {},
  labels: [],
  autoArchiveDays: 0,
  pinnedNotes: []
}

// The folder context: which folder the file tree, quick switcher, search and
// tag index cover. Defaults to the scratch folder and never touches open tabs.
// Also owns settings.json for now, since the folder is most of it. See
// DESIGN.md, "Folder context", and D25.
export function useFolderContext(scratchDirPromise: Promise<string>, onNotice: (message: string) => void) {
  const [scratchDir, setScratchDir] = useState<string | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [listing, setListing] = useState<Listing | null>(null)
  const settingsRef = useRef<Settings | null>(null)
  const noticeRef = useRef(onNotice)

  useEffect(() => {
    noticeRef.current = onNotice
  })

  useEffect(() => {
    scratchDirPromise.then(setScratchDir, () => {})
    const apply = (loaded: Settings) => {
      settingsRef.current = loaded
      setSettings(loaded)
    }
    api.getSettings().then(apply, () => apply(DEFAULT_SETTINGS))
  }, [scratchDirPromise])

  // Every write keeps the fields it isn't changing. Writes run one at a time,
  // each saving the latest settings, so dragging the hue slider can't race.
  // Resolves once the change is on disk.
  const writes = useRef<Promise<void>>(Promise.resolve())
  const written = useRef<Settings | null>(null)
  const persist = useCallback((change: Partial<Settings>): Promise<void> => {
    const current = settingsRef.current
    if (!current) return writes.current
    const next = { ...current, ...change }
    settingsRef.current = next
    setSettings(next)
    writes.current = writes.current
      .then(() => {
        const latest = settingsRef.current
        if (!latest || latest === written.current) return
        written.current = latest
        return api.setSettings(latest)
      })
      .catch(() => {}) // a lost write costs a preference, never content
    return writes.current
  }, [])

  // null switches back to the scratch folder.
  const switchTo = useCallback(
    (path: string | null) => {
      const current = settingsRef.current
      if (!current) return
      persist({
        folderContext: path,
        recentFolders: path ? withRecent(current.recentFolders, path) : current.recentFolders
      })
    },
    [persist]
  )

  const markWelcomed = useCallback(() => {
    if (settingsRef.current && !settingsRef.current.welcomed) persist({ welcomed: true })
  }, [persist])

  const root = settings ? (settings.folderContext ?? scratchDir) : null

  const refresh = useCallback(async () => {
    if (!root) return
    try {
      const [entries, tags] = await Promise.all([
        api.listFolder(root),
        // The tag index is a nicety; a failure there never hides the files.
        api.listTags(root).catch((): TagSummary[] => [])
      ])
      setListing({ root, entries, tags, error: null })
    } catch (err) {
      const current = settingsRef.current
      if (current?.folderContext === root) {
        // A remembered folder that's gone: fall back to the scratch folder.
        noticeRef.current(`folder not found: ${folderName(root)}`)
        persist({ folderContext: null, recentFolders: current.recentFolders.filter((p) => p !== root) })
      } else {
        setListing({ root, entries: [], tags: [], error: errorMessage(err) })
      }
    }
  }, [root, persist])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    root,
    scratchDir,
    isScratch: settings !== null && settings.folderContext === null,
    recentFolders: settings?.recentFolders ?? [],
    welcomed: settings ? settings.welcomed : null, // null until settings load
    settings, // null until settings load
    theme: settings?.theme ?? null, // null until settings load
    setTheme: (theme: Settings['theme']) => persist({ theme }),
    persist,
    // A listing for a previous folder is never shown for the current one.
    listing: listing?.root === root ? listing : null,
    switchTo,
    markWelcomed,
    refresh
  }
}
