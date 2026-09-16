import { access, link, lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, sep } from 'node:path'
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
    if (await exists(to)) throw new Error(`${basename(to)} already exists`)
  }
  await rename(from, to)
}

const exists = (path: string) =>
  access(path).then(
    () => true,
    () => false
  )

// Moves a note into dir under the same name, or name-2, name-3 if taken, and
// returns the new path. A hard link claims the name atomically; where links
// aren't supported it falls back to checking first.
export async function moveNoteTo(from: string, dir: string): Promise<string> {
  await mkdir(dir, { recursive: true })
  const ext = extname(from)
  const stem = basename(from, ext)
  for (let n = 1; ; n++) {
    const to = join(dir, n === 1 ? `${stem}${ext}` : `${stem}-${n}${ext}`)
    try {
      await link(from, to)
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code === 'EEXIST') continue
      if (code !== 'EPERM' && code !== 'ENOTSUP' && code !== 'EXDEV' && code !== 'ENOSYS') throw err
      if (await exists(to)) continue
      await rename(from, to)
      return to
    }
    await unlink(from)
    return to
  }
}

// Archived notes live in an `archive` folder beside where they were. See D36.
export const ARCHIVE_DIR = 'archive'

export const isArchived = (path: string) => basename(dirname(path)) === ARCHIVE_DIR

export async function archiveNote(path: string): Promise<string> {
  if (isArchived(path)) throw new Error('already archived')
  return moveNoteTo(path, join(dirname(path), ARCHIVE_DIR))
}

export async function unarchiveNote(path: string): Promise<string> {
  if (!isArchived(path)) throw new Error('not in an archive folder')
  return moveNoteTo(path, dirname(dirname(path)))
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
