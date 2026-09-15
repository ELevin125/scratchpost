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
}

export interface SearchHit {
  path: string
  line: number
  text: string
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
  listFolder(path: string): Promise<FolderEntry[]> // recursive walk; see D25
  searchFolder(path: string, query: string): Promise<SearchHit[]>
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
