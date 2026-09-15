import { useCallback, useEffect, useRef, useState } from 'react'
import type { FolderEntry, Settings } from '../../preload/api'
import { errorMessage } from './state/autosave'
import { folderName, withRecent } from './state/folderContext'

const api = window.scratchpost

export interface Listing {
  root: string
  entries: FolderEntry[]
  error: string | null // the folder couldn't be listed
}

// The folder context: which folder the file tree and quick switcher list.
// Defaults to the scratch folder and never touches open tabs. See DESIGN.md,
// "Folder context", and D25.
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
    api.getSettings().then(apply, () => apply({ folderContext: null, recentFolders: [] }))
  }, [scratchDirPromise])

  const persist = useCallback((next: Settings) => {
    settingsRef.current = next
    setSettings(next)
    api.setSettings(next).catch(() => {}) // a lost write costs a remembered folder, never content
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

  const root = settings ? (settings.folderContext ?? scratchDir) : null

  const refresh = useCallback(async () => {
    if (!root) return
    try {
      const entries = await api.listFolder(root)
      setListing({ root, entries, error: null })
    } catch (err) {
      const current = settingsRef.current
      if (current?.folderContext === root) {
        // A remembered folder that's gone: fall back to the scratch folder.
        noticeRef.current(`folder not found: ${folderName(root)}`)
        persist({ folderContext: null, recentFolders: current.recentFolders.filter((p) => p !== root) })
      } else {
        setListing({ root, entries: [], error: errorMessage(err) })
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
    // A listing for a previous folder is never shown for the current one.
    listing: listing?.root === root ? listing : null,
    switchTo,
    refresh
  }
}
