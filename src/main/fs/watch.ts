import { watch, type FSWatcher } from 'chokidar'
import { basename } from 'node:path'
import type { WatchEvent } from '../../preload/api'

// External change detection (3.1). One watcher for the folder context, one for
// the open files, so opening a tab never re-scans the folder and closing one
// never un-watches a file the folder still covers. See ARCHITECTURE.md,
// "External changes".

const MAX_DEPTH = 10 // matches listFolder

function ignoredUnder(roots: ReadonlySet<string>) {
  return (path: string) => {
    if (roots.has(path)) return false
    const name = basename(path)
    // Our own atomic writes go through `<name>.tmp`; hidden files and
    // node_modules are never listed either.
    return name.startsWith('.') || name.endsWith('.tmp') || name === 'node_modules'
  }
}

function start(paths: ReadonlySet<string>, depth: number, emit: (event: WatchEvent) => void): FSWatcher {
  const watcher = watch([...paths], {
    ignoreInitial: true,
    depth,
    followSymlinks: false,
    ignored: ignoredUnder(paths),
    // Sync tools write in pieces; report once the file has settled.
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
    // Editors and our own writes replace files by rename; report a change.
    atomic: true
  })
  watcher
    .on('add', (path) => emit({ type: 'add', path }))
    .on('change', (path) => emit({ type: 'change', path }))
    .on('unlink', (path) => emit({ type: 'unlink', path }))
    .on('addDir', (path) => emit({ type: 'add', path }))
    .on('unlinkDir', (path) => emit({ type: 'unlink', path }))
    // A folder that vanished or a watch limit reached: the app keeps working,
    // it just stops hearing about changes there.
    .on('error', () => {})
  return watcher
}

const sameSet = (a: ReadonlySet<string>, b: ReadonlySet<string>) => a.size === b.size && [...a].every((p) => b.has(p))

export class PathWatcher {
  private folder: string | null = null
  private folderWatcher: FSWatcher | null = null
  private files: ReadonlySet<string> = new Set()
  private fileWatcher: FSWatcher | null = null
  private readonly emit: (event: WatchEvent) => void

  constructor(emit: (event: WatchEvent) => void) {
    this.emit = emit
  }

  set(folder: string | null, files: readonly string[]): void {
    if (folder !== this.folder) {
      void this.folderWatcher?.close()
      this.folder = folder
      this.folderWatcher = folder ? start(new Set([folder]), MAX_DEPTH, this.emit) : null
    }
    const next = new Set(files)
    if (!sameSet(next, this.files)) {
      void this.fileWatcher?.close()
      this.files = next
      this.fileWatcher = next.size > 0 ? start(next, 0, this.emit) : null
    }
  }

  close(): void {
    void this.folderWatcher?.close()
    void this.fileWatcher?.close()
    this.folderWatcher = null
    this.fileWatcher = null
    this.folder = null
    this.files = new Set()
  }
}
