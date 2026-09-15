// The typed API shape, shared by preload and renderer. See docs/ARCHITECTURE.md.

export interface FileMeta {
  eol: '\n' | '\r\n'
  bom: boolean
  encoding: 'utf8'
}

export interface FilePayload {
  content: string
  meta: FileMeta
}

export interface FolderEntry {
  path: string
  name: string
  isDir: boolean
  // First non-blank line of a .md or .txt file, for display names. Null for
  // folders and unreadable files.
  firstLine: string | null
  modified: number | null // mtime in ms; null for folders and unreadable files
}

export interface SearchHit {
  path: string
  line: number // 1-based
  text: string // the whole line, capped at 300 characters
}

export interface TagSummary {
  tag: string // lowercased; tags are case-insensitive
  count: number // occurrences, not files
  paths: string[] // files containing it
}

export interface WatchEvent {
  type: 'change' | 'add' | 'unlink'
  path: string
}

// Stored as session.json in userData. Never holds note content.
export interface Session {
  // cursor and scroll are document positions; scroll is the start of the top
  // visible line, so it survives a different window size.
  tabs: { path: string; cursor: number; scroll: number }[]
  activeIndex: number // -1 when the active tab wasn't saved
}

// Stored as settings.json in userData. The settings UI (3.4) adds fields.
export interface Settings {
  folderContext: string | null // null means the scratch folder
  recentFolders: string[] // most recent first, at most 8
}

export interface ScratchpostAPI {
  readFile(path: string): Promise<FilePayload>
  writeFile(path: string, content: string, meta: FileMeta): Promise<void>
  getScratchDir(): Promise<string>
  createNote(scratchDir: string): Promise<string>
  renameFile(from: string, to: string): Promise<void> // same folder, never overwrites
  deleteIfEmpty(path: string): Promise<boolean> // scratch folder only; see D23
  trashFile(path: string): Promise<void> // .md and .txt files only, to the OS trash; see D29
  showInFolder(path: string): Promise<void> // reveal in the file manager
  listFolder(path: string): Promise<FolderEntry[]> // recursive walk; see D25
  searchFolder(path: string, query: string): Promise<SearchHit[]> // see D27
  listTags(path: string): Promise<TagSummary[]> // tag index; see D27
  pickFolder(): Promise<string | null>
  pickFile(): Promise<string | null>
  watchFolder(path: string, cb: (e: WatchEvent) => void): () => void
  getSession(): Promise<Session>
  setSession(s: Session): Promise<void>
  getSettings(): Promise<Settings>
  setSettings(s: Settings): Promise<void>
  openExternal(url: string): Promise<void>
  // Main waits for flush to settle (max 2s) before closing the window or quitting.
  onBeforeClose(flush: () => Promise<void>): () => void
}
