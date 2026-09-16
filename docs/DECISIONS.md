# Decisions

Each entry records what was chosen, what was rejected, and why. The purpose is
to stop settled questions being reopened in week three.

---

## D1 — Build it rather than use Obsidian

**Chosen:** build.

Obsidian is free, requires no account, stores plain markdown locally, and is
built on CodeMirror 6 — so it already has live preview, the full editor keymap,
the command palette, quick switcher and folder search. Most of the wanted
feature list already exists there.

Two things do not bend: it is **vault-first** (files must live inside a managed
folder before they can be edited) and it will not render `[tag]` as a pill.
Those are the two things this project is actually about. Building it was also
wanted for its own sake.

**Rejected:** Obsidian, Typora (no multi-cursor or editor motions), VS Code (no
live inline rendering), Neovim with `render-markdown.nvim` (steep without
existing motion fluency), Windows Notepad (markdown is a two-mode toggle, not
live preview).

---

## D2 — Electron, not Tauri

**Chosen:** Electron.

The author has no Rust experience. Tauri would add rustup, MSVC build tools on
Windows and webkit2gtk headers on Linux, and would leave them stranded in an
unfamiliar language when something broke. Electron's main process is Node, which
they already know, so the whole app is TypeScript.

Electron also ships one Chromium everywhere, so Linux and Windows render
identically. Tauri's system webviews (WebView2 and WebKitGTK) differ.

The usual objections do not apply: bundle size matters for distribution, and
this installs on two personal machines; memory matters when competing with a
game, and this is a text editor. Cold start was to be mitigated by a tray in M3;
that was dropped (D31), and start-up time is accepted as it is.

The security objection is retired by the posture in `ARCHITECTURE.md`: no remote
content is ever loaded, so the attack surface is close to zero.

**Rejected:** Tauri (Rust), Wails (Go — new language, and reintroduces the
webview inconsistency), Deno Desktop (experimental as of mid-2026), Electrobun
(poor real-world results), NW.js (not recommended for shipping), Avalonia with
AvaloniaEdit (closest to the author's C#, but provides no markdown parser or
decoration model, meaning the hardest part would be written from scratch).

---

## D3 — CodeMirror 6 for the editor

**Chosen:** CodeMirror 6. Effectively not a choice — it supplies the Lezer
markdown parser, the decoration system, multi-cursor, a real undo history and
the editor motions that make "notes as code" possible. Obsidian is built on it.

**Rejected:** Monaco (heavier, code-oriented, awkward for prose), a
contenteditable implementation (undo and selection handling are a tar pit),
ProseMirror (document-model-first; fights plain-text round-tripping).

---

## D4 — Folder, not vault

**Chosen:** a scratch folder for new notes, plus a switchable folder context for
indexing, with tabs able to open any file anywhere.

This is the project's reason to exist, and it also solves the docs-folder case
without a second mechanism: a project's `docs/` folder is just another context.

**Rejected:** a managed vault; separate "notes mode" and "project mode"; an
import step of any kind.

---

## D5 — Filename is a timestamp; display name is the first line

**Chosen:** create `YYYY-MM-DD-HHmm.md` on first keystroke, show the first line
of content as the tab label, rename only via `F2`.

The author rarely names notes and rarely writes a useful heading. Prompting adds
friction to the one thing that must stay instant. Auto-renaming from the first
heading produces churn and orphaned files as headings are edited. Separating
display name from filename gets a readable tab and a sortable folder at once.

**Rejected:** a name prompt on creation; `Untitled-N`; continuous auto-rename
from the first heading; a one-time rename on first heading.

---

## D6 — 400ms autosave debounce with atomic writes

**Chosen:** 400ms, plus flush on tab switch, blur, close and quit. Write to tmp,
`fsync`, rename over target.

The author's habit is leaving notes unsaved for long periods, so data safety is
the highest-value property in the app. Five seconds was proposed and rejected as
too much to lose. Atomic writes mean a crash mid-write cannot corrupt a note,
and because every buffer is always a current file, no separate crash-recovery
system is needed.

**Rejected:** 5s debounce; save-on-blur only; a single journal or database file;
a `.swp`-style recovery sidecar.

---

## D7 — File per note, not one store

**Chosen:** plain `.md` files in a folder.

Makes cross-machine sync free via Syncthing, git or any folder tool, keeps notes
readable in any editor, and means the app can be abandoned without trapping
anything. `session.json` lives in userData, **not** the notes folder, because
session state is machine-specific and the notes folder is synced.

**Rejected:** a single JSON store; SQLite; putting session state alongside the
notes.

---

## D8 — `[tag]` syntax kept, with link disambiguation

**Chosen:** `[word]` renders as a pill, where the word has no spaces and is not
followed by `(` or `[`.

`[tag]` was wanted because it already reads as a tag in plain text, so notes
degrade gracefully in other editors — better than `#tag`, which becomes noise.
The concern was collision with markdown links. The lookahead rules resolve it
completely: `[docs](url)` stays a link, `[urgent]` becomes a pill. The no-spaces
rule stops ordinary bracketed prose becoming pills by accident.

**Rejected:** `#tag` (loses the visual quality that motivated it); `@tag`;
dropping tags; requiring an escape for literal brackets.

---

## D9 — Monospace throughout

**Chosen:** IBM Plex Mono for editor and UI, bundled locally.

The author wants notes to feel like code. Monospace is the single biggest lever
on whether the app reads as a text editor or a word processor. Plex Mono matches
their portfolio site. Bundled rather than CDN-loaded because the app loads no
remote content at all.

**Rejected:** proportional body text with monospace code spans; a system font
stack; loading from Google Fonts.

---

## D10 — Visual language: square, hairlined, sparingly accented

**Chosen:** square corners everywhere except tag pills, hairline borders,
tracked-caps section labels with counts, accent used on five specific elements
only, dot field in the top-right fading left, drawn with `--hatch`.

"Must not look like a web app" was raised repeatedly. Rounded corners and
borderless surface-value separation are the two strongest tells.

**Rejected after being tried:** texture behind the file tree (it sits behind
text, which the same reasoning forbids); a capped centred text column with
visible gutters (read as a "sheet on a desk", not wanted); a decorative accent
rule across the window's top edge; chrome that hides while typing.

---

## D11 — Palette taken from the author's portfolio site

**Chosen:** the exact token values from `elevin125.github.io` — cool-neutral
greys, warm cream ink, vermilion spot — under the same token names.

Gives the app an identity that is already the author's, and lets one vocabulary
describe both. An earlier warmer palette was explicitly rejected as too warm.

---

## D12 — Themes are data, enforced by lint

**Chosen:** a `Theme` object per file, applied as CSS custom properties, with an
ESLint rule forbidding colour literals outside `themes/`.

Adding a theme is then a data change. The rule exists because colour literals
leak quietly, particularly into the CodeMirror theme object, and a half-themed
app is worse than an unthemed one.

---

## D13 — No spell check in v1

**Chosen:** defer past M3.

CodeMirror's contenteditable can reach the OS spellchecker, but it conflicts
with `Decoration.replace` — the mechanism live preview depends on. This is a
known cost of building rather than buying; it is accepted, not solved.

---

## D14 — No global OS hotkey

**Chosen:** dropped, at the author's request, despite being proposed as the
feature that would make a custom tool worth having. Binding an OS-level shortcut
to launch the app achieves most of it without in-app machinery.

---

## D15 — No subagents for implementation

**Chosen:** `CLAUDE.md` plus the checkbox plan in `IMPLEMENTATION_PLAN.md`.

Subagents earn their keep when a side task would flood the main context with
output that will not be referenced again. Nothing in this project does. Adding
them would be ceremony.

---

## D16 — Tag colours seeded from the tag text, not a fixed palette

**Chosen:** a stable hash of the tag text picks a hue from 0 to 359. Each theme
supplies only saturation and lightness (`tagColor` in the `Theme` type).

**Rejected:** a fixed per-theme palette of six hues, hashed into by tag text.
Any fixed palette size means unrelated tags collide once there are more tags
than colours. Seeding the hue from the word gives every tag its own colour with
no palette to maintain, while the theme-owned saturation and lightness keep
contrast predictable. This resolves the earlier open question on palette size.

The final colour is assembled in CSS as
`hsl(var(--tag-hue) var(--tag-saturation) var(--tag-lightness))`, with only the
numeric hue set on the pill, so no colour literal appears outside `themes/`.

---

## D17 — Native window frame on Windows

**Chosen:** keep the native title bar; the tab strip sits directly below it.

**Rejected:** a custom title bar holding the tab strip. It looks tighter and
matches across platforms, but needs more Electron configuration, app-drawn
window controls, and breaks Windows snap conventions. The native frame has fewer
surprises and can be revisited later without touching the tab model. The
default application menu bar is auto-hidden so the native frame carries no
content beyond the title.

---

## D18 — Two API additions for M1: `getScratchDir` and `onBeforeClose`

**Chosen:** add `getScratchDir(): Promise<string>` and
`onBeforeClose(flush): () => void` to `ScratchpostAPI`.

- `getScratchDir` — the renderer needs the scratch folder to call
  `createNote(scratchDir)` and to decide whether an opened file is a scratch
  note (display-name rules). Main owns the path: `~/Documents/Scratchpost` by
  default, created on first call, read from `settings.json` once 3.4 lands.
- `onBeforeClose` — autosave must flush on window close and app quit, but IPC
  writes are async and a closing window drops them. Main holds the close,
  asks the renderer to flush, and closes when it answers or after 2 seconds.

**Rejected:** main choosing the scratch folder inside `createNote` (the
renderer could no longer tell scratch notes from other files), and a
synchronous `sendSync` flush on `beforeunload` (blocks the UI thread and needs
a second, synchronous write path).

**Also decided:** until the command registry lands in 2.1, New note and Open
file are reachable only from buttons in the tab strip. `Ctrl+N` and `Ctrl+O`
are bound through the registry then, so no key is ever bound outside it.

---

## D19 — Checkbox `Ctrl+Enter` arrives with the command registry

**Chosen:** in task 1.9, checkboxes render and toggle by click. `Ctrl+Enter`
and the toggle command are registered in 2.1, reusing `toggleTaskAt` from
`editor/checkbox.ts`.

**Rejected:** binding `Ctrl+Enter` directly in 1.9. It would be the first key
bound outside the registry, which `CLAUDE.md` forbids; same reasoning as D18.

Checkboxes render only in bullet lists, matching the spec's `- [ ]` syntax.
`1. [ ] text` keeps its number and shows its brackets as text.

---

## D20 — Block quotes, fenced code and horizontal rules are supported

**Chosen:** render block quotes, fenced code blocks and horizontal rules, and
drop the three-level limit on list nesting. See `MARKDOWN_SPEC.md`, "Block
constructs".

The original unsupported list recorded no reason for these items, and each one
turned out cheap and consistent with the rest of live preview:

- **Block quotes** are a hidden marker plus a hairline border, the same pattern
  as headings, and hairlines are already the visual language (D10).
- **Fenced code blocks** are a `--bar` tint with hidden fences. Everything is
  already monospace, so the tint does the work. Syntax highlighting is
  explicitly excluded; it would be real scope creep.
- **Horizontal rules** are a single hairline.
- **The nesting limit** was an arbitrary constant, and deep items dropping to
  plain text read as a bug.

**Still rejected:**

- **Tables.** Rendering a grid needs block widgets, and cursor movement and
  editing inside cells is where live-preview editors reliably break. Pipe
  tables are readable as-is in monospace.
- **Indented code blocks.** A list item indented one level too far would
  silently become code. Fenced blocks cover the need.
- **Images.** Remote image URLs conflict with the no-remote-content rule, and
  local images would need file handling the app doesn't otherwise have.
- **HTML, footnotes, reference-style links, setext headings.** Rare in scratch
  notes; not worth the surface area.

Implemented as task 2.10 in `IMPLEMENTATION_PLAN.md`, after inline formatting,
because inline code and code blocks share the `--bar` treatment.

---

## D21 — Enter, Tab and Shift+Tab belong to the editor, not the registry

**Chosen:** list continuation on `Enter`, and indent and outdent on `Tab` and
`Shift+Tab`, live in `editor/lists.ts` as an editor keymap. `Tab` indents
everywhere, not only in lists, and never moves focus out of the editor.

The registry exists so that every *action* has a visible affordance (DESIGN.md
principle 2). These keys are not actions; they are how typing works, the same
as Backspace. Giving "press Enter" a palette entry would be noise.
`CLAUDE.md` rule 3 carries this as its one exception.

**Rejected:** routing them through the registry (no meaningful palette entry),
and leaving `Tab` unbound outside lists (focus jumping to a toolbar button
mid-note is jarring). CodeMirror's markdown `Enter` handling is disabled: it
continues items even with the cursor mid-line, which the spec's
`"- foo|bar"` fixture forbids.

---

## D22 — Numbered lists renumber automatically

**Chosen:** after any edit that touches a numbered list, its items are
renumbered to count up from the list's start. This extends the spec's original
"renumber on indent change" to moving, duplicating and deleting lines, pasting,
and `Enter` mid-list.

- The start number is kept across structural edits, so moving the first item
  down doesn't shift the list. Typing on the first item's number sets it.
- Renumbering joins the edit's own transaction, so one undo reverts both.
  Undo and redo are never renumbered themselves.
- Items inside code fences are never touched.

**Rejected:** numbers exactly as typed, which is what most editors do. Moving
lines then leaves lists out of order, which was the reported annoyance.

**Trade-off:** numbers other than the first are managed. A deliberately lazy
list (`1.` on every line) becomes sequential the first time it is edited, and
the file on disk changes to match.

---

## D23 — Empty scratch notes are deleted when their tab closes

**Chosen:** closing a tab whose file is in the scratch folder and holds only
whitespace deletes the file. A new `deleteIfEmpty(path)` IPC call does it: main
supplies the scratch folder itself, refuses anything outside it, and re-reads
the file from disk so a synced edit that arrived after the last keystroke is
never lost. A plain delete, not the trash: there is nothing in it to recover.

- Files opened from outside the scratch folder are never deleted, even empty.
- An empty note that is still open at quit is kept and restored as a tab.

**Rejected:**

- **Deleting whenever a save leaves the file empty.** Clearing a note to start
  over is normal; the file would vanish and come back under a new timestamp
  mid-edit, and sync tools would see delete/create churn.
- **Sweeping empty files on launch.** With two synced machines, a note created
  on one is briefly empty before its first write lands; the other machine
  could delete it. It would also remove empty files made on purpose.
- **Doing nothing.** Abandoned new notes pile up as empty timestamped files
  that clutter the file tree and quick switcher.

---

## D24 — The command registry owns every shortcut

**Chosen:** `app/state/commands.ts` is one list of
`{ id, label, shortcut?, run, when? }`. A single window-level `keydown`
listener (capture phase) matches shortcuts against it, so shortcuts work
outside the editor (the empty state, the tab strip) and win over CodeMirror's
own keys. The palette, the tab strip buttons and the status bar read from the
same list.

- CodeMirror keeps only `standardKeymap`: cursor motion, selection, deletion
  and select-all. Like `Enter` and `Tab` (D21) these are typing, not actions.
  Its `defaultKeymap` extras (move line, and so on) are registry commands.
- Shortcuts are ignored while focus is in a text input (palette, rename), so
  typing there never triggers commands.
- Insert date writes `YYYY-MM-DD`, matching note filenames. It has no shortcut;
  the palette reaches it.

**Known gaps:**

- `Ctrl+W` is not bound to close tab: Electron's default menu already uses it
  to close the window. Close tab is in the palette.
- One shortcut per command, so redo is `Ctrl+Shift+Z` only, not `Ctrl+Y`.
- GNOME uses `Ctrl+Alt+↑/↓` to switch workspaces and may take the keys before
  the app sees them. Add cursor above and below stay reachable from the palette.

---

## D25 — Folder context, file tree and quick switcher details

**Chosen:**

- **Settings API.** `getSettings` and `setSettings` read and write
  `settings.json` in userData. For now it holds the folder context (`null`
  meaning the scratch folder) and up to eight recent folders; 3.4 adds the
  rest. A remembered folder that no longer exists falls back to the scratch
  folder with a status bar notice.
- **Switching.** From the folder name in the status bar or the palette. There
  is no overflow menu anywhere in the plan, so the palette stands in for the
  "menu" in DESIGN.md.
- **One recursive walk.** `listFolder` returns every `.md` and `.txt` under the
  folder in one call, folders first, natural sort. It skips hidden entries,
  `node_modules` and symlinks, drops folders with no notes inside, and stops at
  5,000 entries and ten levels so pointing it at a large repo can't stall the
  app. Each file carries its first non-blank line (read from the first 1 KB),
  so the tree and switcher show the same display names as tabs without
  opening every file.
- **Tree.** Hidden at launch. Folders start collapsed; expansion lasts until
  the folder changes. A single click opens a file.
- **Refresh without watching.** Until 3.1 the listing is re-read when the tree
  opens, the switcher opens, the window regains focus, the folder changes, and
  an open file is created, renamed or closed.
- **Shared picker.** The command palette, quick switcher and folder menu are one
  `Picker` component, showing at most 100 matches.

**Rejected:** a lazy per-folder `listFolder` (the quick switcher needs every
file anyway), and reading whole files for display names (slow on large
folders for a single line of text).

---

## D26 — Renamed scratch notes show their filename

**Chosen:** the display name follows the filename.

- A scratch note still named by timestamp (`YYYY-MM-DD-HHmm.md`, optionally
  with a `-2` suffix) shows its first line, as before.
- A scratch note you have renamed shows that filename, without `.md`.
- Files from outside the scratch folder show their real filename, unchanged.

It is derived from the filename alone. Nothing extra is stored, so it behaves
the same on both synced machines and survives a rename in a file manager.
`F2` on a timestamp-named note pre-fills a filename made from its first line
(`# Grocery list` → `grocery-list.md`), so naming a note is `F2`, `Enter`.

This refines D5 rather than reversing it: files still never rename themselves.

**Rejected:** always showing the filename (timestamps everywhere until renamed),
renaming automatically from the first line (D5), and storing a "renamed" flag
(per machine, and lost when a file is renamed outside the app).

---

## D27 — Folder search and tags

**Chosen:**

- **Search is an overlay**, like the palette and switcher, rather than a side
  panel, so the layout never changes. `Ctrl+Shift+F`. Case-insensitive
  substring match, at least two characters, 200ms debounce, grouped by file,
  first 500 matches, files over 1 MB skipped. Opening a result selects the
  match and scrolls to it.
- **Editor tags render in the live preview builder**, using the spec's regex,
  rather than a CodeMirror `MatchDecorator`. `MatchDecorator` only re-decorates
  on document and viewport changes, but tag brackets must reveal with the
  cursor like all other syntax. Tags are skipped in fenced, indented and inline
  code and in HTML.
- **Tags are case-insensitive.** `[Urgent]` and `[urgent]` are one tag with one
  colour; the index shows them lowercase. The hue is an FNV-1a hash of the
  lowercased text.
- **One pattern.** `src/shared/tags.ts` is used by both the editor and main.
- **Tag index.** A new `listTags(path)` call scans the folder in main, skipping
  fenced and inline code by text rules (main has no syntax tree) and files
  over 1 MB, and counts occurrences. The tree's TAGS section lists them with
  counts; clicking one filters notes to a flat list of files containing it,
  and clicking again or `×` clears it.

---

## D28 — Scope added after the M2 review

After using M1 and M2, the author asked for a round of additions, including
some the docs had ruled out. This entry records each reversal; the tasks are
2.12–2.22 and 3.6–3.8 in `IMPLEMENTATION_PLAN.md`. `DESIGN.md` and
`MARKDOWN_SPEC.md` are updated as each task lands.

**Reversed:**

- **Global capture shortcut** (D14): back, as task 3.7, once the tray (3.3)
  keeps the app running so a system-wide key has something to show. Later
  dropped again with the tray, see D31.
- **Syntax highlighting** (D20): allowed for a small bundled set of languages
  (2.21). Still no highlighting for anything else.
- **Centred text column** (rejected visual idea): allowed as an optional
  reading-width setting, off by default (3.8). The default look is unchanged.
- **Smart paste** (`MARKDOWN_SPEC.md`, "Copy and paste"): one exception, pasting
  a URL onto a selection makes a link (2.20). No other paste transforms.

**Added, not previously considered:** find in note, tab shortcuts, folder
navigation, delete to trash, context menus, recent-first scratch folder, open
from outside the app, daily note, auto-closing pairs, local version history
(3.6), following the system theme (3.8), and a design review (2.22).

**Parked, not scheduled:** `[[note]]` links (still a `DESIGN.md` non-goal),
tabs in the title bar (D17 stands for now), and a mascot or desktop toy as an
easter egg.

**Still rejected:** spell check (Electron downloads dictionaries from Google,
breaking the no-network rule), split screen, tables, images, plugins, export
and sync.

---

## D29 — Find, tab shortcuts, menus, delete and recent-first

**Chosen:**

- **Find bar.** CodeMirror's find and replace panel at the top of the editor,
  restyled with theme tokens. `Ctrl+F`, `F3` and `Shift+F3` are registry
  commands; `Escape` inside the bar is the bar's own key.
- **No application menu.** Electron's default menu is removed. Its accelerators
  took `Ctrl+W` and bypassed the registry. Clipboard keys still work natively
  on Linux and Windows. Dev builds keep `Ctrl+Shift+I` for devtools, handled
  in main and absent from production. This closes D24's gaps: `Ctrl+W` closes
  a tab, and a command may carry extra, undisplayed shortcuts (redo also takes
  `Ctrl+Y`).
- **Delete goes to the OS trash, without a confirmation.** The trash is the
  undo, and DESIGN.md principle 3 rules out prompts. A new `trashFile` call
  only accepts existing `.md` and `.txt` files. `showInFolder` reveals a file.
- **Context menus are drawn by the app,** not native, so they match the square
  hairlined look and take their labels and shortcuts from the registry.
- **Recent-first scratch folder.** Folders first by name, then notes newest
  first by modified time, each with a faint relative time. Other folders keep
  name order. `listFolder` now returns each file's modified time; saves made
  in this session update times and order without re-reading the folder.
- **Folder navigation.** The tree header names the folder and opens the folder
  menu, with `← Scratch` when elsewhere; the folder menu offers the parent
  folder; the status bar shows the last two segments of the path.
- **Window title** follows the active note.

---

## D30 — A welcome note doubles as the tutorial

**Chosen:** a short note that teaches the non-obvious parts by using them:
cursor reveal, a checklist of commands to try, every rendered construct, and a
few things worth knowing. Its text is `src/main/welcome.md`.

- It is a real file, `welcome.md` in the scratch folder, not a special built-in
  tab, because every tab is a plain file.
- It appears once, on a first launch with no session to restore and no notes
  in the scratch folder. A scratch folder synced from another machine already
  has notes, so it never appears there. A `welcomed` flag in `settings.json`
  is set before the attempt, so it is never offered twice.
- "Open welcome note" in the palette recreates it if missing, or opens it.
- It never overwrites an existing `welcome.md`.

This is the one file the app creates without a keystroke from the user.

**Kept current:** the note only mentions what exists. `CLAUDE.md` says to
update it when a feature it mentions changes or a new one earns a line (file
history, for example).

**Rejected:** dummy sample text (shows syntax but teaches nothing), and a
read-only built-in tab (breaks "every tab is a real file").

---

## D31 — No tray, no global capture shortcut

**Chosen:** drop task 3.3 (tray and hide-on-close) and task 3.7 (global capture
shortcut). Closing the window quits, as it does now. This reverses the global
shortcut part of D28 and leaves D14 standing.

The global shortcut only made sense with the app kept alive in the tray, so the
two go together. The author doesn't want either.

**Kept:** 3.1 external change watching. It is what stops autosave from writing
an open tab's stale text over a newer version synced from the other machine,
so it matters more than the tray ever did.

---

## Open questions

Not yet decided. Do not guess; raise them.

- **Custom window frame on Windows.** Resolved by D17: native frame.
- **Tag colour palette size.** Resolved by D16: there is no fixed palette.
- **Texture opacity default.** Tuned by eye in a mockup; needs checking on the
  author's actual displays.
