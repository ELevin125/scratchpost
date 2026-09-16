# Theming

A theme is **a seed hue and a mode**. Every colour in the app is generated
from those two values by `src/renderer/themes/tint.ts`. There are no
hand-picked theme files and no fixed accent colour. See D33.

## The rule

> **No literal colour appears anywhere outside `src/renderer/themes/`.**

No hex values, no `rgb()` or `hsl()` with literal numbers, no named CSS
colours, in components, in the CM6 theme, or in any stylesheet. Everything
reads a CSS custom property. The two exceptions are hue-seeded words and
swatches, which build `hsl(var(--tag-hue) …)` from custom properties only.

This is enforced by an ESLint rule (`no-restricted-syntax` matching colour
literals) with `src/renderer/themes/**` excluded. The rule exists because a
half-themed app is worse than an unthemed one, and colour literals leak in
quietly, especially into the CodeMirror theme object.

## Token set

```ts
type ThemeMode = 'light' | 'dark'

interface Theme {
  seed: number           // hue, 0 to 359
  mode: ThemeMode
  colors: {
    ground: string       // window background, behind the panels
    glow: string         // soft light in the ground's gradient
    surface: string      // panels, the top bar's pills (slightly translucent)
    raised: string       // selected and hovered rows, overlays, menus, the dock
    sunken: string       // code blocks, inline code, input fields
    ink: string          // titles, active text
    body: string         // note text
    soft: string         // muted text, list markers, times
    line: string         // the few dividers left, scrollbar thumbs
    chip: string         // selected pill, checked checkbox, links, active dock button
    chipInk: string      // text on chip
    scrim: string        // dims the window behind an overlay; shadows
    selection: string    // selected text and search matches
    codeString: string   // highlighted code
    codeLiteral: string
    codeName: string
  }
  tagColor: {            // percentages, 0 to 100
    saturation: number
    lightness: number
  }
}
```

Applied at runtime by `applyTheme` writing each value to
`document.documentElement.style` as `--ground`, `--glow`, `--surface`,
`--raised`, `--sunken`, `--ink`, `--body`, `--soft`, `--line`, `--chip`,
`--chip-ink`, `--scrim`, `--selection`, `--code-string`, `--code-literal`,
`--code-name`, plus `--tag-saturation` and `--tag-lightness`. The root also
gets `color-scheme` and `data-mode`.

## How colours are generated

All values are HSL around the seed hue `h`:

| Token | Dark | Light |
| --- | --- | --- |
| ground | `h 38% 9%` | `h 26% 84%` |
| glow | `h+40 40% 17%` | `h+40 34% 76%` |
| surface | `h 22% 14% / 0.88` | `h 30% 96% / 0.88` |
| raised | `h 20% 21%` | `h 28% 89%` |
| sunken | `h 26% 7%` | `h 22% 91%` |
| ink | `h 25% 93%` | `h 35% 12%` |
| body | `h 12% 80%` | `h 18% 22%` |
| soft | `h 10% 58%` | `h 12% 40%` |
| line | `h 16% 26%` | `h 18% 80%` |
| chip | `h 45% 72%` | `h 42% 26%` |
| chipInk | `h 40% 11%` | `h 30% 96%` |
| scrim | `h 40% 4% / 0.5` | `h 30% 20% / 0.22` |
| selection | `h 40% 40% / 0.45` | `h 45% 72% / 0.5` |
| codeString | `h+150 45% 76%` | `h+150 45% 30%` |
| codeLiteral | `h+210 55% 76%` | `h+210 55% 34%` |
| codeName | `h+60 45% 76%` | `h+60 45% 32%` |
| tag saturation, lightness | 50%, 72% | 50%, 36% |

Saturation stays low on surfaces so any hue reads as a tinted neutral.
Lightness carries the contrast, so it holds for every seed.

## Seeds

The default is teal (172) in dark mode. "Change theme colour" and Settings
offer the named seeds in `themes/index.ts`: Teal 172, Slate 218, Plum 320,
Rose 350, Ochre 38 and Moss 95. Settings also has a slider for any hue.

The mode is `light`, `dark` or `system`; `system` follows the OS through
`prefers-color-scheme` and switches live. "Switch to light/dark mode" always
sets an explicit mode. Both are saved in `settings.json` as
`theme: { seed, mode }`.

## Where colour appears

- **chip** is the only strong colour: the active note pill, the selected row in
  overlays and menus, checked checkboxes, links, and the pressed dock button.
- **Tag and label words** carry their own hue (below).
- **Code** uses the three code tokens plus `ink` (keywords) and `soft`
  (comments).
- Everything else is the tinted neutral ramp: ground, surface, raised, sunken,
  ink, body, soft, line.

## Label and tag colours

There is no fixed palette. A stable hash of the word picks a hue from 0 to
359, set on the element as `--tag-hue`. The colour is
`hsl(var(--tag-hue) var(--tag-saturation) var(--tag-lightness))`; label pills
and tag chips use the same colour at low alpha as their background. See D16
and D34.

## Code highlighting

Fenced code in a bundled language uses five classes (see `MARKDOWN_SPEC.md`).
Keywords use `ink` at weight 500 and comments `soft` in italic; strings,
literals and names use the three code tokens. They must hold contrast on
`sunken`. See D32.

## Typography

All bundled with the app, never fetched:

- **IBM Plex Mono** 400, 500 and 400 italic: note text, times, counts,
  shortcuts. Fallback `ui-monospace, monospace`.
- **IBM Plex Sans** 400 and 500: the app's own labels, buttons and menus.
  Fallback `system-ui, sans-serif`.
- **IBM Plex Sans Condensed** 600: the h1 and h2 headings in notes, the empty
  state title and the date block.

Exposed as `--font-mono`, `--font-sans` and `--font-title`. Note text size is
a setting from 10 to 24px, default 13px, applied as `--note-size`; heading
sizes and the 80-character cap are in em and ch, so they scale with it.

## Shape

Panels 20 to 24px radius, rows and inputs 10 to 14px, buttons and chips fully
round. The ground's gradient replaces the dot texture (2.11 was dropped).
