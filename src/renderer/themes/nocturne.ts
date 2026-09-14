import type { Theme } from './types'

export const nocturne: Theme = {
  name: 'Nocturne',
  mode: 'dark',
  colors: {
    paper: '#131416',
    paper2: '#1C1E21',
    bar: '#24272B',
    ink: '#E4E1D8',
    inkSoft: '#8B8C88',
    body: '#C7C4BC',
    spot: '#E0592F',
    spotTint: 'rgba(224, 89, 47, 0.08)',
    rule: '#33363A',
    hatch: 'rgba(255, 255, 255, 0.025)'
  },
  // Placeholder hues; not specified in THEMING.md.
  tagPalette: ['#D4834E', '#C9B458', '#7FAE7A', '#6FA3B8', '#9A88C4', '#C47A9A'],
  textureOpacity: 1
}
