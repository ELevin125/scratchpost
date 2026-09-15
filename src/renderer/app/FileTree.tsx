import { useMemo, useState, type CSSProperties, type MouseEvent } from 'react'
import type { FolderEntry } from '../../preload/api'
import { tagHue } from '../../shared/tags'
import { commandHint } from './state/commands'
import { buildTree, relativeTime, sortRecent, type TreeNode } from './state/fileTree'
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
}

const pad = (n: number) => String(n).padStart(2, '0')

// The hue rides on a custom property; the pill colour is built in global.css.
const pillStyle = (tag: string) => ({ '--tag-hue': tagHue(tag) }) as CSSProperties

// The folder context as a tree, with the tag index below it. Toggled with
// Ctrl+B. Never has texture behind it. See DESIGN.md, "File tree", and D29.
// App keys this by folder, so expansion and the tag filter reset on switch.
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
  onEntryMenu
}: FileTreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [tagFilter, setTagFilter] = useState<string | null>(null)
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
  const tags = listing?.tags ?? []
  const activeTag = tags.find((t) => t.tag === tagFilter) ?? null
  const filtered = useMemo(() => {
    if (!activeTag) return null
    const paths = new Set(activeTag.paths)
    const matching = files.filter((file) => paths.has(file.path))
    return order === 'recent' ? sortRecent(matching) : matching
  }, [activeTag, files, order])
  const now = Date.now()

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

  const header = (
    <div className="tree-header">
      <button className="tree-folder-button" title={commandHint('folder.switch')} onClick={onFolderMenu}>
        {folderName} ▾
      </button>
      {!isScratch && (
        <button className="tree-home" title={commandHint('folder.scratch')} onClick={onUseScratch}>
          ← Scratch
        </button>
      )}
    </div>
  )

  const fileRow = (entry: FolderEntry, depth: number) => (
    <button
      className={entry.path === activePath ? 'tree-row active' : 'tree-row'}
      style={{ paddingLeft: `calc(12px + ${depth * 2}ch)` }}
      title={entry.path}
      onClick={() => onOpen(entry.path)}
      onContextMenu={menuFor(entry)}
    >
      <span className="tree-caret" />
      <span className="tree-name">{nameOf(entry)}</span>
      {entry.modified !== null && <span className="tree-time">{relativeTime(entry.modified, now)}</span>}
    </button>
  )

  const rows = (nodes: TreeNode[], depth: number) => (
    <ul className="tree-list">
      {nodes.map((node) => {
        const open = expanded.has(node.path)
        return (
          <li key={node.path}>
            {node.isDir ? (
              <button
                className="tree-row"
                style={{ paddingLeft: `calc(12px + ${depth * 2}ch)` }}
                title={node.path}
                aria-expanded={open}
                onClick={() => toggle(node.path)}
                onContextMenu={menuFor(node)}
              >
                <span className="tree-caret">{open ? '▾' : '▸'}</span>
                <span className="tree-name">{node.name}</span>
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

  if (listing?.error) {
    // No usable folder: an invitation, never a blank panel.
    return (
      <aside className="file-tree" aria-label="Files">
        {header}
        <div className="tree-empty">
          <p>Pick a folder to list its notes.</p>
          <button className="tree-button" onClick={onOpenFolder}>
            Open folder
          </button>
        </div>
      </aside>
    )
  }

  return (
    <aside className="file-tree" aria-label="Files">
      {header}
      <div className="tree-section">
        <span>Notes</span>
        {activeTag && (
          <button className="tree-clear" title="Show all notes" onClick={() => setTagFilter(null)}>
            <span className="tag-pill" style={pillStyle(activeTag.tag)}>
              {activeTag.tag}
            </span>{' '}
            ×
          </button>
        )}
        <span className="tree-count">{pad(filtered ? filtered.length : files.length)}</span>
      </div>

      {filtered ? (
        // Filtered by a tag: a flat list of the files that contain it.
        <ul className="tree-list">
          {filtered.map((file) => (
            <li key={file.path}>{fileRow(file, 0)}</li>
          ))}
        </ul>
      ) : listing && files.length === 0 ? (
        <div className="tree-empty">
          <div className="tree-folder">{folderName}</div>
          <p>{isScratch ? 'New notes land here.' : 'Markdown and text files in this folder show up here.'}</p>
        </div>
      ) : (
        rows(tree, 0)
      )}

      {tags.length > 0 && (
        <>
          <div className="tree-section tree-section-tags">
            <span>Tags</span>
            <span className="tree-count">{pad(tags.length)}</span>
          </div>
          <ul className="tree-list">
            {tags.map((tag) => (
              <li key={tag.tag}>
                <button
                  className={tag.tag === tagFilter ? 'tree-row selected' : 'tree-row'}
                  aria-pressed={tag.tag === tagFilter}
                  onClick={() => setTagFilter((current) => (current === tag.tag ? null : tag.tag))}
                >
                  <span className="tree-caret" />
                  <span className="tag-pill" style={pillStyle(tag.tag)}>
                    {tag.tag}
                  </span>
                  <span className="tree-tag-count">{tag.count}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  )
}
