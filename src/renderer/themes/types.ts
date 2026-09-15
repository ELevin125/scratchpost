export interface Theme {
  name: string
  mode: 'light' | 'dark'
  colors: {
    paper: string // editor background
    paper2: string // chrome: tab strip, status bar, tree panel
    bar: string // selected rows, inline code background
    ink: string // headings, active text
    inkSoft: string // muted text, list markers
    body: string // editor body text
    spot: string // accent
    spotTint: string // accent wash
    rule: string // hairline borders
    hatch: string // dot field
  }
  // Tag pill hue is seeded from the tag text; the theme fixes the rest so
  // every hue keeps contrast against paper and paper2. Percentages, 0 to 100.
  tagColor: { saturation: number; lightness: number }
  textureOpacity: number // 0 to 1, multiplied into hatch
}
