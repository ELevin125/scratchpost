import { newsprint } from './newsprint'
import { nocturne } from './nocturne'
import type { Theme } from './types'

export type { Theme }

export const themes: Theme[] = [nocturne, newsprint]
export const defaultTheme = nocturne

// paper2 -> --paper-2, inkSoft -> --ink-soft
const toVar = (key: string) => '--' + key.replace(/([A-Z0-9])/g, '-$1').toLowerCase()

export function applyTheme(theme: Theme): void {
  const style = document.documentElement.style
  for (const [key, value] of Object.entries(theme.colors)) {
    style.setProperty(toVar(key), value)
  }
  style.setProperty('--tag-saturation', `${theme.tagColor.saturation}%`)
  style.setProperty('--tag-lightness', `${theme.tagColor.lightness}%`)
  style.setProperty('--texture-opacity', String(theme.textureOpacity))
  style.colorScheme = theme.mode
}
