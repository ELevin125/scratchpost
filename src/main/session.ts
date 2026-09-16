import { app } from 'electron'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Session } from '../preload/api'
import { writeTextFile } from './fs/write'

// session.json lives in userData, never the notes folder: the notes folder
// is synced, session state is per machine. See ARCHITECTURE.md.
const sessionPath = () => join(app.getPath('userData'), 'session.json')

const nonNegativeInt = (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : 0

// Never trusts the file or the renderer: anything malformed is dropped rather
// than failing startup.
export function sanitizeSession(value: unknown): Session {
  const empty: Session = { tabs: [], activeIndex: -1 }
  if (typeof value !== 'object' || value === null) return empty
  const raw = value as { tabs?: unknown; activeIndex?: unknown }
  if (!Array.isArray(raw.tabs)) return empty

  let activeIndex = -1
  const tabs: Session['tabs'] = []
  raw.tabs.forEach((entry, index) => {
    if (typeof entry !== 'object' || entry === null) return
    const { path, cursor, scroll, pinned } = entry as Record<string, unknown>
    if (typeof path !== 'string' || path === '') return
    if (index === raw.activeIndex) activeIndex = tabs.length
    tabs.push({
      path,
      cursor: nonNegativeInt(cursor),
      scroll: nonNegativeInt(scroll),
      ...(pinned === true ? { pinned: true } : {})
    })
  })
  return { tabs, activeIndex }
}

export async function loadSession(): Promise<Session> {
  try {
    return sanitizeSession(JSON.parse(await readFile(sessionPath(), 'utf8')))
  } catch {
    // Missing or unreadable: start with no tabs.
    return { tabs: [], activeIndex: -1 }
  }
}

export async function saveSession(session: unknown): Promise<void> {
  const json = JSON.stringify(sanitizeSession(session), null, 2) + '\n'
  await writeTextFile(sessionPath(), json, { eol: '\n', bom: false, encoding: 'utf8' })
}
