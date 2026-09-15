import { useMemo, useState, type CSSProperties } from 'react'
import type { FolderEntry } from '../../preload/api'
import { tagHue } from '../../shared/tags'
import { buildTree, type TreeNode } from './state/fileTree'
import type { Listing } from './useFolderContext'

interface FileTreeProps {
  folderName: string
  isScratch: boolean
  listing: Listing | null // null while the folder is being read
  activePath: string | null
  nameOf: (entry: FolderEntry) => string
  onOpen: (path: string) => void
  onOpenFolder: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

// The hue rides on a custom property; the pill colour is built in global.css.
const pillStyle = (tag: string) => ({ '--tag-hue': tagHue(tag) }) as CSSProperties

// The folder context as a tree, with the tag index below it. Toggled with
// Ctrl+B. Never has texture behind it. See DESIGN.md, "File tree".
// App keys this by folder, so expansion and the tag filter reset on switch.
export function FileTree({ folderName, isScratch, listing, activePath, nameOf, onOpen, onOpenFolder }: FileTreeProps) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const tree = useMemo(() => (listing ? buildTree(listing.root, listing.entries) : []), [listing])
  const files = useMemo(() => listing?.entries.filter((entry) => !entry.isDir) ?? [], [listing])
  const tags = listing?.tags ?? []
  const activeTag = tags.find((t) => t.tag === tagFilter) ?? null
  const filtered = useMemo(() => {
    if (!activeTag) return null
    const paths = new Set(activeTag.paths)
    return files.filter((file) => paths.has(file.path))
  }, [activeTag, files])

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const fileRow = (entry: FolderEntry, depth: number) => (
    <button
      className={entry.path === activePath ? 'tree-row active' : 'tree-row'}
      style={{ paddingLeft: `calc(12px + ${depth * 2}ch)` }}
      title={entry.path}
      onClick={() => onOpen(entry.path)}
    >
      <span className="tree-caret" />
      <span className="tree-name">{nameOf(entry)}</span>
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
