// Folder context helpers: recents and folder names. Pure; the hook that holds
// the state is useFolderContext.ts.

export const MAX_RECENT_FOLDERS = 8

// Most recent first, no duplicates.
export function withRecent(recents: readonly string[], path: string, max = MAX_RECENT_FOLDERS): string[] {
  return [path, ...recents.filter((p) => p !== path)].slice(0, max)
}

const trimSeparators = (path: string) => path.replace(/[\\/]+$/, '')

export function folderName(path: string): string {
  return trimSeparators(path).split(/[\\/]/).pop() || path
}

// The folder above, or null at a filesystem root ("/", "C:\").
export function parentFolder(path: string): string | null {
  const trimmed = trimSeparators(path)
  const cut = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'))
  if (cut < 0) return null
  const parent = trimmed.slice(0, cut)
  if (parent === '') return '/'
  if (/^[A-Za-z]:$/.test(parent)) return `${parent}\\`
  return parent
}

// The status bar's folder label: the last two segments, "Documents/Scratchpost".
export function shortPath(path: string): string {
  const parts = trimSeparators(path).split(/[\\/]/).filter(Boolean)
  return parts.slice(-2).join('/') || path
}
