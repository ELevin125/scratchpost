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

export interface Session {
  tabs: { path: string; cursor: number; scroll: number }[]
  activeIndex: number
}

export interface ScratchpostAPI {
  readFile(path: string): Promise<FilePayload>
  writeFile(path: string, content: string, meta: FileMeta): Promise<void>
  getScratchDir(): Promise<string>
  createNote(scratchDir: string): Promise<string>
  renameFile(from: string, to: string): Promise<void>
  listFolder(path: string): Promise<FolderEntry[]>
  searchFolder(path: string, query: string): Promise<SearchHit[]>
  pickFolder(): Promise<string | null>
  pickFile(): Promise<string | null>
  watchFolder(path: string, cb: (e: WatchEvent) => void): () => void
  getSession(): Promise<Session>
  setSession(s: Session): Promise<void>
  openExternal(url: string): Promise<void>
  // Main waits for flush to settle (max 2s) before closing the window or quitting.
  onBeforeClose(flush: () => Promise<void>): () => void
}
