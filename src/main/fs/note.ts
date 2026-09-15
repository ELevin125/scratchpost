import { access, lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { NOTE_FILE } from './list'

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

// Renames within one folder and never over an existing file.
export async function renameNote(from: string, to: string): Promise<void> {
  if (dirname(from) !== dirname(to)) throw new Error('a rename stays in the same folder')
  if (from === to) return
  // A case-only rename is the same file on Windows; let it through.
  if (from.toLowerCase() !== to.toLowerCase()) {
    const taken = await access(to).then(
      () => true,
      () => false
    )
    if (taken) throw new Error(`${basename(to)} already exists`)
  }
  await rename(from, to)
}

export function isInsideDir(path: string, dir: string): boolean {
  const rel = relative(dir, path)
  return rel !== '' && rel.split(sep)[0] !== '..' && !isAbsolute(rel)
}

// Deletes a scratch note only if it holds nothing but whitespace. Checked
// against the file on disk, not the editor buffer, so a synced edit that just
// arrived is never lost. See D23.
export async function deleteIfEmpty(path: string, scratchDir: string): Promise<boolean> {
  if (!isInsideDir(path, scratchDir)) throw new Error('only notes in the scratch folder can be deleted')
  const content = await readFile(path, 'utf8').catch(() => null)
  if (content === null || content.replace(/^﻿/, '').trim() !== '') return false
  await unlink(path)
  return true
}

// Only an existing regular .md or .txt file can go to the trash: never a
// folder, a symlink or anything else the renderer names. See D29.
export async function isNoteFile(path: string): Promise<boolean> {
  if (!NOTE_FILE.test(path)) return false
  try {
    return (await lstat(path)).isFile()
  } catch {
    return false
  }
}
