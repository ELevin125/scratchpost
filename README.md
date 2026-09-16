# Scratchpost

A single-window markdown scratchpad. Tabs across the top, wall of text below,
nothing else in the way. It saves constantly and silently, renders headings,
bullets and tags inline as you type, and opens any file from anywhere on disk.

It is a nicer Notepad, not a knowledge base.

## Why it exists

Notes get left open in unsaved tabs for days. Notepad handles that habit but
won't render markdown live. Obsidian renders live but wants a vault and brings a
second brain along with it. Scratchpost is the narrow middle: live markdown,
real files, no vault, no plugins, no ceremony.

## Status

Pre-implementation. The design is settled; nothing is built yet.
See `docs/IMPLEMENTATION_PLAN.md` for the milestone breakdown.

## Stack

- **Electron** — main process in TypeScript, no Rust or Go toolchain required
- **CodeMirror 6** — editor, markdown parsing, live-preview decorations
- **TypeScript** throughout, both processes
- **electron-vite** — dev server and build
- **electron-builder** — AppImage and `.deb` for Linux, NSIS for Windows
- **Vitest** — unit and decoration tests

## Documentation

| File | What's in it |
| --- | --- |
| `docs/DESIGN.md` | Goals, non-goals, principles, UX behaviour, visual language |
| `docs/ARCHITECTURE.md` | Process split, module layout, IPC surface, persistence |
| `docs/MARKDOWN_SPEC.md` | Exactly which syntax renders and how it behaves at the cursor |
| `docs/THEMING.md` | Token system, the two shipped themes, the colour lint rule |
| `docs/IMPLEMENTATION_PLAN.md` | Numbered tasks with acceptance criteria, grouped by milestone |
| `docs/DECISIONS.md` | Choices made, alternatives rejected, and why |
| `CLAUDE.md` | Conventions and constraints for agents working in this repo |

Read `DESIGN.md` and `DECISIONS.md` before proposing changes to either.


## Building installers

Node 22 or newer, then `npm ci`.

- `npm run dist:win` builds `dist/Scratchpost Setup <version>.exe` (NSIS). On
  Linux this needs Wine.
- `npm run dist:linux` builds an AppImage and a `.deb`.

Both register `.md` and `.txt` so notes can be opened with Scratchpost.
