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
| Numbered | `1. text` | number retained, hanging indent |
| Checkbox, open | `- [ ] text` | empty square icon |
| Checkbox, done | `- [x] text` | filled check icon in `--spot`, text struck through in `--ink-soft` |
| Tag | `[word]` | rounded pill (see below) |
| Emphasis | `*text*` / `_text_` | italic, markers hidden |
| Strong | `**text**` | weight 500, markers hidden |
| Strikethrough | `~~text~~` | struck through, markers hidden |
| Inline code | `` `text` `` | `--bar` background, markers hidden |
| Link | `[label](url)` | label in `--spot`, underlined; URL and brackets hidden |

Headings 4 to 6 parse but render at the same size as h3. Do not add more sizes.

## Explicitly unsupported

Parsed as plain text, rendered with no decoration, never transformed:

- Tables
- Images (`![alt](src)`)
- Block quotes
- Fenced and indented code blocks
- Horizontal rules
- Reference-style link definitions
- HTML blocks and inline HTML
- Footnotes
- Nested lists beyond three levels of indentation

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

## Tags

### Pattern

```
/(?<![\w\]])\[([A-Za-z0-9][A-Za-z0-9._-]*)\](?![(\[])/
```

A tag is `[`, then a word, then `]`, where:

- The word contains **no spaces**. Letters, digits, `.`, `_` and `-` only, and
  must start with a letter or digit.
- It is **not followed by `(`** — that makes it a markdown link.
- It is **not followed by `[`** — that makes it a reference link.
- It is **not preceded by `]`** — the second half of a reference link.

### Why

The no-spaces rule prevents ordinary bracketed prose from turning into pills by
accident. The lookahead exclusions are what let tags and links coexist.

### Fixtures

| Input | Result |
| --- | --- |
| `[urgent]` | tag |
| `[in-progress]` | tag |
| `[v1.2]` | tag |
| `[the docs](https://x.com)` | link, not a tag |
| `[ref][1]` | reference link, not a tag |
| `[see the note below]` | plain text (spaces) |
| `- [ ] task` | checkbox, not a tag |
| `- [x] task` | checkbox, not a tag |
| `[-leading-dash]` | plain text (must start alphanumeric) |
| `[]` | plain text (empty) |

Checkbox handling takes precedence and is matched first, before the tag pass.

### Rendering

A fully rounded pill. Brackets hidden when the line has no cursor, shown when it
does, same as all other syntax.

Colour is assigned by hashing the tag text into a small palette defined per
theme, so `[urgent]` is consistently the same colour without configuration. The
palette must include enough contrast against `--paper` in both themes.

### Indexing

The tag index scans `.md` and `.txt` files in the folder context using the same
regex. Counts are occurrences, not files.

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

On `Tab` and `Shift+Tab` within a list item, indent or outdent by one level.
Numbered lists renumber within their level on indent change.

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
  markdown, no link auto-formatting.

## File handling

- Files are read and written as UTF-8.
- A leading byte-order mark is detected on read, stripped from the buffer, and
  re-emitted on write if it was present.
- Line endings are detected on read from the first occurrence, normalised to
  `\n` in the buffer, and converted back on write. Mixed-ending files adopt the
  first-seen ending throughout on save.
- `.txt` files are opened and rendered identically to `.md`. The extension has
  no effect on behaviour.
