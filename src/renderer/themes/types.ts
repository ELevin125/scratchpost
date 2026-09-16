export type ThemeMode = 'light' | 'dark'

// A theme is generated from a seed hue and a mode; see tint.ts and D33.
export interface Theme {
  seed: number // hue, 0 to 359
  mode: ThemeMode
  colors: {
    ground: string // window background, behind the panels
    glow: string // soft light in the ground's gradient
    surface: string // panels, the top bar's pills, the dock
    raised: string // selected and hovered rows, the date block, inline code
    sunken: string // code blocks and input fields
    ink: string // titles, active text
    body: string // note text
    soft: string // muted text, list markers, times
    line: string // the few dividers left: menu separators, checkbox edges
    chip: string // the selected pill, checked checkboxes, links, the active dock button
    chipInk: string // text on chip
    scrim: string // dims the window behind an overlay
    selection: string // selected text
    codeString: string // strings in highlighted code
    codeLiteral: string // numbers, booleans and null in highlighted code
    codeName: string // function, class and type names in highlighted code
    catBelly: string // the cat's belly (3.9); its body is chip
    catInk: string // the cat's eyes, mouth, stripes and headphones
    catPink: string // the cat's ears, blush and headphone cushions
    catShine: string // the glint in the cat's eyes
    catGear: string // the cat's headphones, which sit against the ground
  }
  // Label and tag hues are seeded from the word; the theme fixes the rest so
  // every hue keeps contrast against the surface. Percentages, 0 to 100.
  tagColor: { saturation: number; lightness: number }
}
