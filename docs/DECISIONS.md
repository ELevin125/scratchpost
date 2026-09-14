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
game, and this is a text editor. Cold start is mitigated by the tray in M3.

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

## Open questions

Not yet decided. Do not guess; raise them.

- **Custom window frame on Windows.** Whether the tab strip sits in a custom
  title bar (consistent, more Electron config, breaks Windows snap conventions)
  or below the native one (less pretty, fewer surprises). Linux draws its own
  either way. Decide during task 1.1.
- **Tag colour palette size.** Six hues is a guess. Revisit once there are
  enough real tags to see collisions.
- **Texture opacity default.** Tuned by eye in a mockup; needs checking on the
  author's actual displays.
