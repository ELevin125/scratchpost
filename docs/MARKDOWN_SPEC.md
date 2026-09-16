# Markdown spec

This document is authoritative. If behaviour is not specified here, it is not
implemented. Do not infer support for a construct from its presence in
CommonMark.

Every fixture below has a corresponding test.

## Supported constructs

| Construct | Syntax | Rendered as |
| --- | --- | --- |
| Heading 1 | `# text` | 18px, weight 500, `--ink` |
| Heading 2 | `## text` | 15px, weight 500, `--ink` |
| Heading 3 | `### text` | 13px, weight 500, `--ink` |
| Bullet | `- text` / `* text` | `•` glyph in `--ink-soft`, hanging indent |
| Numbered | `1. text` | number shown, counts up automatically (see "List numbering"), hanging indent |
| Checkbox, open | `- [ ] text` | empty square icon |
| Checkbox, done | `- [x] text` | filled check icon in `--spot`, text struck through in `--ink-soft` |
| Label | `[word]` | rounded pill, brackets hidden (see "Labels and tags") |
| Tag | `#word` | coloured text, `#` kept, clickable (see "Labels and tags") |
| Emphasis | `*text*` / `_text_` | italic, markers hidden |
| Strong | `**text**` | weight 500, markers hidden |
| Strikethrough | `~~text~~` | struck through, markers hidden |
| Inline code | `` `text` `` | `--bar` background, markers hidden |
| Link | `[label](url)` | label in `--spot`, underlined; URL and brackets hidden |
| Block quote | `> text` | `>` markers hidden, hairline `--rule` left border |
| Fenced code block | ` ``` ` … ` ``` ` | `--bar` background, fences hidden, contents verbatim, highlighted for a few languages |
| Horizontal rule | `---` / `***` / `___` | hairline `--rule` across the line, characters hidden |

Headings 4 to 6 parse but render at the same size as h3. Do not add more sizes.

Lists render at any nesting depth. See D20 in `DECISIONS.md` for why block
quotes, fenced code blocks and horizontal rules moved into this table.

## Block constructs

### Block quotes

- Every line of the quote, including lazy continuation lines without `>`, gets
  a single hairline left border. Nested quotes (`>>`) still draw one hairline.
- The `>` markers and the space after them are hidden unless the line is
  revealed.
- Inline formatting and tags render inside quotes. Headings, lists and
  checkboxes inside quotes do **not** render; they stay plain text.

### Fenced code blocks

- Every line from the opening fence to the closing fence gets the `--bar`
  background, edge to edge.
- The fence markers and info string (` ```js `) are hidden unless that fence
  line is revealed. The fence lines keep their height; nothing collapses.
- Contents are verbatim: no markdown, no tags, no inline formatting.
- If the info string names a bundled language, the contents are syntax
  highlighted (see "Code highlighting"). Otherwise, **no highlighting**.

#### Code highlighting

Bundled languages, matched case-insensitively against the info string's name
or an alias:

| Language | Info strings |
| --- | --- |
| JavaScript | `javascript`, `js`, `jsx`, `mjs`, `cjs` |
| TypeScript | `typescript`, `ts`, `tsx`, `mts`, `cts` |
| JSON | `json`, `jsonc`, `json5` |
| Python | `python`, `py` |
| CSS | `css` |
| HTML | `html`, `htm` |
| Shell | `shell`, `sh`, `bash`, `zsh`, `console` |

Five token classes, and nothing else is coloured:

| Class | Covers | Rendered as |
| --- | --- | --- |
| keyword | keywords, modifiers, `this`/`self` | `--ink`, weight 500 |
| string | strings, regexps, attribute values | `--code-string` |
| literal | numbers, booleans, `null`, atoms | `--code-literal` |
| comment | comments | `--ink-soft`, italic |
| name | function, class, type and tag names | `--code-name` |

Highlighting never applies outside a fenced block, and never uses `--spot`.
See D32.
- An unclosed fence runs to the end of the document, as CommonMark parses it.

### Horizontal rules

- `---`, `***` or `___` on its own line, preceded by a blank line, renders as a
  hairline in `--rule` spanning the line. The characters are hidden unless the
  line is revealed.
- `---` directly under a line of text is a setext heading in CommonMark, not a
  rule. Setext headings are unsupported and render as plain text.

### Fixtures

```
> quoted              → hairline border, "> " hidden
> quo|ted             → hairline border, "> " VISIBLE
> # heading           → hairline border, "# heading" plain text
```js                 → tinted line, "```js" hidden
const a = 1           → tinted line, verbatim
```|                  → tinted line, "```" VISIBLE
---                   → hairline across the line, "---" hidden
text\n---             → plain text (setext heading, unsupported)
- a / - b / - c / - d → four nesting levels, all rendered as bullets
```

## Explicitly unsupported

Parsed as plain text, rendered with no decoration, never transformed:

- Tables
- Images (`![alt](src)`)
- Indented code blocks
- Setext headings
- Reference-style link definitions
- HTML blocks and inline HTML
- Footnotes

These must not throw, must not corrupt on save, and must round-trip unchanged.
A user pasting a table into a note should get a table back out of the file.

## Cursor reveal

The rule that makes live preview usable:

> Syntax characters are hidden **unless** the line contains a cursor or a
> selection endpoint. On such a line, all syntax is revealed and the line is
> styled but not collapsed.

Worked example, with `|` as the cursor:

```
## Heading            → renders as a 15px heading, "## " hidden
## Head|ing           → renders as a 15px heading, "## " VISIBLE
```

Details:

- "Contains a cursor" means any cursor or selection endpoint on that line
  number, including a collapsed selection.
- With multiple cursors, every line containing one is revealed.
- A selection spanning lines 3 to 7 reveals lines 3 and 7 only, not 4 to 6.
- Reveal changes visibility, never layout beyond the reflow it causes. Heading
  size does not change when revealed.
- A note opens **fully rendered**. Nothing reveals until the user acts in that
  tab: a click, a keystroke, a cursor move or an editing command. Otherwise
  the starting cursor line, usually the title, would always show its syntax.
  Opening a search result selects the match without revealing its line.

## Labels and tags

Two kinds of coloured word, split by D34 (which replaces the tag half of D27):

- A **label**, `[word]`, marks something inside one note. It is never indexed.
- A **tag**, `#word`, groups notes. The tag index collects it across the
  folder context, and clicking one shows every note that uses it.

Both take their colour from the word, so `[ideas]` and `#ideas` match.

### Label pattern

```
/(?<![\w\]])\[([A-Za-z0-9][A-Za-z0-9._-]*)\](?![(\[])/
```

A label is `[`, then a word, then `]`, where:

- The word contains **no spaces**. Letters, digits, `.`, `_` and `-` only, and
  must start with a letter or digit.
- It is **not followed by `(`** — that makes it a markdown link.
- It is **not followed by `[`** — that makes it a reference link.
- It is **not preceded by `]`** — the second half of a reference link.

The no-spaces rule keeps ordinary bracketed prose from turning into pills. The
lookahead exclusions let labels and links coexist. Checkbox handling takes
precedence and is matched first.

### Tag pattern

```
/(?<=^|[\s(])#([A-Za-z][A-Za-z0-9_\/-]*)/
```

A tag is `#` followed by a word, where:

- The word **starts with a letter**, so `#12` is not a tag, and `# Title` (with
  its space) stays a heading.
- It continues with letters, digits, `_`, `-` and `/` (`#project/site`). Any
  other character, such as a full stop, ends it.
- The `#` follows **whitespace, `(` or the line start**, so `C#`,
  `page#anchor` and `##double` are not tags.
- Known catch: a colour written as `#fff` is a tag.

### Fixtures

| Input | Result |
| --- | --- |
| `[urgent]` | label |
| `[in-progress]` | label |
| `[v1.2]` | label |
| `[the docs](https://x.com)` | link |
| `[ref][1]` | reference link |
| `[see the note below]` | plain text (spaces) |
| `- [ ] task` / `- [x] task` | checkbox |
| `[-leading-dash]`, `[]` | plain text |
| `#work` | tag |
| `(#inside)` | tag |
| `done #work.` | tag `work` |
| `#project/site` | tag `project/site` |
| `# Title #work` | heading containing tag `work` |
| `# Title` | heading, no tag |
| `issue #12` | plain text |
| `C#`, `page#anchor`, `##nope` | plain text |

### Rendering

- **Labels** are fully rounded pills. Brackets are hidden when the line has no
  cursor, and shown when it does, like all other syntax.
- **Tags** are coloured text at weight 500 with the `#` always visible and no
  pill, so the two never look alike. Clicking a tag on a line without a
  cursor filters the file tree to the notes that use it and opens the tree. On
  a line with a cursor, a click edits, as with links.
- Colour: a stable hash of the word picks a hue from 0 to 359; the theme
  supplies saturation and lightness. See `THEMING.md` and D16.
- Neither renders inside fenced, indented or inline code, HTML, or URLs.

### Indexing

The tag index scans `.md` and `.txt` files in the folder context for **tags
only**. Counts are occurrences, not files.

- Tags are case-insensitive: `#Urgent` and `#urgent` are one tag, with one
  colour, listed lowercase.
- Tags inside fenced and inline code are skipped (by text rules; main has no
  syntax tree).
- Clicking a tag in the tree, or in a note, filters the notes list to the
  files containing it. Clicking it again in the tree, or `×`, clears it.

See D27 and D34.

## List continuation

On `Enter`:

1. If the cursor is at the end of a list item with content, insert a newline
   followed by the same marker and indentation.
   - `- ` → `- `
   - `* ` → `* `
   - `- [ ] ` → `- [ ] ` (always unchecked, never carries `[x]` forward)
   - `1. ` → `2. `
2. If the current line is a list marker with no content after it, delete the
   marker, leaving an empty line, and do not insert a newline.
3. Otherwise, insert a plain newline.

On `Tab` and `Shift+Tab` within a list item, indent or outdent by one level:

- One level deeper puts the marker under the previous sibling's text
  (`- a` → children at 2 spaces, `1. a` → children at 3). The first item of a
  list has nothing to nest under and stays put.
- Outdent moves the item to its parent's indent, or to column 0.
- A numbered item indented into a new sub-list becomes `1.` of that sub-list.

Outside list items, `Tab` inserts two spaces at the start of each selected
line and `Shift+Tab` removes up to two. `Tab` never moves focus out of the
editor. See D21.

### List numbering

After any edit that touches a numbered list, its items renumber to count up
from the list's start. See D22.

- Moving, duplicating or deleting lines, pasting, and `Enter` mid-list all
  renumber.
- The start number survives structural edits. Typing on the first item's
  number changes it.
- Undo and redo restore exactly what was there, without renumbering.
- Items inside code fences are never renumbered.

```
"1. a|\n2. b\n3. c"  + move line down  →  "1. b\n2. a|\n3. c"
"1. a|\n2. b"        + duplicate line  →  "1. a\n2. a|\n3. b"
"1. a|\n2. b"        + Enter           →  "1. a\n2. |\n3. b"
"1. a\n2. b|\n3. c"  + Tab             →  "1. a\n   1. b|\n2. c"
"5|. a\n6. b"        + type "0"        →  "50. a\n51. b"
```

### Fixtures

```
"- foo|"       + Enter  →  "- foo\n- |"
"- |"          + Enter  →  "|"
"  - foo|"     + Enter  →  "  - foo\n  - |"
"- [ ] foo|"   + Enter  →  "- [ ] foo\n- [ ] |"
"- [x] foo|"   + Enter  →  "- [x] foo\n- [ ] |"
"1. foo|"      + Enter  →  "1. foo\n2. |"
"3. foo|"      + Enter  →  "3. foo\n4. |"
"plain|"       + Enter  →  "plain\n|"
"- foo|bar"    + Enter  →  "- foo\nbar"   (cursor not at end: plain newline)
```

## Checkbox toggling

`Ctrl+Enter`, a click on the rendered checkbox, or the toggle command flips
`- [ ]` to `- [x]` and back. Clicking the checkbox does not move the cursor.

## Copy and paste

- **Copying** yields the markdown source, not the rendered text. A copied
  heading pastes as `## Heading`.
- **Pasting** inserts plain text verbatim. No smart conversion, no HTML-to-
  markdown, no link auto-formatting, with one exception:
- **Pasting a URL onto a selection** makes a link: selecting `docs` and pasting
  `https://x.org` gives `[docs](https://x.org)`. It applies only when the
  clipboard holds a single `http`, `https` or `mailto` URL with no spaces and
  balanced parentheses, and the selection is one range on one line, contains
  no `[` or `]`, isn't itself a URL, and isn't inside code. A URL pasted with
  nothing selected is inserted verbatim. See D28 and D32.

## Typing helpers

Single cursor only; with several cursors, typing is plain. See D32.

### Auto-closing pairs

- Typing `(`, `[` or `` ` `` inserts its closer after the cursor, when the next
  character is whitespace, the end of the line, or one of ``)]}.,;:!?`*``.
- A `` ` `` doesn't pair after another `` ` `` or a word character, so fences
  type normally.
- Typing the second `*` of `**` inserts `**` after the cursor, when the
  character before the first `*` is whitespace, the line start, or an opening
  bracket or quote. Never inside code.
- Typing a closer the helper inserted steps over it. Closers are only tracked
  on the cursor's line; once the cursor leaves it, they are ordinary text.
- `Backspace` between a pair the helper just opened deletes both halves.
  `**|**` goes back to `*|`.
- A third `*` in an empty `**|**` gives `***|`, so rules type normally.
- Nothing pairs after a `\`.
- Typing `(`, `[`, `` ` `` or `*` with a selection on one line wraps it and
  keeps it selected, so `*` twice makes it bold.

### Fixtures

```
"|"        + type "("      →  "(|)"
"(a|)"     + type ")"      →  "(a)|"
"|word"    + type "("      →  "(|word"
"- |"      + type "[ ] a"  →  "- [ ] a|"
"|"        + type "```js"  →  "```js|"
"|"        + type "**b**"  →  "**b**|"
"|"        + type "***"    →  "***|"
"|"        + type "* a"    →  "* a|"
"a|"       + type "**"     →  "a**|"
"(|)"      + Backspace     →  "|"
"**|**"    + Backspace     →  "*|"
"a [word] b" selected, type "**"  →  "a **word** b", "word" still selected
```

## File handling

- Files are read and written as UTF-8.
- A leading byte-order mark is detected on read, stripped from the buffer, and
  re-emitted on write if it was present.
- Line endings are detected on read from the first occurrence, normalised to
  `\n` in the buffer, and converted back on write. Mixed-ending files adopt the
  first-seen ending throughout on save.
- `.txt` files are opened and rendered identically to `.md`. The extension has
  no effect on behaviour.
