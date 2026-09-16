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
    codeString: '#A9B58F',
    codeLiteral: '#D2A874',
    codeName: '#94ABC6',
    hatch: 'rgba(255, 255, 255, 0.025)'
  },
  // First guess; tune by eye once tags render.
  tagColor: { saturation: 45, lightness: 65 },
  textureOpacity: 1
}
