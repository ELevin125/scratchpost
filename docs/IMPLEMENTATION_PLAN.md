# Implementation plan

Work top to bottom. Tick boxes as tasks land. Each milestone is a shippable
state — stop and use the app at the end of each one before continuing.

Every task lists acceptance criteria. A task is not done until they pass and
`npm run lint` is clean. Tests are deferred for now; criteria that mention
tests are checked by hand.

---

## M0 — Scaffold

Getting this right costs an hour and saves a week.

- [ ] **0.1 Project setup**
  electron-vite + TypeScript + React. `npm run dev` opens a window with hot
  reload on the renderer.
  *Accept:* window opens, editing a renderer file updates without restart.

- [ ] **0.2 Security baseline**
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP
  header disallowing remote origins, `will-navigate` blocked.
  *Accept:* `window.require` is undefined in devtools; a remote `<img>` is
  blocked by CSP.

- [ ] **0.3 Preload API skeleton**
  The `ScratchpostAPI` interface from `ARCHITECTURE.md`, with every method
  present and stubbed, exposed via `contextBridge`.
  *Accept:* renderer can call every method and receive a typed rejection.

- [ ] **0.4 Theme tokens**
  `Theme` type, both themes, runtime CSS-var application, ESLint colour-literal
  rule with the `themes/` exclusion.
  *Accept:* switching theme in code repaints everything; adding `#fff` to a
  component fails lint.

- [ ] **0.5 Bundle IBM Plex Mono**
  Weights 400 and 500, local files, no network fetch.
  *Accept:* app renders in Plex Mono with the network disabled.

- [ ] **0.6 Test harness** *(deferred — skip for now)*
  Vitest configured, one passing decoration test against a bare
  `EditorState` to prove the headless path works.
  *Accept:* `npm run test` runs and passes without a display server.

---

## M1 — Usable

At the end of M1 the app replaces Notepad. Nothing in M1 is optional.

- [ ] **1.1 Window shell**
  Tab strip, editor area, status bar. Square corners, hairlines, correct
  tokens. Window size and position persist across restarts.
  *Accept:* matches the agreed layout; reopening restores geometry.

- [ ] **1.2 CodeMirror mount**
  An editor with the markdown language, default keymap, history, and the theme
  from `editor/theme.ts`.
  *Accept:* typing works, undo works, theme tokens applied.

- [ ] **1.3 File read and write with metadata**
  `readFile` returns content plus `FileMeta`; `writeFile` restores EOL and BOM.
  Writes are atomic via tmp-then-rename.
  *Accept:* a CRLF file with a BOM round-trips byte-identical when an unrelated
  line is edited. Test both directions.

- [ ] **1.4 Tab model**
  Open, close, activate, reorder by drag. Display-name derivation per
  `DESIGN.md` — first line for scratch files, filename for external files,
  `untitled` when empty, truncated to 24 characters.
  *Accept:* unit tests cover every display-name branch.

- [ ] **1.5 Autosave scheduler**
  400ms debounce, plus immediate flush on tab switch, window blur, close and
  quit. Save state surfaces in the status bar. Write failures are visible.
  *Accept:* kill the app 500ms after a keystroke; the keystroke is on disk.

- [ ] **1.6 New note flow**
  Tab appears empty with focus; file created on first keystroke as
  `YYYY-MM-DD-HHmm.md` with collision suffixing. No prompt, no auto-rename.
  *Accept:* three notes created in the same minute produce three files.

- [ ] **1.7 Open any file**
  Native file picker and command. Files outside the scratch folder open
  normally and show their real filename.
  *Accept:* a `.txt` from an arbitrary path opens, renders and saves.

- [ ] **1.8 Live preview: headings and bullets**
  The `ViewPlugin` from `ARCHITECTURE.md`. Visible-range only. Cursor reveal.
  *Accept:* every cursor-reveal fixture in `MARKDOWN_SPEC.md` passes as a
  decoration test.

- [ ] **1.9 Checkboxes**
  Render, toggle by click and by `Ctrl+Enter`, strike-through when checked.
  Clicking does not move the cursor.
  *Accept:* fixtures pass; click toggling leaves selection untouched.

- [ ] **1.10 Auto-continue lists**
  Full behaviour and every fixture in `MARKDOWN_SPEC.md`, including `Tab` and
  `Shift+Tab` indentation (D21) and automatic list numbering (D22).
  *Accept:* all nine `Enter` fixtures pass as unit tests.

- [ ] **1.11 Session restore**
  `session.json` in userData. Tabs, order, active tab, cursor and scroll
  restored. Missing files dropped silently.
  *Accept:* quit with four tabs and a scrolled position; relaunch matches.

- [ ] **1.12 Empty states**
  No tabs, and no folder. Per `DESIGN.md`. The no-folder state belongs to the
  file tree, so it lands with the tree in 2.5.
  *Accept:* a fresh profile with no session shows the no-tabs state with a
  working button.

**M1 exit check:** use it as your only notes app for three days. Fix what
annoys you before starting M2.

---

## M2 — Good

2.9 and 2.10 are built first, straight after M1, because both change how notes
render and neither depends on 2.1–2.8.

- [ ] **2.1 Command registry**
  `{ id, label, shortcut, run, when }`. Keymap, toolbar and menus all read from
  it. No key bound outside the registry.
  *Accept:* adding a command makes it appear in the palette with no other edit.

- [ ] **2.2 Command palette**
  `Ctrl+Shift+P`, fuzzy filter, shortcut shown beside each entry, keyboard
  navigable.
  *Accept:* every registered command is reachable and runnable.

- [ ] **2.3 Full editing keymap**
  Move line, duplicate line, indent, outdent, multi-cursor, insert date.
  `Tab` and `Shift+Tab` already landed in 1.10 (D21).
  *Accept:* the binding table in `DESIGN.md` works end to end.

- [ ] **2.4 Folder context**
  Active folder with recents. Switchable from the status bar, the menu and the
  palette. New notes still go to the scratch folder.
  *Accept:* switching to a project `docs/` folder leaves open tabs untouched.

- [ ] **2.5 File tree**
  `Ctrl+B` and toolbar toggle. `.md` and `.txt`, subdirectories, tracked-caps
  section labels with counts, empty state.
  *Accept:* opens a repo `docs/` folder and lists it correctly.

- [ ] **2.6 Quick switcher**
  `Ctrl+P`, fuzzy over filename and display name within the folder context.
  *Accept:* typing three characters finds a note in a folder of two hundred.

- [ ] **2.7 Folder search**
  `Ctrl+Shift+F`, content search across the context, results with file and line,
  click to open at the match.
  *Accept:* finds a phrase in a closed file and jumps to the right line.

- [ ] **2.8 Tags**
  `MatchDecorator` with the regex and exclusions from `MARKDOWN_SPEC.md`. Pills
  with hashed colours. Tag index in the tree with counts. Click to filter.
  *Accept:* all ten tag fixtures pass, including the link exclusions.

- [ ] **2.9 Inline formatting**
  Emphasis, strong, strikethrough, inline code, links. Markers hidden with
  cursor reveal.
  *Accept:* fixtures pass; links open externally on click, not in-app.

- [ ] **2.10 Block constructs**
  Block quotes, fenced code blocks and horizontal rules per "Block constructs"
  in `MARKDOWN_SPEC.md`, with cursor reveal. Remove the list nesting limit.
  No syntax highlighting. See D20.
  *Accept:* every block-construct fixture passes; a heading inside a quote or a
  code fence stays plain text; a pasted table still round-trips unchanged.

- [ ] **2.11 Texture and visual polish**
  The dot field per `THEMING.md`. Accent discipline audited.
  *Accept:* texture never appears behind body text; disabling it in settings
  removes it entirely.

---

## M3 — Yours

- [ ] **3.1 External change watching**
  Reload clean buffers silently; on a dirty conflict, offer reload or keep.
  Mark deleted files without closing the tab.
  *Accept:* editing the same note from a synced second machine behaves per
  `ARCHITECTURE.md`.

- [ ] **3.2 Pin and archive tabs**
  Pinned tabs sort first and survive close-all. Archive moves a note to an
  `archive/` subfolder.
  *Accept:* pinned state persists in session.

- [ ] **3.3 Tray and hide-on-close**
  Close hides to tray; quit is explicit. Makes cold start a once-per-boot cost.
  *Accept:* closing the window keeps the process alive and restores state
  instantly.

- [ ] **3.4 Settings UI**
  Scratch folder, theme, font size, texture on/off and opacity.
  *Accept:* every setting persists and applies without restart.

- [ ] **3.5 Packaging**
  AppImage and `.deb`; NSIS for Windows. Lockfile committed, Electron major
  pinned, build steps in the README.
  *Accept:* a clean checkout builds on both platforms.

---

## Deliberately excluded

Do not implement without an explicit decision recorded in `DECISIONS.md`:
tables, images, indented code blocks, syntax highlighting, backlinks, graph
view, plugins,
mobile, sync, export, collaboration, spell check, global OS hotkey, typewriter
or focus mode.
