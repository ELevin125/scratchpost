import { access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { NOTE_FILE } from './list'
import { writeTextFile } from './write'

// The tutorial note. Its text is src/main/welcome.md. See D30.

export const WELCOME_NAME = 'welcome.md'

// Writes welcome.md into the scratch folder, never over an existing one, and
// returns its path. With onlyIfEmpty (first launch) it does nothing when the
// folder already holds notes, for example synced from another machine.
export async function createWelcomeNote(scratchDir: string, onlyIfEmpty: boolean, text: string): Promise<string | null> {
  if (onlyIfEmpty) {
    const names = await readdir(scratchDir)
    if (names.some((name) => !name.startsWith('.') && NOTE_FILE.test(name))) return null
  }
  const path = join(scratchDir, WELCOME_NAME)
  const exists = await access(path).then(
    () => true,
    () => false
  )
  if (!exists) await writeTextFile(path, text, { eol: '\n', bom: false, encoding: 'utf8' })
  return path
}
