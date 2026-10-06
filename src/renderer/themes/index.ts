import { tintTheme } from './tint'
import type { Theme, ThemeMode } from './types'

export type { Theme, ThemeMode }
export { tintTheme }

// The named seeds offered by "Change theme colour". Any hue works; these are
// the ones with a name. See D33.
export const seeds: { name: string; hue: number }[] = [
  { name: 'Teal', hue: 172 },
  { name: 'Slate', hue: 218 },
  { name: 'Plum', hue: 320 },
  { name: 'Rose', hue: 350 },
  { name: 'Ochre', hue: 38 },
  { name: 'Moss', hue: 95 }
]

// The hues a label or tag can be given in place of its seeded one (6.8).
// Saturation and lightness still come from the theme, as for every label.
export const labelHues: { name: string; hue: number }[] = [
  { name: 'Red', hue: 2 },
  { name: 'Orange', hue: 28 },
  { name: 'Yellow', hue: 50 },
  { name: 'Green', hue: 135 },
  { name: 'Teal', hue: 175 },
  { name: 'Blue', hue: 215 },
  { name: 'Purple', hue: 270 },
  { name: 'Pink', hue: 325 }
]

export const DEFAULT_SEED = 172
export const DEFAULT_MODE: ThemeMode = 'dark'

// chipInk -> --chip-ink, codeString -> --code-string
const toVar = (key: string) => '--' + key.replace(/([A-Z0-9])/g, '-$1').toLowerCase()

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.colors)) {
    root.style.setProperty(toVar(key), value)
  }
  root.style.setProperty('--tag-saturation', `${theme.tagColor.saturation}%`)
  root.style.setProperty('--tag-lightness', `${theme.tagColor.lightness}%`)
  root.style.colorScheme = theme.mode
  root.dataset.mode = theme.mode
}
