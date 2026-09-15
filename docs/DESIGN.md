# Design

## What Scratchpost is

A desktop markdown scratchpad for one person. Open it, type, never think about
saving. Notes live as plain `.md` files in a folder you control.

## Goals

1. **Capture is instant.** New note to first keystroke is one action.
2. **Nothing is ever lost.** Every buffer is a real file on disk, always current.
3. **Live rendering that stays out of the way.** Headings, bullets, checkboxes
   and tags render as you type, and editing them never feels like a fight.
4. **Any file, from anywhere.** No vault. No import step.
5. **Notes as code.** Editor motions a programmer expects: move line, duplicate
   line, indent, multi-cursor, real undo.
6. **Two machines, one folder.** Linux and Windows, synced by any folder-level
   tool the user already has.

## Non-goals

These are out of scope. Do not implement them, and do not add scaffolding "for
later". If a task seems to require one, stop and ask.

- Tables (syntax, rendering, or editing UI)
- Image embedding or attachment handling
- Backlinks, wikilinks, graph views, transclusion
- A plugin system or extension API
- Mobile or web builds
- Built-in sync, accounts, or any network calls whatsoever
- Real-time collaboration
- PDF or HTML export
- Spell check (see `DECISIONS.md`; revisit only after M3)

The app is valuable because it stays small. Feature creep is the main risk to
the project.

## Principles

These decide arguments. When a task is ambiguous, resolve it against these.

### 1. Folder, not vault

There is a **scratch folder** where new notes are created, and there is a
**folder context** that search, the quick switcher, the file tree and the tag
index scope to. They default to the same folder.

**Tabs are independent of both.** Any file on disk can be opened as a tab
regardless of what folder is active, exactly like Notepad. The folder context
only decides what gets indexed, never what can be opened.

This is the app's reason to exist. Do not introduce anything that requires a
file to be "imported" or "added to" anything before it can be edited.

### 2. Every command has a visible affordance

Keyboard shortcuts accelerate; they never gate. Every command must be reachable
by mouse through the toolbar, the overflow menu, the status bar, or the command
palette. The command palette displays each command's shortcut next to it, so it
doubles as the way shortcuts are learned.

A feature that exists only as a key binding is a feature the user will forget
exists. This has been explicitly requested.

### 3. Saving is not a user-facing concept

There is no Save command, no dirty indicator asking a question, no "unsaved
changes" dialog on quit. The status bar reports save state as information, not
as a prompt.

### 4. It must not look like a web app

Square corners, hairline borders, monospace text, tight vertical rhythm, system
window behaviour. See "Visual language" below for the specifics. This has been
raised repeatedly and matters more than it might seem.

### 5. Plain files, unmodified

A file Scratchpost opens and saves must be byte-identical apart from the edits
the user made. Line endings and byte-order marks are preserved as found. Custom
syntax degrades gracefully in other editors.

## Core behaviours

### Tabs

- Tab strip runs across the top. No window title bar content beyond it.
- **Display name** follows the filename (D26):
  - Scratch notes still named by timestamp (`YYYY-MM-DD-HHmm.md`, with any
    `-2` suffix) show their **first line of content**, trimmed of leading `#`
    and whitespace, truncated to 24 characters. An empty one shows `untitled`.
  - Scratch notes you have renamed show **that name**, without `.md`,
    truncated to 24 characters.
  - Files opened from elsewhere show their **actual filename**, including
    extension.
  - The same names appear in the file tree and quick switcher.
- Active tab is marked with a 2px accent line along its top edge.
- Middle-click or the `×` closes. Closing does not prompt; the file is saved.
- Tab order is user-reorderable by drag and persists across restarts.

### New notes

1. User triggers "new note". A tab appears immediately with an empty buffer and
   focus in the editor. **No file is created yet.**
2. On the first keystroke, a file is created in the scratch folder named
   `YYYY-MM-DD-HHmm.md`. If that name is taken, append `-2`, `-3`, and so on.
3. The filename **never changes automatically** after that. The display name
   tracks the first line; the file on disk stays timestamped and sortable.
4. `F2`, or the rename command, renames the file. This is the only rename path.
   For a timestamp-named note it suggests a name made from the first line.
   Once renamed, the note shows its filename instead of its first line (D26).

Never prompt for a filename. Never auto-rename on heading edits.

### Saving

- Debounce **400ms** after the last document change.
- Additionally flush immediately on: tab switch, window blur, window close, app
  quit, and before any rename or external-change reload.
- Writes are atomic: write to `<name>.md.tmp` in the same directory, `fsync`,
  then rename over the target. A crash mid-write can never corrupt a note.
- A failed write surfaces in the status bar and must not be silent.
- The status bar's save slot is **empty while saves succeed**. `saving` appears
  only when a write has taken longer than 500ms. A failure names the file
  (`save failed: notes.txt: permission denied`), marks its tab with `!`, and
  stays until a save of that file succeeds.
- Closing a tab whose save fails leaves the tab open, so edits that aren't on
  disk are never dropped.

Because every buffer is always a current file on disk, there is no separate
crash-recovery mechanism and none should be built.

### Session

`session.json` is stored in the app's userData directory, **not** in the notes
folder. It holds open tab paths, tab order, active tab, and per-tab cursor and
scroll position. It never holds note content.

On launch, restore the previous session. A tab whose file no longer exists is
dropped silently.

### Folder context

- Defaults to the scratch folder.
- Switched via the folder name in the status bar (click), the overflow menu, or
  the command palette. Keeps a recent-folders list.
- Changing context does not close or affect any open tab.
- New notes always land in the **scratch folder**, never in the active context.

### File tree

- Hidden by default. Toggled from the toolbar icon or `Ctrl+B`.
- Lists `.md` and `.txt` files in the folder context, plus subdirectories.
- Below the file list, a **tag index**: every tag found in the context with an
  occurrence count. Clicking one filters to files containing it.
- Section labels are tracked uppercase with a count beside them (`NOTES 04`).
- Empty state when no folder is open: a short line and a button, never a blank
  panel.

### Status bar

Left to right: folder name (clickable, accent-coloured), save state, spacer,
line and column, word count, command palette button.

This bar is the primary discoverability surface. Treat it as load-bearing.

### Editing

Standard CodeMirror 6 keymap plus:

| Action | Binding |
| --- | --- |
| Move line up / down | `Alt+↑` / `Alt+↓` |
| Duplicate line | `Ctrl+Shift+D` |
| Indent / outdent | `Tab` / `Shift+Tab` |
| Multi-cursor | `Ctrl+Alt+↑/↓`, `Ctrl+D` |
| Toggle checkbox | `Ctrl+Enter` |
| Command palette | `Ctrl+Shift+P` |
| Quick switcher | `Ctrl+P` |
| Search in folder | `Ctrl+Shift+F` |
| Toggle file tree | `Ctrl+B` |
| New note | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Rename | `F2` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Insert date (`YYYY-MM-DD`) | palette only |
| Close tab | palette only (`Ctrl+W` belongs to Electron's menu) |

Every binding above is a command in the registry and appears in the palette
with its shortcut (D24). `Enter` and `Tab` are editor keys (D21).

**Auto-continue lists** is mandatory and not optional polish:

- `Enter` at the end of a list item starts the next item with the same marker
  and indentation. Applies to `-`, `*`, `1.` and `- [ ]`.
- `Enter` on an item that is empty apart from its marker deletes the marker and
  exits the list.
- Numbered lists increment.

Getting this wrong makes the whole app feel broken.

## Visual language

### Typography

- Editor and all UI: **IBM Plex Mono**, bundled, not fetched from a CDN.
- Editor body 13px, line-height 1.75.
- Headings scale but stay monospace: h1 18px, h2 15px, h3 13px, all weight 500.
- Section labels: 10px, uppercase, letter-spacing 0.1em.

### Shape

- **Square corners everywhere** — window, panels, tabs, inputs, buttons.
- The single exception: **tag pills are fully rounded**, making them the only
  soft shape on screen.
- Hairline borders (`--rule`) for separation, never surface-value-only
  separation. Visible rules read as technical; borderless panels read as web.

### Colour

- Accent (`--spot`) is used sparingly: active tab marker, active tree row,
  checked checkboxes, folder name in the status bar, tag pills.
- Everything else is on the neutral ramp. An agent given "orange accent" will
  over-apply it; resist this.

### Texture

- A dot field in the top-right of the window, fading out towards the left,
  drawn with the `--hatch` token. Roughly 10px grid, 1px dots.
- **Never behind body text.** Not behind the editor, not behind the file tree,
  not behind the tag list. Chrome and empty space only.
- Opacity is a theme token, and there is a settings toggle to disable texture.

### Rejected visual ideas

Do not reintroduce these; they were considered and dropped:

- Texture behind the file tree panel
- A capped, centred text column with visible gutters (the "sheet on a desk" look)
- A decorative accent rule across the top edge of the window
- Chrome that hides while typing and reveals on mouse move
- Rounded tabs or borderless surface-value separation

## Empty states

Specify and implement these; they are the first thing seen on a fresh install
and the most likely place for an agent to produce something embarrassing.

- **No tabs open**: centred, muted, a line of text and a "New note" button.
- **No folder context**: file tree shows a line and an "Open folder" button.
- **Search with no results**: the query echoed back, and nothing else.
- **Empty scratch folder**: the tree shows the folder name and an invitation.

Empty states are an invitation, not an apology. No "Nothing here yet."
