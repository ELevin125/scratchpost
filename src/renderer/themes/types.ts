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
  tagPalette: string[] // 6 hues for tag pills, hashed by tag text
  textureOpacity: number // 0 to 1, multiplied into hatch
}
