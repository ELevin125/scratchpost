import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Settings } from '../preload/api'
import { writeTextFile } from './fs/write'

// settings.json lives in userData beside session.json. Task 3.4 adds the
// settings UI and the rest of its fields. See ARCHITECTURE.md.

export const MAX_RECENT_FOLDERS = 8
const DEFAULT_SEED = 172 // teal; matches themes/index.ts

const settingsPath = () => join(app.getPath('userData'), 'settings.json')

// Never trusts the file or the renderer.
export function sanitizeSettings(value: unknown): Settings {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>
  const folderContext =
    typeof raw.folderContext === 'string' && raw.folderContext !== '' ? raw.folderContext : null
  const recentFolders = Array.isArray(raw.recentFolders)
    ? [...new Set(raw.recentFolders.filter((p): p is string => typeof p === 'string' && p !== ''))].slice(
        0,
        MAX_RECENT_FOLDERS
      )
    : []
  const theme = (typeof raw.theme === 'object' && raw.theme !== null ? raw.theme : {}) as Record<string, unknown>
  const seed =
    typeof theme.seed === 'number' && Number.isFinite(theme.seed) ? ((Math.round(theme.seed) % 360) + 360) % 360 : DEFAULT_SEED
  return {
    folderContext,
    recentFolders,
    welcomed: raw.welcomed === true,
    theme: { seed, mode: theme.mode === 'light' ? 'light' : 'dark' }
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    return sanitizeSettings(JSON.parse(await readFile(settingsPath(), 'utf8')))
  } catch {
    return sanitizeSettings(null)
  }
}

export async function saveSettings(settings: unknown): Promise<void> {
  const json = JSON.stringify(sanitizeSettings(settings), null, 2) + '\n'
  await writeTextFile(settingsPath(), json, { eol: '\n', bom: false, encoding: 'utf8' })
}
