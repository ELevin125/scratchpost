import { useMemo, useState } from 'react'
import type { FolderEntry } from '../../preload/api'
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

// The folder context as a tree. Toggled with Ctrl+B. Tags join it in 2.8.
// Never has texture behind it. See DESIGN.md, "File tree".
export function FileTree({ folderName, isScratch, listing, activePath, nameOf, onOpen, onOpenFolder }: FileTreeProps) {
  // Folders start collapsed; expansion is per session and resets with the folder.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const tree = useMemo(() => (listing ? buildTree(listing.root, listing.entries) : []), [listing])
  const fileCount = listing ? listing.entries.filter((entry) => !entry.isDir).length : 0

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const rows = (nodes: TreeNode[], depth: number) => (
    <ul className="tree-list">
      {nodes.map((node) => {
        const open = expanded.has(node.path)
        return (
          <li key={node.path}>
            <button
              className={node.path === activePath ? 'tree-row active' : 'tree-row'}
              style={{ paddingLeft: `calc(12px + ${depth * 2}ch)` }}
              title={node.path}
              aria-expanded={node.isDir ? open : undefined}
              onClick={() => (node.isDir ? toggle(node.path) : onOpen(node.path))}
            >
              <span className="tree-caret">{node.isDir ? (open ? '▾' : '▸') : ''}</span>
              <span className="tree-name">{node.isDir ? node.name : nameOf(node)}</span>
            </button>
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
    <aside className="file-tree" key={listing?.root} aria-label="Files">
      <div className="tree-section">
        <span>Notes</span>
        <span className="tree-count">{pad(fileCount)}</span>
      </div>
      {listing && fileCount === 0 ? (
        <div className="tree-empty">
          <div className="tree-folder">{folderName}</div>
          <p>{isScratch ? 'New notes land here.' : 'Markdown and text files in this folder show up here.'}</p>
        </div>
      ) : (
        rows(tree, 0)
      )}
    </aside>
  )
}
