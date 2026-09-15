// Folder context helpers: recents and folder names. Pure; the hook that holds
// the state is useFolderContext.ts.

export const MAX_RECENT_FOLDERS = 8

// Most recent first, no duplicates.
export function withRecent(recents: readonly string[], path: string, max = MAX_RECENT_FOLDERS): string[] {
  return [path, ...recents.filter((p) => p !== path)].slice(0, max)
}

export function folderName(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || path
}
