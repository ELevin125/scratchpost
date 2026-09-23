# Architecture

## Three layers

```
┌─────────────────────────────────────────────────┐
│  main/          Electron main process           │
│                 Owns: disk, OS, windows         │
│                 Knows nothing about markdown    │
├─────────────────────────────────────────────────┤
│  preload/       contextBridge surface           │
│                 Typed, narrow, no raw fs        │
├─────────────────────────────────────────────────┤
│  renderer/      App shell + editor              │
│    app/         Tabs, session, autosave,        │
│                 palette, switcher, search UI    │
│    editor/      CodeMirror extensions           │
│    themes/      Theme generation               │
└─────────────────────────────────────────────────┘
```

The boundary that matters: **main holds no document state**. It reads bytes,
writes bytes, lists directories, and watches files. All knowledge of buffers,
tabs, cursors and markdown lives in the renderer.

## Security posture

Non-negotiable, and the reason Electron is acceptable here:

```js
webPreferences: {
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true,
}
```

- The renderer never gets `fs`, `path`, `child_process`, or `ipcRenderer`
  directly. It gets the typed API defined in `preload/`.
- **No remote content is ever loaded.** No CDN fonts, no analytics, no update
  pings, no `<img src="http...">`. Fonts are bundled.
- A Content-Security-Policy header is set that disallows remote origins
  entirely.
- `will-navigate` and `setWindowOpenHandler` are blocked; external links open in
  the system browser via `shell.openExternal` after an explicit user click.

If a task appears to require loading something remote, stop and ask.

## Directory layout

```
src/
  main/
    index.ts              app lifecycle, window creation
    window.ts             window state persistence (size, position, maximised)
    ipc.ts                handler registration, one place
    session.ts            session.json read, validation and atomic write
    settings.ts           settings.json read, validation and atomic write
    external.ts           which links may open in the system browser
    launch.ts             single instance, command-line and dropped paths (D32)
    welcome.md            the welcome note's text, the in-app tutorial (D30)
    fs/
      read.ts             readFile with encoding + EOL + BOM detection
      write.ts            atomic write, preserving EOL and BOM
      list.ts             directory walk for tree and switcher
      scan.ts             batched text reads for search and the tag index
      search.ts           folder-wide content search
      tags.ts             tag index for the file tree
      welcome.ts          writes welcome.md into the scratch folder
      watch.ts            chokidar watchers for the folder context and open files (D35)
  preload/
    index.ts              contextBridge exposure
    api.ts                the typed API shape, shared with renderer
  shared/
    tags.ts               label and tag patterns and hue, used by editor and main
  renderer/
    main.tsx              mount
    app/
      TopBar.tsx          open-note pills, find field, new note (D33)
      FileTree.tsx        notes panel and tags panel
      NoteHeader.tsx      folder, edited time, words, save problems, date
      Dock.tsx            floating tool buttons, from the command registry
      Toast.tsx           notices that aren't about saving
      Icon.tsx            the one icon set
      Cat.tsx             the mascot: drawing, idle loop, random bits (D37)
      CommandPalette.tsx
      QuickSwitcher.tsx
      FolderMenu.tsx      scratch folder, recents, open folder
      ColourMenu.tsx      theme seed hues
      SettingsPanel.tsx   mode, colour, note text size, scratch folder (3.4)
      Picker.tsx          shared overlay behind palette, switcher and menus
      SearchPanel.tsx
      EmptyState.tsx
      RenameDialog.tsx    F2 rename input
      ContextMenu.tsx     right-click menus for pills and panel rows
      App.tsx             layout, shortcut listener, overlays
      Editor.tsx          mounts the EditorView into React
      useFolderContext.ts folder context, settings (incl. theme) and listing state
      state/
        tabs.ts           tab model, open/close/reorder/activate
        session.ts        session.json load and persist
        autosave.ts       the debounce + flush scheduler
        folderContext.ts  recents and folder names
        fileTree.ts       nests the folder walk into a tree
        commands.ts       command registry (id, label, shortcut, run, when)
        shortcuts.ts      shortcut matching and display
        fuzzy.ts          fuzzy filter for the palette and quick switcher
        searchHits.ts     groups search results, places the selection on a hit
    editor/
      createEditor.ts     assembles the EditorView
      livePreview.ts      ViewPlugin: walks visible ranges, dispatches to the two below
      blocks.ts           headings, lists, block quotes, fenced code, rules
      inline.ts           emphasis, strong, strikethrough, inline code, links
      decorations.ts      shared reveal logic and helpers
      checkbox.ts         checkbox widget and toggle
      tags.ts             [label] pills and #tag words (D34)
      lists.ts            Enter continuation, Tab indent and outdent
      renumber.ts         keeps numbered lists counting up after edits
      typing.ts           auto-closing pairs, pasting a URL as a link (D32)
      codeLanguages.ts    bundled languages and classes for code highlighting
      keymap.ts           bindings, sourced from the command registry
      theme.ts            CM6 theme built from theme tokens
    themes/
      types.ts            the Theme type
      tint.ts             generates a theme from a seed hue and a mode (D33)
      index.ts            named seeds, defaults, CSS var application
```

## The command registry

Every user-triggerable action is registered once in
`renderer/app/state/commands.ts` as `{ id, label, shortcut?, run, when? }`.

The command palette, the keymap, the dock, the top bar, the panels and the
right-click menus all read from this registry. Nothing binds a key or wires a button directly.

This is what mechanically enforces the "every command has a visible affordance"
principle from `DESIGN.md`. A new command added to the registry appears in the
palette automatically; a command added anywhere else is a bug.

## IPC surface

Keep this small. Every addition is a widening of the trust boundary.

```ts
interface ScratchpostAPI {
  readFile(path: string): Promise<FilePayload>
  writeFile(path: string, content: string, meta: FileMeta): Promise<void>
  getScratchDir(): Promise<string>
  createNote(scratchDir: string): Promise<string>
  createWelcomeNote(onlyIfEmpty: boolean): Promise<string | null> // tutorial note; see D30
  renameFile(from: string, to: string): Promise<void> // same folder, never overwrites
  deleteIfEmpty(path: string): Promise<boolean> // scratch folder only; see D23
  trashFile(path: string): Promise<void> // .md and .txt files only, to the OS trash; see D29
  archiveFile(path: string): Promise<string> // into ./archive, returns the new path; see D36
  unarchiveFile(path: string): Promise<string> // back out of ./archive
  renameLabel(folder: string, from: string, to: string): Promise<LabelRename> // every note; see D44
  historySnapshot(path: string, text: string): Promise<void> // local versions; see D38
  historyList(path: string): Promise<HistoryEntry[]> // newest first
  historyRead(path: string, id: string): Promise<string>
  historyUsage(): Promise<HistoryUsage> // size of the store, for Settings (5.10)
  historyClear(): Promise<void> // deletes every version; notes are untouched
  showInFolder(path: string): Promise<void> // reveal in the file manager
  listFolder(path: string): Promise<FolderEntry[]> // recursive walk; see D25
  searchFolder(path: string, query: string): Promise<SearchHit[]> // see D27
  listTags(path: string): Promise<TagSummary[]> // tag index; see D27
  pickFolder(): Promise<string | null>
  pickFile(): Promise<string | null>
  pathForFile(file: File): string // a dropped file's path, via webUtils
  resolvePaths(paths: string[]): Promise<OpenRequest> // sorts dropped paths; see D32
  // Command-line, "Open with" and second-launch paths. Subscribing marks the
  // renderer ready; earlier requests are delivered then.
  onOpenPaths(cb: (request: OpenRequest) => void): () => void
  // Replaces what this window watches: the folder context and the open files.
  watch(folder: string | null, files: string[]): Promise<void>
  onWatchEvent(cb: (e: WatchEvent) => void): () => void // see D35
  getSession(): Promise<Session>
  setSession(s: Session): Promise<void>
  getSettings(): Promise<Settings>
  setSettings(s: Settings): Promise<void>
  openExternal(url: string): Promise<void>
  // Main waits for flush to settle (max 2s) before closing the window or quitting.
  onBeforeClose(flush: () => Promise<void>): () => void
}

interface FileMeta {
  eol: '\n' | '\r\n'
  bom: boolean
  encoding: 'utf8'
}

interface FilePayload { content: string; meta: FileMeta }
interface FolderEntry {
  path: string
  name: string
  isDir: boolean
  firstLine: string | null // first non-blank line of a note, for display names
  modified: number | null // mtime in ms, for recent-first order and tree times
}
interface Settings {
  folderContext: string | null // null means the scratch folder
  recentFolders: string[] // most recent first, at most 8
  welcomed: boolean // the welcome note has been offered; see D30
  theme: { seed: number; mode: 'light' | 'dark' | 'system' } // see D33
  scratchDir: string | null // null means ~/Documents/Scratchpost
  fontSize: number // note text in px, 10 to 24
  cat: boolean // the mascot, on by default; see D37
  catSpot: 'dock' | 'top' | 'date' | 'corner' | 'tags' // where Bean sits (D42)
  keybindings: Record<string, string> // rebound shortcuts, '' for none (D41)
  labels: string[] // the label picker's own list (4.10)
  noteColumns: number // characters a line: 80, 100, or 999 for full width (D46)
  autoArchiveDays: number // 0, 30, 90 or 365; archive old scratch notes at launch (D45)
  pinnedNotes: string[] // absolute paths, atop the notes panel (4.7)
}
interface OpenRequest {
  files: string[] // open as tabs
  folders: string[] // the last becomes the folder context
  skipped: string[] // binary files (a NUL in the first 8 KB), never opened
}
interface SearchHit { path: string; line: number; text: string } // line is 1-based
interface TagSummary { tag: string; count: number; paths: string[] } // tag lowercased
interface WatchEvent { type: 'change' | 'add' | 'unlink'; path: string }
interface Session {
  // cursor and scroll are document positions; scroll is the start of the top
  // visible line, so it survives a different window size.
  tabs: { path: string; cursor: number; scroll: number; pinned?: boolean }[]
  activeIndex: number // -1 when the active tab wasn't saved
}
```

The API is exposed on `window.scratchpost`. The source of truth for these
types is `src/preload/api.ts`.

`FileMeta` travels with the file from read to write. This is how line endings
and BOMs survive a round trip between Linux and Windows — see `DESIGN.md`
principle 5. Do not normalise.

## Live preview mechanism

This is the hardest part of the codebase. Implement it deliberately.

A CodeMirror `ViewPlugin` that:

1. Walks `syntaxTree(view.state)` over **visible ranges only**, not the whole
   document. Large notes must not cost more to render.
2. Emits `Decoration.mark` for styling (heading size, checkbox strike-through).
3. Emits `Decoration.replace` to hide syntax characters (`## `, `- `, `[ ] `).
4. **Skips hiding on any line that contains a cursor or selection endpoint.**
   Syntax reappears on the active line so it can be edited.
5. Rebuilds on `update.docChanged`, `update.viewportChanged`, and
   `update.selectionSet`.
6. Reveals nothing until the tab has seen a user event (`revealArmed` in
   `decorations.ts`), so notes open fully rendered.

Step 4 is the entire trick. Without it, live preview is unusable; with it, it is
invisible. Test it directly.

Labels and tags do **not** use the markdown grammar. They are matched by the
patterns in `src/shared/tags.ts` (shared with the main-process tag index) and
decorated by the same builder, so label brackets reveal with the cursor like
other syntax. Only tags are indexed (D34).
A CodeMirror `MatchDecorator` was rejected because it doesn't re-decorate on
selection changes. See `MARKDOWN_SPEC.md` for the pattern and D27.

## Persistence

### Notes

Plain `.md` files. The scratch folder is configurable and defaults to
`~/Documents/Scratchpost` on both platforms, created on first run.

### Session

`session.json` in `app.getPath('userData')`. Never in the notes folder — the
notes folder is expected to be synced, and session state is machine-specific.

### Settings

`settings.json` alongside it: folder context, recent folders, the welcome
flag, the theme (seed hue and mode), the scratch folder and the note text
size. Main validates every field on read and write; the renderer writes one at
a time, always the latest.

### External changes

`watch.ts` reports changes from outside the app, which happens whenever the
folder is synced from the other machine. Main runs two chokidar watchers per
window: the folder context (depth 10, hidden files, `node_modules` and `.tmp`
skipped) and the open files. Events include the app's own saves; the renderer
tells them apart by content.

- The renderer keeps, per tab, the text last read from or written to disk,
  and the text of a save in flight. A change whose content matches either, or
  matches the buffer, is ignored.
- File changed on disk, buffer **not** dirty → reload silently. Only the
  differing span is replaced, so the cursor and scroll stay put.
- File changed on disk, buffer **is** dirty → do not clobber. The tab is held
  in conflict: saves stop (and fail, so closing is blocked), the pill is
  marked, and a bar above the note offers "Keep mine" or "Load disk version".
- File deleted on disk → mark the tab, do not close it. Typing saves it again.
- Any change inside the folder context re-reads the listing and tag index
  after 500ms.

## Testing

Vitest. Two categories, both required:

**Pure logic** — display-name derivation, list continuation rules, tag regex
matching, filename generation and collision handling, EOL and BOM round-trips.
These are plain functions and should be tested exhaustively.

**Decorations** — build an `EditorState` with the extensions attached, apply a
document and a selection, assert on the resulting `DecorationSet`. This runs
headlessly with no window. It is the only practical way to keep live preview
from regressing, and it is not optional.

Every fixture in `MARKDOWN_SPEC.md` has a corresponding test.

## Packaging

electron-builder. Linux targets AppImage and `.deb`; Windows targets NSIS.

Commit `package-lock.json`, pin the Electron major version, and note the Node
version in the README. The realistic long-term rot risk for this project is a
build environment that has moved on, not a runtime that broke.
