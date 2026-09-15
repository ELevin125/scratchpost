import type { FolderEntry } from '../../../preload/api'

export interface TreeNode extends FolderEntry {
  children: TreeNode[]
}

const normalise = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const parentOf = (p: string) => normalise(p).replace(/\/[^/]*$/, '')

// Nests a flat walk into a tree. listFolder lists every folder before its
// contents, so a parent always exists by the time its children arrive.
export function buildTree(root: string, entries: readonly FolderEntry[]): TreeNode[] {
  const top: TreeNode[] = []
  const folders = new Map<string, TreeNode>()
  const rootKey = normalise(root)

  for (const entry of entries) {
    const node: TreeNode = { ...entry, children: [] }
    const parent = parentOf(entry.path)
    const siblings = parent === rootKey ? top : folders.get(parent)?.children
    if (!siblings) continue
    siblings.push(node)
    if (entry.isDir) folders.set(normalise(entry.path), node)
  }
  return top
}

// Path shown in the quick switcher, always with forward slashes.
export function relativePath(path: string, root: string): string {
  const p = normalise(path)
  const r = normalise(root)
  return p.startsWith(r + '/') ? p.slice(r.length + 1) : p
}
