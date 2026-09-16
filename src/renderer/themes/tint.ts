import type { Theme, ThemeMode } from './types'

// Every colour comes from one seed hue (D33). Surfaces stay close to the seed
// at low saturation; code colours sit at fixed offsets around it. Lightness
// values are chosen for contrast against `surface` and `sunken` in each mode.

const hue = (h: number) => ((Math.round(h) % 360) + 360) % 360
const hsl = (h: number, s: number, l: number, alpha?: number) =>
  alpha === undefined ? `hsl(${hue(h)} ${s}% ${l}%)` : `hsl(${hue(h)} ${s}% ${l}% / ${alpha})`

export function tintTheme(seed: number, mode: ThemeMode): Theme {
  const h = hue(seed)
  if (mode === 'light') {
    return {
      seed: h,
      mode,
      colors: {
        ground: hsl(h, 26, 84),
        glow: hsl(h + 40, 34, 76),
        surface: hsl(h, 30, 96, 0.88),
        raised: hsl(h, 28, 89),
        sunken: hsl(h, 22, 91),
        ink: hsl(h, 35, 12),
        body: hsl(h, 18, 22),
        soft: hsl(h, 12, 40),
        line: hsl(h, 18, 80),
        chip: hsl(h, 42, 26),
        chipInk: hsl(h, 30, 96),
        scrim: hsl(h, 30, 20, 0.22),
        selection: hsl(h, 45, 72, 0.5),
        codeString: hsl(h + 150, 45, 30),
        codeLiteral: hsl(h + 210, 55, 34),
        codeName: hsl(h + 60, 45, 32)
      },
      tagColor: { saturation: 50, lightness: 36 }
    }
  }
  return {
    seed: h,
    mode,
    colors: {
      ground: hsl(h, 38, 9),
      glow: hsl(h + 40, 40, 17),
      surface: hsl(h, 22, 14, 0.88),
      raised: hsl(h, 20, 21),
      sunken: hsl(h, 26, 7),
      ink: hsl(h, 25, 93),
      body: hsl(h, 12, 80),
      soft: hsl(h, 10, 58),
      line: hsl(h, 16, 26),
      chip: hsl(h, 45, 72),
      chipInk: hsl(h, 40, 11),
      scrim: hsl(h, 40, 4, 0.5),
      selection: hsl(h, 40, 40, 0.45),
      codeString: hsl(h + 150, 45, 76),
      codeLiteral: hsl(h + 210, 55, 76),
      codeName: hsl(h + 60, 45, 76)
    },
    tagColor: { saturation: 50, lightness: 72 }
  }
}
