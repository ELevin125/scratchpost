# Theming

Themes are data. Adding one is a new file in `src/renderer/themes/`, never a
code change.

The token names are borrowed from the author's portfolio site so that one
vocabulary describes both.

## The rule

> **No literal colour appears anywhere outside `src/renderer/themes/`.**

No hex values, no `rgb()`, no named CSS colours, in components, in the CM6
theme, or in any stylesheet. Everything reads a CSS custom property.

This is enforced by an ESLint rule (`no-restricted-syntax` matching colour
literals) with `src/renderer/themes/**` excluded. The rule exists because a
half-themed app is worse than an unthemed one, and colour literals leak in
quietly — especially into the CodeMirror theme object, which is the most likely
place for this to go wrong.

## Token set

```ts
interface Theme {
  name: string
  mode: 'light' | 'dark'
  colors: {
    paper: string        // editor background
    paper2: string       // chrome: tab strip, status bar, tree panel
    bar: string          // selected rows, inline code background
    ink: string          // headings, active text
    inkSoft: string      // muted text, list markers
    body: string         // editor body text
    spot: string         // accent
    spotTint: string     // accent wash
    rule: string         // hairline borders
    hatch: string        // dot field
  }
  tagPalette: string[]   // 6 hues for tag pills, hashed by tag text
  textureOpacity: number // 0 to 1, multiplied into hatch
}
```

Applied at runtime by writing each value to `document.documentElement.style` as
`--paper`, `--paper-2`, `--bar`, `--ink`, `--ink-soft`, `--body`, `--spot`,
`--spot-tint`, `--rule`, `--hatch`.

The CodeMirror theme in `editor/theme.ts` is built from the same object via
`EditorView.theme()`, reading the tokens rather than duplicating values.

## Shipped themes

### Nocturne (dark, default)

```
paper      #131416
paper2     #1C1E21
bar        #24272B
ink        #E4E1D8
inkSoft    #8B8C88
body       #C7C4BC
spot       #E0592F
spotTint   rgba(224, 89, 47, 0.08)
rule       #33363A
hatch      rgba(255, 255, 255, 0.025)
```

### Newsprint (light)

```
paper      #DFDCD2
paper2     #D5D1C6
bar        #CBC6B8
ink        #191A1C
inkSoft    #5A5B58
body       #2E2F30
spot       #BF3B1E
spotTint   rgba(191, 59, 30, 0.08)
rule       #B4B0A4
hatch      rgba(0, 0, 0, 0.045)
```

Both are cool-neutral greys with a warm cream ink and a vermilion spot. Do not
warm the greys; this was corrected once already.

## Typography

`IBM Plex Mono`, weights 400 and 500, **bundled with the app**. It is not
fetched from Google Fonts or any CDN — see the security posture in
`ARCHITECTURE.md`. Fallback chain: `ui-monospace, monospace`.

Font size is a user setting, defaulting to 13px, and scales the heading ramp
proportionally rather than using fixed pixel values throughout.

## Texture

The dot field is a single element, `aria-hidden`, absolutely positioned at the
top-right of the window:

- `radial-gradient(var(--hatch) 1px, transparent 1px)` at a 10px grid
- masked with `linear-gradient(to left, black, transparent 88%)`
- roughly 55% of window width, 76px tall
- `pointer-events: none`

It sits behind the tab strip and the top of the content area, and never behind
body text. `textureOpacity` scales it; a settings toggle removes it entirely.

## Accent discipline

`--spot` appears only on:

- the active tab's top marker
- the active file's left marker in the tree
- checked checkboxes
- the folder name in the status bar
- tag pills and links

Everything else is on the neutral ramp. When in doubt, do not use the accent.

## Adding a theme

1. Create `src/renderer/themes/<name>.ts` exporting a `Theme`.
2. Register it in `themes/index.ts`.
3. Verify contrast: body text on paper, muted text on paper, every entry in
   `tagPalette` on both `paper` and `paper2`.
4. No other file changes.
