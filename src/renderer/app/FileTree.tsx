import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import type { FolderEntry } from '../../preload/api'
import { tagHue } from '../../shared/tags'
import { Icon } from './Icon'
import { commandHint } from './state/commands'
import { buildTree, relativeTime, sortRecent, type TreeNode } from './state/fileTree'
import { isArchivedPath } from './state/tabs'
import type { Listing } from './useFolderContext'

interface Point {
  x: number
  y: number
}

interface FileTreeProps {
  folderName: string
  isScratch: boolean
  listing: Listing | null // null while the folder is being read
  activePath: string | null
  savedAt: Record<string, number> // saves made this session, by path
  nameOf: (entry: FolderEntry) => string
  onOpen: (path: string) => void
  onOpenFolder: () => void
  onFolderMenu: () => void
  onUseScratch: () => void
  onEntryMenu: (entry: FolderEntry, at: Point) => void
  tagFilter: string | null // lowercased; clicking a tag in a note sets it too
  onTagFilter: (tag: string | null) => void
  pinned: FolderEntry[] // pinned notes, from any folder (4.7)
}

// The scratch folder shows this many recent notes until "Show all".
const RECENT_COUNT = 6

// The hue rides on a custom property; the colour is built in global.css.
const hueStyle = (tag: string) => ({ '--tag-hue': tagHue(tag) }) as CSSProperties

// The left column (D33): a notes panel for the folder context and a tags
// panel below it. The scratch folder opens on its most recent notes; other
// folders show their tree. Toggled with Ctrl+B. App keys this by folder, so
// expansion resets on switch; App owns the tag filter and clears it then too.
export function FileTree({
  folderName,
  isScratch,
  listing,
  activePath,
  savedAt,
  nameOf,
  onOpen,
  onOpenFolder,
  onFolderMenu,
  onUseScratch,
  onEntryMenu,
  tagFilter,
  onTagFilter,
  pinned
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [showAll, setShowAll] = useState(false)
  const order = isScratch ? 'recent' : 'name'

  // Saves made this session are newer than the last folder read.
  const entries = useMemo(
    () =>
      (listing?.entries ?? []).map((entry) => {
        const saved = savedAt[entry.path]
        return saved !== undefined && (entry.modified === null || saved > entry.modified)
          ? { ...entry, modified: saved }
          : entry
      }),
    [listing, savedAt]
  )
  const tree = useMemo(() => (listing ? buildTree(listing.root, entries, order) : []), [listing, entries, order])
  const files = useMemo(() => entries.filter((entry) => !entry.isDir), [entries])
  // Archived notes stay out of the recent list; "Show all" still has them.
  // Pinned notes sit above it instead.
  const pinnedPaths = useMemo(() => new Set(pinned.map((entry) => entry.path)), [pinned])
  const recent = useMemo(
    () =>
      sortRecent(files.filter((file) => !isArchivedPath(file.path) && !pinnedPaths.has(file.path))).slice(
        0,
        RECENT_COUNT
      ),
    [files, pinnedPaths]
  )
  const tags = listing?.tags ?? []
  const activeTag = tags.find((t) => t.tag === tagFilter) ?? null
  const filtered = useMemo(() => {
    if (!activeTag) return null
    const paths = new Set(activeTag.paths)
    const matching = files.filter((file) => paths.has(file.path))
    return order === 'recent' ? sortRecent(matching) : matching
  }, [activeTag, files, order])
  const now = Date.now()
  const collapsible = isScratch && entries.length > recent.length

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const menuFor = (entry: FolderEntry) => (event: MouseEvent) => {
    event.preventDefault()
    onEntryMenu(entry, { x: event.clientX, y: event.clientY })
  }

  const indent = (depth: number) => ({ paddingLeft: `calc(10px + ${depth * 14}px)` })

  const fileRow = (entry: FolderEntry, depth: number) => (
    <button
      className={entry.path === activePath ? 'row active' : 'row'}
      style={indent(depth)}
      title={entry.path}
      onClick={() => onOpen(entry.path)}
      onContextMenu={menuFor(entry)}
    >
      <span className="row-name">{nameOf(entry)}</span>
      {entry.modified !== null && <span className="row-time">{relativeTime(entry.modified, now)}</span>}
    </button>
  )

  const rows = (nodes: TreeNode[], depth: number) => (
    <ul className="rows">
      {nodes.map((node) => {
        const open = expanded.has(node.path)
        return (
          <li key={node.path}>
            {node.isDir ? (
              <button
                className="row folder"
                style={indent(depth)}
                title={node.path}
                aria-expanded={open}
                onClick={() => toggle(node.path)}
                onContextMenu={menuFor(node)}
              >
                <Icon name={open ? 'chevronDown' : 'chevronRight'} size={14} />
                <span className="row-name">{node.name}</span>
              </button>
            ) : (
              fileRow(node, depth)
            )}
            {node.isDir && open && rows(node.children, depth + 1)}
          </li>
        )
      })}
    </ul>
  )

  const flat = (list: FolderEntry[]) => (
    <ul className="rows">
      {list.map((file) => (
        <li key={file.path}>{fileRow(file, 0)}</li>
      ))}
    </ul>
  )

  const header = (
    <div className="panel-head">
      <button className="folder-button" title={commandHint('folder.switch')} onClick={onFolderMenu}>
        <Icon name="folder" size={16} />
        <span className="folder-name">{folderName}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      {!isScratch && (
        <button className="icon-button" title={commandHint('folder.scratch')} onClick={onUseScratch}>
          <Icon name="home" size={16} />
        </button>
      )}
    </div>
  )

  let body
  if (listing?.error) {
    // No usable folder: an invitation, never a blank panel.
    body = (
      <div className="panel-empty">
        <p>Pick a folder to list its notes.</p>
        <button className="pill-button" onClick={onOpenFolder}>
          <Icon name="open" size={16} />
          Open folder
        </button>
      </div>
    )
  } else if (filtered) {
    // Filtered by a tag: a flat list of the files that contain it.
    body = flat(filtered)
  } else if (listing && files.length === 0) {
    body = (
      <div className="panel-empty">
        <p>{isScratch ? 'New notes land here.' : 'Markdown and text files in this folder show up here.'}</p>
      </div>
    )
  } else if (isScratch && !showAll) {
    body = flat(recent)
  } else {
    body = rows(tree, 0)
  }

  return (
    <aside className="sidebar" aria-label="Notes">
      <section className="panel notes-panel">
        {header}
        {activeTag && (
          <button className="filter-chip" title="Show all notes" onClick={() => onTagFilter(null)}>
            <span className="tag-word" style={hueStyle(activeTag.tag)}>
              #{activeTag.tag}
            </span>
            <span className="panel-count">{filtered?.length}</span>
            <Icon name="x" size={14} />
          </button>
        )}
        <div className="panel-scroll">
          {pinned.length > 0 && !activeTag && (
            <div className="pinned-notes">
              <div className="panel-subtitle">
                <Icon name="pin" size={13} />
                <span>Pinned</span>
              </div>
              {flat(pinned)}
            </div>
          )}
          {body}
        </div>
        {!activeTag && collapsible && (
          <button className="show-all" onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show recent' : `Show all · ${files.length}`}
          </button>
        )}
      </section>

      {listing && !listing.error && (
        <section className="panel tags-panel">
          <div className="panel-title">
            <Icon name="tag" size={14} />
            <span>Tags</span>
            <span className="panel-count">{tags.length}</span>
          </div>
          {tags.length === 0 && <p className="panel-hint">Write #word in a note to tag it.</p>}
          <div className="tag-chips">
            {tags.map((tag) => (
              <button
                key={tag.tag}
                className={tag.tag === tagFilter ? 'tag-chip selected' : 'tag-chip'}
                style={hueStyle(tag.tag)}
                aria-pressed={tag.tag === tagFilter}
                onClick={() => onTagFilter(tag.tag === tagFilter ? null : tag.tag)}
              >
                <span className="tag-word">#{tag.tag}</span>
                <span className="tag-count">{tag.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </aside>
  )
}
