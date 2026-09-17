<div align="center">
  <img src="build/icon.png" alt="" width="120">
  <h1>Scratchpost</h1>
  <p><strong>A small, single-window Markdown scratchpad for people who just want to write things down.</strong></p>
  <p>Notes as tabs across the top, the editor below. Markdown renders as you type, changes save themselves, and any file on your computer can be opened.</p>
  <img src="docs/screenshots/dark.png" alt="Scratchpost in dark mode" width="920">
</div>

## Why Scratchpost?

There are plenty of good note-taking apps, but most of them are built around managing notes.

Scratchpost isn't.

It's for the note you leave open for a few days, the text file you keep coming back to, and the bit of Markdown you don't want to turn into a whole project.

It works with normal `.md` and `.txt` files. No vaults, databases, plugins, accounts or sync services. Open a file and start writing.

## Writing in it

Headings, lists, checklists, links, quotes and code render straight in the editor, and the Markdown syntax only shows on the line you're working on. Fenced code blocks are highlighted for JavaScript, TypeScript, JSON, Python, CSS, HTML and shell.

You don't have to type the syntax. `Ctrl+B` and `Ctrl+I` handle bold and italic, `Ctrl+1` to `Ctrl+3` set headings, and `Ctrl+Shift+8`, `9` and `7` turn whatever you're on into a bullet list, a checklist or a numbered list. Right-click in a note for the same things. If a shortcut sits wrong under your fingers, change it under Keyboard shortcuts in Settings.

Two kinds of words get their own colour, taken from the word itself. A `#tag` collects notes: every tag in the folder shows up in the tags panel, and clicking one filters the list. A `[label]` stays where you wrote it, useful for marking a line as `[bug]` or `[idea]` without it meaning anything elsewhere. `Ctrl+L` inserts one from your own list of labels.

## Keeping track of things

New notes save themselves from the first keystroke and take their name from the first line. Notes you never typed in leave nothing behind.

`Ctrl+P` jumps to a note by name, `Ctrl+Shift+F` searches inside all of them, and `Ctrl+Shift+P` opens the command palette, which lists everything the app can do along with its shortcut. Notes you keep coming back to can be pinned to the top of the list, whatever folder is open, and ones you're done with can be archived into an `archive` folder beside them.

Every note also keeps a history on your computer. You can look through older versions, see which lines changed, and bring one back; `Ctrl+Z` undoes the restore if you change your mind.

![Version history](docs/screenshots/history.png)

Because notes are ordinary files, other programs can change them. Scratchpost notices and reloads the note; if you'd been editing it too, it asks which version to keep. That makes syncing the folder between machines safe enough.

## Running from source

You'll need Node.js 22 or newer.

```bash
npm ci
npm run dev
```

The usual checks are `npm run typecheck`, `npm run lint` and `npm run build`.

## Building installers

`npm run dist:win` builds `dist/Scratchpost Setup <version>.exe`, a NSIS installer. Building it on Linux needs Wine.

`npm run dist:linux` builds an AppImage and a `.deb` in `dist/`.

Both register Scratchpost for `.md` and `.txt` files, so notes can be opened from your file manager. They're unsigned, so Windows SmartScreen warns the first time you run one. To update an installed copy, run the new installer over it; your notes, settings and history are kept.

## Tech stack

* [Electron](https://www.electronjs.org/) — desktop application and main/renderer processes
* [React](https://react.dev/) — UI
* [CodeMirror 6](https://codemirror.net/) — editor and Markdown support
* [electron-vite](https://electron-vite.org/) — development and builds
* [electron-builder](https://www.electron.build/) — application packaging
* [chokidar](https://github.com/paulmillr/chokidar) — filesystem watching

IBM Plex fonts are bundled with the application. Scratchpost makes no network requests at all, and everything it saves stays on your computer.
