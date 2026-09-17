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
by mouse through the top bar, the dock, a panel, a right-click menu, or the
command palette. The command palette displays each command's shortcut next to it, so it
doubles as the way shortcuts are learned.

A feature that exists only as a key binding is a feature the user will forget
exists. This has been explicitly requested.

### 3. Saving is not a user-facing concept

There is no Save command, no dirty indicator asking a question, no "unsaved
changes" dialog on quit. The note header reports save state as information,
not as a prompt.

### 4. It must feel like a desktop object, not an IDE

Calm tinted panels floating on a tinted ground, one colour family, soft shapes,
monospace notes, and a few things set large. It should look like nothing else
in the author's editor stack. See "Visual language" below, and D33, which
replaced the earlier square-and-hairline look.

### 5. Plain files, unmodified

A file Scratchpost opens and saves must be byte-identical apart from the edits
the user made. Line endings and byte-order marks are preserved as found. Custom
syntax degrades gracefully in other editors.

## Core behaviours

### Tabs

- Open notes are **pills** in the top bar, left of the find field. They are
  the tabs.
- **Display name** follows the filename (D26):
  - Scratch notes still named by timestamp (`YYYY-MM-DD-HHmm.md`, with any
    `-2` suffix) show their **first line of content**, trimmed of leading `#`
    and whitespace, truncated to 24 characters. An empty one shows `untitled`.
  - Scratch notes you have renamed show **that name**, without `.md`,
    truncated to 24 characters.
  - Files opened from elsewhere show their **actual filename**, including
    extension.
  - The same names appear in the file tree and quick switcher.
- The active pill is filled with `chip`.
- Middle-click or the `×` (shown on hover and on the active pill) closes.
  Closing does not prompt; the file is saved.
- Tab order is user-reorderable by drag and persists across restarts.
- **Pinned** tabs sit at the left with a pin and no `×`, and survive "Close
  other tabs" and "Close all tabs". Pinned state persists (D36).

### Right-click in a note

Cut, copy and paste; bold, italic, strikethrough, inline code, link and
"Insert label…"; headings 1 to 3 and normal text; bullet list, checklist and
numbered list. Right-clicking outside the selection moves the cursor there
first, so word commands act on the clicked word. Every entry is a registry
command with its shortcut shown (4.9).

### Pinned notes

"Pin note to notes panel" (right-click a note or its pill, or the palette)
keeps a note at the top of the notes panel under "Pinned", whichever folder is
open. Pinned notes leave the recent list; renaming or archiving keeps the pin,
deleting removes it. Stored as paths in `settings.json` (4.7).

### Archive

"Archive note" moves a note into an `archive` folder beside it and closes its
tab; "Move out of archive" moves it back. Archived notes leave the recent list
but stay findable everywhere else. Nothing is ever overwritten (D36).

### History

Each note keeps versions on this machine (D38). "Note history…" opens a panel:
versions by day on the left, the selected one on the right with the lines that
differ from the note now marked. "Restore this version" replaces the text as
one undoable edit; "Copy text" leaves the note alone.

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
- A failed write surfaces in the note header and must not be silent.
- The header's save slot is **empty while saves succeed**. `saving` appears
  only when a write has taken longer than 500ms. A failure names the file
  (`save failed: notes.txt: permission denied`), marks its pill with `!`, and
  stays until a save of that file succeeds.
- Closing a tab whose save fails leaves the tab open, so edits that aren't on
  disk are never dropped.

Because every buffer is always a current file on disk, there is no separate
crash-recovery mechanism and none should be built.

### Changes from outside

The folder is often synced from another machine, so notes change underneath
the app (D35):

- An open note with nothing unsaved reloads silently, cursor kept.
- An open note with unsaved edits is never overwritten. A bar above it offers
  "Keep mine" or "Load disk version", and saving waits for the choice.
- A note deleted on disk stays open and marked; typing saves it again.
- The notes and tags panels follow changes in the folder.

### Session

`session.json` is stored in the app's userData directory, **not** in the notes
folder. It holds open tab paths, tab order, active tab, and per-tab cursor and
scroll position. It never holds note content.

On launch, restore the previous session. A tab whose file no longer exists is
dropped silently.

### Folder context

- Defaults to the scratch folder.
- Switched via the folder name at the top of the notes panel, the dock's
  folder button, or the command palette. Keeps a recent-folders list.
- Changing context does not close or affect any open tab.
- New notes always land in the **scratch folder**, never in the active context.

### Notes panel

- The left column (D33). Shown by default; toggled from the dock or `Ctrl+Shift+B`.
- Headed by the folder name, which opens the folder menu, and a home button
  when the context isn't the scratch folder.
- The scratch folder shows its six most recent notes, with "Show all" for the
  full tree, newest first. Other folders show their tree in name order.
- Lists `.md` and `.txt` files in the folder context, plus subdirectories.
- Below it, a **tags panel**: every `#tag` found in the context with an
  occurrence count. Clicking one, here or in a note, filters the notes panel
  to files containing it. `[labels]` are not indexed (D34).
- Empty state when no folder is open: a short line and an "Open folder"
  button, never a blank panel.

### Note header and dock

The status bar is gone (D33). Its jobs moved:

- **Note header**, above the text: the note's folder, when it was last edited,
  its word count, and a save problem if there is one. On the right, the note's
  date set large: the day a timestamp-named note was created, otherwise the
  day it last changed. The date floats beside the text column so it never
  pushes the note down, and hides when the window is too narrow for it.
- **Dock**, floating at the bottom of the note panel: notes panel, folder
  search, note history, open file, switch folder; then settings and the
  command palette. Light or dark mode and the theme colour live in Settings
  and the palette. Every button's tooltip is its command's label and
  shortcut.
- **Toasts**, above the dock, for notices that aren't about saving. They
  dismiss themselves.

### The cat

A round cat perches on the dock and naps in the empty state (D37). It idles,
now and then puts on headphones and headbangs, yawns, grooms, looks around or
naps, hops when a checklist is finished, purrs when clicked, and stretches
when you type `meow`. It never makes a sound, never talks, and pauses while
the window is hidden. On by default; Settings has a switch.

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
| Toggle notes panel | `Ctrl+Shift+B` |
| Bold / italic / strikethrough | `Ctrl+B` / `Ctrl+I` / `Ctrl+Shift+X` |
| Inline code / link | `Ctrl+E` / `Ctrl+K` |
| Insert label | `Ctrl+L` |
| Heading 1–3 / normal text | `Ctrl+1`–`Ctrl+3` / `Ctrl+0` |
| Bullet list / checklist / numbered list | `Ctrl+Shift+8` / `Ctrl+Shift+9` / `Ctrl+Shift+7` |
| Settings | `Ctrl+,` |
| New note | `Ctrl+N` |
| Open file | `Ctrl+O` |
| Rename | `F2` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` (also `Ctrl+Y`) |
| Find in note | `Ctrl+F`, then `F3` / `Shift+F3` |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| Close tab | `Ctrl+W` |
| Reopen closed tab | `Ctrl+Shift+T` |
| Insert date (`YYYY-MM-DD`) | palette only |
| Delete note, show in file manager, copy path | palette and right-click menus |
| Pin tab, close other tabs, close all tabs | palette and right-click menus |
| Archive note, move out of archive | palette and right-click menus |
| Note history | palette, pill menu and dock |

Every binding above is a command in the registry and appears in the palette
with its shortcut (D24). All of them can be changed under "Keyboard
shortcuts…" in Settings or the palette (D41). `Enter` and `Tab` are editor keys (D21).

**Auto-continue lists** is mandatory and not optional polish:

- `Enter` at the end of a list item starts the next item with the same marker
  and indentation. Applies to `-`, `*`, `1.` and `- [ ]`.
- `Enter` on an item that is empty apart from its marker deletes the marker and
  exits the list.
- Numbered lists increment.

Getting this wrong makes the whole app feel broken.

## Visual language

See D33 for why, and `THEMING.md` for the tokens.

### Layout

- A tinted ground with a soft glow, 10px of it around and between everything.
- Top bar: open-note pills, then the find field and a round new-note button on
  the right.
- Below it, the notes and tags panels on the left (240px) and the note panel
  filling the rest, with the dock floating at its bottom.
- Note text is capped at 80 characters, left-aligned in the note panel.

### Typography

- Note text: **IBM Plex Mono** 13px, line-height 1.75.
- Headings in notes: h1 30px and h2 19px in **IBM Plex Sans Condensed** 600;
  h3 and below 13px mono at weight 500.
- App labels, buttons and menus: **IBM Plex Sans**. Times, counts and
  shortcuts: mono 11px.
- All bundled, never fetched from a CDN.

### Shape

- Rounded panels (20 to 24px), rows and inputs (10 to 14px), fully round
  buttons, pills and chips.
- Separation by space and tint. Borders are almost gone; the few left use
  `line`.

### Colour

- One seed hue generates everything; light and dark modes; no fixed accent.
- `chip` is the only strong colour: the active pill, selected overlay rows,
  checked checkboxes, links, the pressed dock button.
- Tags and labels carry their own word-seeded hue.

### Icons

- One bundled set of 20-unit line icons (`app/Icon.tsx`), stroked in the text
  colour. No text-only buttons in the chrome.
- Every icon button has a tooltip with the command's label and shortcut.

### Rejected visual ideas

Do not reintroduce these; they were considered and dropped:

- A dot texture (2.11); the tinted ground replaced it
- A decorative accent rule across the top edge of the window
- Chrome that hides while typing and reveals on mouse move
- An icon rail beside a file list (reads as VS Code; D33)
- Note cards as the main navigation (too much room for notes rarely revisited)
- Real window translucency (not available on Linux)

## Empty states

Specify and implement these; they are the first thing seen on a fresh install
and the most likely place for an agent to produce something embarrassing.

- **No tabs open**: centred in the note panel: a large "Start a note.", a
  muted line, a "New note" button and four key hints.
- **No folder context**: the notes panel shows a line and an "Open folder"
  button.
- **Search with no results**: the query echoed back, and nothing else.
- **Empty scratch folder**: the notes panel shows the folder name and an
  invitation.

Empty states are an invitation, not an apology. No "Nothing here yet."
