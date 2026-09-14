import type { Theme } from './types'

export const newsprint: Theme = {
  name: 'Newsprint',
  mode: 'light',
  colors: {
    paper: '#DFDCD2',
    paper2: '#D5D1C6',
    bar: '#CBC6B8',
    ink: '#191A1C',
    inkSoft: '#5A5B58',
    body: '#2E2F30',
    spot: '#BF3B1E',
    spotTint: 'rgba(191, 59, 30, 0.08)',
    rule: '#B4B0A4',
    hatch: 'rgba(0, 0, 0, 0.045)'
  },
  // Placeholder hues; not specified in THEMING.md.
  tagPalette: ['#A85A2A', '#8A7A1E', '#4E7A4A', '#3E6F85', '#6A5A96', '#94486A'],
  textureOpacity: 1
}
