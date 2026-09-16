import type { FolderEntry } from '../../../preload/api'

export interface TreeNode extends FolderEntry {
  children: TreeNode[]
}

// 'recent' is the scratch folder's order: folders first by name, then notes
// newest first. Every other folder keeps name order. See D29.
export type TreeOrder = 'name' | 'recent'

const normalise = (p: string) => p.replace(/\\/g, '/').replace(/\/+$/, '')
const parentOf = (p: string) => normalise(p).replace(/\/[^/]*$/, '')

// Stable sort: folders keep their name order, notes with equal times too.
function byRecent(a: FolderEntry, b: FolderEntry): number {
  if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
  if (a.isDir) return 0
  return (b.modified ?? 0) - (a.modified ?? 0)
}

export function sortRecent<T extends FolderEntry>(entries: readonly T[]): T[] {
  return [...entries].sort(byRecent)
}

function sortNodes(nodes: TreeNode[]): void {
  nodes.sort(byRecent)
  for (const node of nodes) sortNodes(node.children)
}

// Nests a flat walk into a tree. listFolder lists every folder before its
// contents, so a parent always exists by the time its children arrive.
export function buildTree(root: string, entries: readonly FolderEntry[], order: TreeOrder = 'name'): TreeNode[] {
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
  if (order === 'recent') sortNodes(top)
  return top
}

// Path shown in the quick switcher, always with forward slashes.
export function relativePath(path: string, root: string): string {
  const p = normalise(path)
  const r = normalise(root)
  return p.startsWith(r + '/') ? p.slice(r.length + 1) : p
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// The faint time beside a note in the tree: now, 5m, 3h, Mon, 12 Sep, 2025.
export function relativeTime(ms: number, now: number): string {
  const diff = now - ms
  if (diff < MINUTE) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  const date = new Date(ms)
  if (diff < 6 * DAY) return WEEKDAYS[date.getDay()]
  if (date.getFullYear() === new Date(now).getFullYear()) return `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return String(date.getFullYear())
}

// The note header's edited time: "edited just now", "edited 5m ago",
// "edited Tue", "edited 12 Sep".
export function editedLabel(ms: number, now: number): string {
  const time = relativeTime(ms, now)
  if (time === 'now') return 'edited just now'
  return /^\d+[mh]$/.test(time) ? `edited ${time} ago` : `edited ${time}`
}

const TIMESTAMP_NAME = /^(\d{4})-(\d{2})-(\d{2})-\d{4}(?:-\d+)?\.md$/

// The date shown large above a note: the day a timestamp-named note was
// created, otherwise the day it was last changed.
export function noteDate(name: string, modified: number | null): { month: string; weekday: string; day: number } | null {
  const match = TIMESTAMP_NAME.exec(name)
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    : modified !== null
      ? new Date(modified)
      : null
  if (!date || Number.isNaN(date.getTime())) return null
  return {
    month: MONTHS[date.getMonth()].toUpperCase(),
    weekday: WEEKDAYS[date.getDay()].toUpperCase(),
    day: date.getDate()
  }
}
