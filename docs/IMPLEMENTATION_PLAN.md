# Implementation plan

Work top to bottom. Tick boxes as tasks land. Each milestone is a shippable
state — stop and use the app at the end of each one before continuing.

Every task lists acceptance criteria. A task is not done until they pass and
`npm run lint` is clean. Tests are deferred for now; criteria that mention
tests are checked by hand.

---

## M0 — Scaffold

Getting this right costs an hour and saves a week.

- [x] **0.1 Project setup**
  electron-vite + TypeScript + React. `npm run dev` opens a window with hot
  reload on the renderer.
  *Accept:* window opens, editing a renderer file updates without restart.

- [x] **0.2 Security baseline**
  `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, CSP
  header disallowing remote origins, `will-navigate` blocked.
  *Accept:* `window.require` is undefined in devtools; a remote `<img>` is
  blocked by CSP.

- [x] **0.3 Preload API skeleton**
  The `ScratchpostAPI` interface from `ARCHITECTURE.md`, with every method
  present and stubbed, exposed via `contextBridge`.
  *Accept:* renderer can call every method and receive a typed rejection.

- [x] **0.4 Theme tokens**
  `Theme` type, both themes, runtime CSS-var application, ESLint colour-literal
  rule with the `themes/` exclusion.
  *Accept:* switching theme in code repaints everything; adding `#fff` to a
  component fails lint.

- [x] **0.5 Bundle IBM Plex Mono**
  Weights 400 and 500, local files, no network fetch.
  *Accept:* app renders in Plex Mono with the network disabled.

- [ ] **0.6 Test harness** *(deferred — skip for now)*
  Vitest configured, one passing decoration test against a bare
  `EditorState` to prove the headless path works.
  *Accept:* `npm run test` runs and passes without a display server.

---

## M1 — Usable

At the end of M1 the app replaces Notepad. Nothing in M1 is optional.

- [x] **1.1 Window shell**
  Tab strip, editor area, status bar. Square corners, hairlines, correct
  tokens. Window size and position persist across restarts.
  *Accept:* matches the agreed layout; reopening restores geometry.

- [x] **1.2 CodeMirror mount**
  An editor with the markdown language, default keymap, history, and the theme
  from `editor/theme.ts`.
  *Accept:* typing works, undo works, theme tokens applied.

- [x] **1.3 File read and write with metadata**
  `readFile` returns content plus `FileMeta`; `writeFile` restores EOL and BOM.
  Writes are atomic via tmp-then-rename.
  *Accept:* a CRLF file with a BOM round-trips byte-identical when an unrelated
  line is edited. Test both directions.

- [x] **1.4 Tab model**
  Open, close, activate, reorder by drag. Display-name derivation per
  `DESIGN.md` — first line for scratch files, filename for external files,
  `untitled` when empty, truncated to 24 characters.
  *Accept:* unit tests cover every display-name branch.

- [x] **1.5 Autosave scheduler**
  400ms debounce, plus immediate flush on tab switch, window blur, close and
  quit. Save state surfaces in the status bar. Write failures are visible.
  *Accept:* kill the app 500ms after a keystroke; the keystroke is on disk.

- [x] **1.6 New note flow**
  Tab appears empty with focus; file created on first keystroke as
  `YYYY-MM-DD-HHmm.md` with collision suffixing. No prompt, no auto-rename.
  *Accept:* three notes created in the same minute produce three files.

- [x] **1.7 Open any file**
  Native file picker and command. Files outside the scratch folder open
  normally and show their real filename.
  *Accept:* a `.txt` from an arbitrary path opens, renders and saves.

- [x] **1.8 Live preview: headings and bullets**
  The `ViewPlugin` from `ARCHITECTURE.md`. Visible-range only. Cursor reveal.
  *Accept:* every cursor-reveal fixture in `MARKDOWN_SPEC.md` passes as a
  decoration test.

- [x] **1.9 Checkboxes**
  Render, toggle by click and by `Ctrl+Enter`, strike-through when checked.
  Clicking does not move the cursor.
  *Accept:* fixtures pass; click toggling leaves selection untouched.

- [x] **1.10 Auto-continue lists**
  Full behaviour and every fixture in `MARKDOWN_SPEC.md`, including `Tab` and
  `Shift+Tab` indentation (D21) and automatic list numbering (D22).
  *Accept:* all nine `Enter` fixtures pass as unit tests.

- [x] **1.11 Session restore**
  `session.json` in userData. Tabs, order, active tab, cursor and scroll
  restored. Missing files dropped silently.
  *Accept:* quit with four tabs and a scrolled position; relaunch matches.

- [x] **1.12 Empty states**
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

- [x] **2.1 Command registry**
  `{ id, label, shortcut, run, when }`. Keymap, toolbar and menus all read from
  it. No key bound outside the registry.
  *Accept:* adding a command makes it appear in the palette with no other edit.

- [x] **2.2 Command palette**
  `Ctrl+Shift+P`, fuzzy filter, shortcut shown beside each entry, keyboard
  navigable.
  *Accept:* every registered command is reachable and runnable.

- [x] **2.3 Full editing keymap**
  Move line, duplicate line, indent, outdent, multi-cursor, insert date.
  `Tab` and `Shift+Tab` already landed in 1.10 (D21).
  *Accept:* the binding table in `DESIGN.md` works end to end.

- [x] **2.4 Folder context**
  Active folder with recents. Switchable from the status bar, the menu and the
  palette. New notes still go to the scratch folder.
  *Accept:* switching to a project `docs/` folder leaves open tabs untouched.

- [x] **2.5 File tree**
  `Ctrl+B` (now `Ctrl+Shift+B`, D40) and toolbar toggle. `.md` and `.txt`, subdirectories, tracked-caps
  section labels with counts, empty state.
  *Accept:* opens a repo `docs/` folder and lists it correctly.

- [x] **2.6 Quick switcher**
  `Ctrl+P`, fuzzy over filename and display name within the folder context.
  *Accept:* typing three characters finds a note in a folder of two hundred.

- [x] **2.7 Folder search**
  `Ctrl+Shift+F`, content search across the context, results with file and line,
  click to open at the match.
  *Accept:* finds a phrase in a closed file and jumps to the right line.

- [x] **2.8 Tags**
  `MatchDecorator` with the regex and exclusions from `MARKDOWN_SPEC.md`. Pills
  with hashed colours. Tag index in the tree with counts. Click to filter.
  *Accept:* all ten tag fixtures pass, including the link exclusions.

- [x] **2.9 Inline formatting**
  Emphasis, strong, strikethrough, inline code, links. Markers hidden with
  cursor reveal.
  *Accept:* fixtures pass; links open externally on click, not in-app.

- [x] **2.10 Block constructs**
  Block quotes, fenced code blocks and horizontal rules per "Block constructs"
  in `MARKDOWN_SPEC.md`, with cursor reveal. Remove the list nesting limit.
  No syntax highlighting. See D20.
  *Accept:* every block-construct fixture passes; a heading inside a quote or a
  code fence stays plain text; a pasted table still round-trips unchanged.

### Added after the M2 review (D28)

Batches, in order: 2.12–2.17; then 2.11 with 3.4 and 3.8; then 2.22; then
2.18–2.21; then 3.1, 3.2 and 3.6; then 3.5. (3.3 and 3.7 dropped, D31.)

- [x] **2.12 Find in note**
  `Ctrl+F` opens CodeMirror's find and replace bar, styled with theme tokens.
  `F3` / `Shift+F3` for next and previous; `Escape` closes.
  *Accept:* finds and replaces within the note; the bar matches both themes.

- [x] **2.13 Tab shortcuts**
  `Ctrl+Tab` / `Ctrl+Shift+Tab` cycle tabs, `Ctrl+W` closes, `Ctrl+Shift+T`
  reopens the last closed tab, `Ctrl+Y` also redoes. Remove Electron's default
  application menu.
  *Accept:* every shortcut works; no Electron menu accelerator remains.

- [x] **2.14 Folder navigation**
  Tree header shows the folder and opens the folder menu; `← Scratch` when in
  another folder; "Parent folder" in the folder menu; the status bar shows the
  end of the folder path.
  *Accept:* from any folder, the scratch folder is one visible click away.

- [x] **2.15 Tab strip layout and window title**
  `+` and `Open` pinned to the right of the tab strip. The window title shows
  the active note.
  *Accept:* buttons stay put as tabs open and close; Alt+Tab shows the note.

- [x] **2.16 Delete, reveal and context menus**
  Delete note (to the OS trash), show in file manager, copy path. Right-click
  menus on tabs and tree rows, with labels and shortcuts from the registry.
  *Accept:* a deleted note is recoverable from the trash.

- [x] **2.17 Recent-first scratch folder**
  The scratch folder's tree sorts newest first with a faint relative modified
  time per note. Other folders keep name order.
  *Accept:* the note just edited is at the top of the tree.

- [x] **2.18 Open from outside the app**
  Command-line paths, "open with" from the file manager, drag and drop onto
  the window, single instance.
  *Accept:* double-clicking a `.md` file opens it in the running window.

- ~~**2.19 Daily note**~~ — dropped by the author, see D32.

- [x] **2.20 Typing helpers**
  Auto-closing pairs for `` ` ``, `**`, `(`, `[`; pasting a URL onto a selection
  makes a link. Update `MARKDOWN_SPEC.md`, "Copy and paste".
  *Accept:* pasting a URL with no selection still inserts it verbatim.

- [x] **2.21 Code highlighting**
  Syntax highlighting in fenced code blocks for a small, bundled set of
  languages, coloured from theme tokens.
  *Accept:* an unknown language renders exactly as before.

- [x] **2.22 Design review**
  Audit both themes against `DESIGN.md` and `THEMING.md`: layout, empty
  states, overlays, menus, accent discipline, texture. Fix what fails.
  *Accept:* a written list of findings, each fixed or recorded as a decision.
  Findings are in `docs/DESIGN_REVIEW.md`; the redesign is D33.

- [x] **2.25 Labels and tags**
  `[word]` stays a local label; `#word` becomes the indexed tag, rendered as
  coloured text and clickable to filter the tree. See D34.
  *Accept:* `[x]` never appears in the tag index; clicking `#work` in a note
  lists the notes tagged `#work`.

- [x] **2.23 Tint theme model**
  Themes generated from a seed hue and a mode instead of hand-picked files.
  Nocturne and Newsprint become the dark and light modes of the default
  seed. Code colours derive from the seed; tag hues stay seeded by the word.
  Bundle IBM Plex Sans and Plex Sans Condensed. Rewrite `THEMING.md`.
  *Accept:* changing the seed recolours every surface; no colour literal
  outside `themes/`.

- [x] **2.24 Tint layout**
  Top bar (open-note pills, find field, new note), left column (notes panel
  with folder header, recent list, show all and folder tree; tags panel),
  note panel (title, meta line, date block, capped text), floating dock, one
  bundled icon set. The status bar's contents move to the meta line and dock.
  Rewrite `DESIGN.md`, "Visual language", and update the welcome note. The
  title bar question from D33 is still open.
  *Accept:* every command still has a visible affordance; folders still open
  and switch; matches the D33 mockup in both modes.

- [x] **2.26 Tint overlays and states**
  Palette, switcher, folder menu, search, rename, context menus and empty
  states restyled as rounded panels over a dimmed editor. Lists show whole
  rows.
  *Accept:* every overlay and empty state from `DESIGN.md` checked in both
  modes.

- ~~**2.11 Texture and visual polish**~~ — dropped, the tinted ground
  replaces the dot field. See D33.

---

## M3 — Yours

- [x] **3.1 External change watching**
  Reload clean buffers silently; on a dirty conflict, offer reload or keep.
  Mark deleted files without closing the tab.
  *Accept:* editing the same note from a synced second machine behaves per
  `ARCHITECTURE.md`.

- [x] **3.2 Pin and archive tabs**
  Pinned tabs sort first and survive close-all. Archive moves a note to an
  `archive/` subfolder.
  *Accept:* pinned state persists in session.

- ~~**3.3 Tray and hide-on-close**~~ — dropped, see D31. Closing the window
  quits.

- [x] **3.4 Settings UI**
  Scratch folder, seed hue, light or dark mode, font size.
  *Accept:* every setting persists and applies without restart.

- [~] **3.5 Packaging** (Windows installer built; Linux and icon still to check)
  AppImage and `.deb`; NSIS for Windows. Lockfile committed, Electron major
  pinned, build steps in the README. Register `.md` and `.txt` so "Open with"
  lists the app (a `.desktop` entry with `%F`, and NSIS file associations);
  the argument handling already exists (2.18).
  *Accept:* a clean checkout builds on both platforms.

- [x] **3.6 Local version history**
  Quiet snapshots of each note in userData, on close and at most every few
  minutes while editing, pruned over time. A "History" command lists a note's
  snapshots and restores one. See D38.
  *Accept:* a paragraph deleted and saved yesterday can be restored today.

- ~~**3.7 Global capture shortcut**~~ — dropped with the tray, see D31.

- [x] **3.8 System theme**
  A mode option that follows the system light or dark setting. Built with
  3.4. The capped text column is part of Tint (D33), no longer an option.
  *Accept:* switching the system setting switches the app without restart.

- [x] **3.9 The cat**
  A round "bean" cat mascot, filled in the theme colour with pink ears, perched
  on the dock and asleep in the empty state. It idles (breathing, blinking,
  tail flicks) and every minute or so does a random bit: headphones and a
  headbang, a yawn, grooming, looking around, a short nap. It hops when a
  checklist is finished, purrs when clicked, stretches on `meow`, and naps
  after a while without typing. On by default, with a switch in Settings.
  No sound, no text, never over note text, still under reduced motion.
  *Accept:* matches the prototype shown on 2026-09-16; costs nothing while the
  window is hidden. Built before 3.6; see D37.

---

## Milestone 5 — After a week of use

From the author's second list (2026-09-18), in four batches: editing feel,
links, labels, then notes.

- [x] **5.1 Bigger hit targets:** checkboxes, tab close buttons, icon buttons,
  tag chips and label chips grew their clickable area without changing how
  they look.
- [x] **5.2 Tab inserts in pickers:** `Tab` picks the highlighted row, like
  `Enter`, so the label picker doesn't jump focus to some control.
- [x] **5.3 A selection reveals every line it covers.** See D43.
- [x] **5.4 A pasted link is clickable:** a URL on its own renders and opens
  like a markdown link, through GFM autolinking.
- [x] **5.5 Click a label to see only the lines that carry it.** See D44.
- [x] **5.6 Rename a label** in the note, across the folder, and in your list.
  See D44.
- [ ] **5.7 Move a selection into a new note.**
- [ ] **5.8 Auto-archive old notes.**

---

## Milestone 4 — After first use

From the author's list after a day of real use (2026-09-17). Bugs first, then
the easter egg, improvements and features.

- [x] **4.1 Bold that looks bold**
  `**text**` used weight 500, barely different in Plex Mono. Now 700, with the
  700 faces bundled.
- [x] **4.2 No false "changed on disk" on new notes**
  The empty file a new note starts as, and late watcher events for the app's
  own writes, are recognised as the app's own (the last 8 writes per tab).
- [x] **4.3 Less space above the note**
  The date block floats right of the text column instead of pushing the note
  down; it hides when the window is too narrow for it.
- [x] **4.4 Parrot party**
  Typing `parrotparty` or `parrot party` toggles moving rainbow text in the
  note panel, and the cat puts its headphones on. Not saved; no motion under
  reduced motion. See D39.
- [x] **4.5 Tidier dock:** light/dark and theme colour leave the dock (they
  stay in Settings and the palette).
- [x] **4.6 Find bar layout:** the editor's find bar stops wrapping awkwardly.
- [x] **4.7 Pinned notes:** pin a note to the top of the notes panel, shown
  whatever folder is open.
- [x] **4.8 Formatting shortcuts:** `Ctrl+B`, `Ctrl+I` and friends, toggling
  on the selection or the word at the cursor.
- [x] **4.9 Editor right-click menu:** formatting, headings, label and list
  type for the selection.
- [x] **4.10 Label picker:** a shortcut and menu that insert a label from a
  list defined in Settings.
- [x] **4.11 Switch list type:** turn the selected lines or list into bullets,
  a checklist or a numbered list.
- [x] **4.13 Bean:** the cat gets a name, a second pass at its drawing and
  animations (a real purr, grooming), and a setting for where it sits. See D42.
- [x] **4.12 Rebindable shortcuts:** change, remove or reset any command's
  shortcut from Settings or the palette. See D41.

---

## Parked ideas

Liked, not scheduled. Each needs a decision before it becomes a task:
`[[note]]` links opened through the quick switcher, and tabs in the title bar
(D17). The mascot idea became task 3.9.
"Copy note as image" was considered on 2026-09-17 and skipped; "Copy as rich
text" is the lighter alternative if sharing formatted notes comes up.

---

## Deliberately excluded

Do not implement without an explicit decision recorded in `DECISIONS.md`:
tables, images, indented code blocks, syntax highlighting beyond the 2.21
language set, backlinks, graph view, plugins, mobile, sync, export,
collaboration, spell check, split screen, typewriter or focus mode.
