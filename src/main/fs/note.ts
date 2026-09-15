import { mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'

const pad = (n: number) => String(n).padStart(2, '0')

// YYYY-MM-DD-HHmm in local time.
export function noteBaseName(date: Date): string {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return `${day}-${pad(date.getHours())}${pad(date.getMinutes())}`
}

// Creates an empty note and returns its path. Taken names get -2, -3, ...
// Exclusive create ('wx') makes the collision check race-free.
export async function createNote(dir: string, now = new Date()): Promise<string> {
  await mkdir(dir, { recursive: true })
  const base = noteBaseName(now)
  for (let n = 1; ; n++) {
    const path = join(dir, n === 1 ? `${base}.md` : `${base}-${n}.md`)
    try {
      await (await open(path, 'wx')).close()
      return path
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
  }
}
