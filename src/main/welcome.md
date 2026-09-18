# Welcome to Scratchpost

A nicer Notepad. That's the whole idea.

This is a plain-text scratchpad that happens to understand Markdown. Click on this heading and its `#` appears; click somewhere else and it goes away again. Keep typing and the Markdown stays out of your way, so you can write first and worry about formatting later.

## Try these

* [ ] Click this box to tick it, or press `Ctrl+Enter` on its line
* [ ] Press `Ctrl+P` and jump straight to a note by name
* [ ] Press `Ctrl+Shift+F` to search across all your notes
* [ ] Press `Ctrl+Shift+P` to open the command palette
* [ ] Right-click this note's pill at the top to rename, pin, or close it
* [ ] Select a word, then paste a URL to turn it into a link
* [ ] Select a word and press `Ctrl+B`, or right-click it for more formatting
* [ ] Press `Ctrl+L` to add a label like [idea]; set your usual labels in Settings

## Markdown, without the ceremony

**Bold**, *italic*, ~~struck through~~ and `inline code` all work as you'd expect, and quotes get a line down the side:

> Like this one.

[Links](https://commonmark.org/help/) open in your browser, and so does a URL you just paste in: https://commonmark.org/help/

Lists work normally, nested ones too:

* Just keep typing

  * and indent where you need to

* [x] Checked things stay checked

You rarely have to type the syntax yourself. `Ctrl+B` and `Ctrl+I` cover bold and italic, `Ctrl+1` to `Ctrl+3` make headings, and `Ctrl+Shift+8`, `Ctrl+Shift+9` or `Ctrl+Shift+7` turn whatever you're on into a bullet list, a checklist or a numbered list.

### Code gets a little help

Name a language after the fence and Scratchpost highlights it:

```js
const answer = 42;
console.log("hello, Scratchpost");
```

JavaScript, TypeScript, JSON, Python, CSS, HTML and shell are all included.

## Notes are just files

A new note becomes a file the moment you start typing, and its first line becomes the filename, so there's nothing to fill in before you write. Press `F2` later if it deserves a better name. Open a note, never type in it, and nothing is left behind.

Notes live in `Documents/Scratchpost` unless you move them in Settings. `Ctrl+O` opens a file from anywhere, and dragging a `.md` or `.txt` file onto the window works too. There's no database to maintain and no special format to export from: your notes are just files.

## A few useful tricks

### Tags and labels

Write #ideas and Scratchpost treats it as a tag, gathering every note that mentions it so you can find them together. Write [urgent] or [maybe] and you get a small coloured label that stays in this note and means nothing anywhere else. They look similar, but they do different jobs.

Click a label to hide everything else in the note, which is handy for a long list of [bug] and [idea] lines, and click it again to bring the rest back. Right-click one to rename it, here or in every note at once.

### History

Every note quietly keeps its own history on this computer. Click the clock at the bottom to look through older versions and see which lines changed, then bring one back if you want it. Changed your mind? `Ctrl+Z` undoes a restore like any other edit.

### Tabs

Select a few lines and press `Ctrl+Shift+N` to move them into a note of their own; the right-click menu can copy them instead.

Close a tab and `Ctrl+Shift+T` brings it back. Pin one if you want it to stay at the left, safe from **Close all tabs**. A note you keep returning to can also be pinned to the top of the notes list, whichever folder is open: right-click it and choose **Pin note to notes panel**. When you're finished with a note, archive it and Scratchpost moves it into an `archive` folder instead of throwing it away. Settings can also do that for you, for notes you haven't touched in a month or more.

### Working with other programs

Scratchpost watches your notes on disk. Change one somewhere else and it reloads here; if you'd been editing it too, you get to pick which version to keep. That also means syncing the folder between machines is fine.

## Make it yours

`Ctrl+,` opens Settings, where you can switch between light and dark, pick the colour everything else is built from, change the note text size and choose where new notes are kept. If a shortcut sits wrong under your fingers, **Keyboard shortcuts** will change it.

The cat is called Bean. Click for a purr, or use Settings to move Bean somewhere else, or turn Bean off if you'd rather write alone.

Everything runs offline and stays on your computer.

## One last thing

You don't need to remember any of this. If you forget a shortcut, press `Ctrl+Shift+P` and search for what you want to do, and if you ever close this note, the command palette has **Open welcome note**.

Now go write something.
