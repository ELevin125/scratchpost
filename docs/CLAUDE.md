# Working on Scratchpost

Read this before starting. Read `docs/DESIGN.md` and `docs/DECISIONS.md` before
proposing anything not already in the plan.

## What this is

A single-window markdown scratchpad. Electron + TypeScript + CodeMirror 6.
Deliberately small. See `README.md`.

## How to work

**Follow `docs/IMPLEMENTATION_PLAN.md` in order.** Tick each box when its
acceptance criteria pass. Do not skip ahead, and do not batch several tasks into
one change — each task is sized to be reviewed on its own.

**Scope first, then write code.** Before implementing a task, state briefly what
you are about to do and what you will touch. Wait for confirmation. This is a
standing preference, not a formality.

**Ask rather than infer.** If a task seems to require something not specified,
stop and ask. The specs are deliberately detailed; a gap is more likely an
oversight worth surfacing than an invitation to improvise.

**Do not add features.** `docs/DESIGN.md` has a non-goals list and
`IMPLEMENTATION_PLAN.md` has an exclusions list. Feature creep is the main risk
to this project. If something seems obviously missing, raise it; do not build it.

## Hard rules

1. **No colour literals outside `src/renderer/themes/`.** No hex, no `rgb()`, no
   named colours, in components, stylesheets, or the CodeMirror theme object.
   Everything reads a CSS custom property. This is lint-enforced.

2. **No remote content, ever.** No CDN fonts, no analytics, no update checks, no
   remote images. The app makes zero network requests. This is what makes
   Electron acceptable here.

3. **No key binding outside the command registry.** Every action is registered
   once in `renderer/app/state/commands.ts`. The keymap, palette, toolbar and
   menus all read from it. A keyboard-only feature is a bug.

4. **Never normalise file bytes.** Line endings and BOMs are detected on read
   and restored on write. A file must round-trip byte-identical apart from the
   user's edits.

5. **Writes are atomic.** Always tmp-then-rename. Never write in place.

6. **No browser storage.** No `localStorage`, no `sessionStorage`, no IndexedDB.
   State goes to disk through the preload API.

7. **Main process holds no document state.** It reads and writes bytes and
   watches directories. Buffers, tabs, cursors and markdown live in the renderer.

## Testing

Two categories, both required before a task is done:

- **Pure logic** — display-name derivation, list continuation, tag regex,
  filename generation and collisions, EOL and BOM round-trips.
- **Decorations** — build an `EditorState`, apply a document and a selection,
  assert on the resulting `DecorationSet`. Runs headlessly.

Every fixture in `docs/MARKDOWN_SPEC.md` has a test. Live preview is the most
regression-prone code in the project and is not testable by eye.

Run `npm run lint` and `npm run test` before ticking any box.

## Conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Functional React components and hooks. No class components.
- Prefer pure functions in `state/` modules; keep React components thin.
- Filenames: `camelCase.ts` for modules, `PascalCase.tsx` for components.
- Commits reference the task number: `1.5 autosave scheduler`.
- Keep modules small. If `livePreview.ts` exceeds ~200 lines, split it.

## The part most likely to go wrong

Live preview. The mechanism is in `docs/ARCHITECTURE.md`; the behaviour is in
`docs/MARKDOWN_SPEC.md`. The critical detail is that syntax characters are
hidden **except** on lines containing a cursor or selection endpoint. Without
that reveal, the editor is unusable. Implement it deliberately, test it
directly, and do not optimise it before it is correct.

The second most likely: colour literals leaking into the CodeMirror theme
object. Lint catches it; do not silence the rule.

## Keeping docs current

If an implementation detail changes a documented behaviour, update the doc in
the same change. If a decision is reversed, add an entry to `docs/DECISIONS.md`
rather than editing the old one — the history is the point.

The open questions at the bottom of `DECISIONS.md` are genuinely open. Raise
them when the relevant task comes up; do not resolve them silently.
