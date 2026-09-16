# Design review (2.22)

Done on 2026-09-16 against the built app, in both themes, at 1280 and 560
pixels wide. Each finding is fixed, or handed to a decision and a task.

The overall finding: the layout (tabs, sidebar, status bar, palette) is sound,
but the finish reads as VS Code, and the chrome is as loud as the note. Four
redesign directions were mocked; the author chose Tint (D33).

## Fixed in 2.22

| Finding | Fix |
| --- | --- |
| A note opens with its first line revealed, so the title always shows `#` | Nothing reveals until a user event in that tab (`revealArmed`; `MARKDOWN_SPEC.md`, "Cursor reveal") |
| With no tabs open, the status bar still shows the last note's line, column and words | Hidden when no tab is open |
| Faint stripes between code block lines, visible in Newsprint | Each code line's tint extends 1px down over the sub-pixel gap |
| The browser's autocomplete dropdown appears under the search field | `autoComplete="off"` on every overlay input |
| The palette lists "Command palette" as its own first entry | Filtered out; the shortcut is on the status bar button |
| `[word]` did double duty as an in-note marker and a cross-note tag | Split into labels and `#tags` (D34, task 2.25) |

## Handed to Tint (D33)

| Finding | Where |
| --- | --- |
| Boxed tabs with dividers and a permanent `×` look like VS Code | 2.24, open notes as pills |
| `≡`, `+` and "Open" mix a glyph, a symbol and a word | 2.24, one icon set with tooltips |
| `Ln 1, Col 12` is IDE noise in a notes app | 2.24, the status bar goes; word count moves to the meta line |
| Text runs the full window width, about 140 characters at 1280 pixels | 2.24, text capped at about 64 characters |
| Orange marks too many things, and reads as a warning next to red-ish tags | 2.23, seed-hue themes with no fixed accent |
| Nothing is uniquely Scratchpost; the texture was the only planned signature | 2.23, the tinted ground; 2.11 dropped |
| The native title bar is the heaviest thing on screen on Zorin | D33 open question, decided in 2.24 |
| Section headers and cramped 3px rows look like VS Code's Explorer | 2.24, notes and tags panels |
| Headings barely stand out from body text | 2.24, a large condensed title |
| The default Chromium scrollbar is unthemed | 2.24 |
| Overlays sit on full-contrast text with only a hairline edge | 2.26, rounded panels over a dimmed editor |
| Overlay lists cut off mid-row | 2.26 |

## Checked and fine

- Accent use matches `THEMING.md` (moot once D33 lands).
- Newsprint holds contrast, including the code colours on `--bar`.
- Empty state copy ("Start a note. It saves itself.").
- Right-click menus and search results are readable.
- Hidden code fence lines keep their height, as the spec requires; it reads as
  padding, which is acceptable.
