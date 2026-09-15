import { open, readdir, type FileHandle } from 'node:fs/promises'
import { join } from 'node:path'
import type { FolderEntry } from '../../preload/api'

// Directory walk for the file tree and quick switcher. See D25.

export const NOTE_FILE = /\.(md|txt)$/i
const SKIPPED_FOLDERS = new Set(['node_modules'])
export const MAX_ENTRIES = 5000
const MAX_DEPTH = 10
const FIRST_LINE_BYTES = 1024

export interface NoteSummary {
  firstLine: string | null
  modified: number | null // mtime in ms
}

// The first non-blank line, for display names, and the modified time, without
// reading whole files.
export async function readSummary(path: string): Promise<NoteSummary> {
  let handle: FileHandle | undefined
  try {
    handle = await open(path, 'r')
    const [stats, { bytesRead, buffer }] = await Promise.all([
      handle.stat(),
      handle.read(Buffer.alloc(FIRST_LINE_BYTES), 0, FIRST_LINE_BYTES, 0)
    ])
    const text = buffer.subarray(0, bytesRead).toString('utf8').replace(/^﻿/, '')
    return {
      firstLine: text.split(/\r?\n/).find((line) => line.trim() !== '') ?? null,
      modified: Math.round(stats.mtimeMs)
    }
  } catch {
    return { firstLine: null, modified: null }
  } finally {
    await handle?.close()
  }
}

export async function readFirstLine(path: string): Promise<string | null> {
  return (await readSummary(path)).firstLine
}

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

// Recursive and sorted by name, folders before files. Skips hidden entries,
// node_modules and symlinks, drops folders with no .md or .txt anywhere
// inside, and stops at MAX_ENTRIES so a huge folder can't stall the app.
// Folders are always listed before their contents.
export async function listFolder(root: string): Promise<FolderEntry[]> {
  const entries: FolderEntry[] = []

  async function walk(dir: string, depth: number): Promise<number> {
    const dirents = (await readdir(dir, { withFileTypes: true })).filter((d) => !d.name.startsWith('.'))
    const folders = dirents.filter((d) => d.isDirectory() && !SKIPPED_FOLDERS.has(d.name)).sort(byName)
    const files = dirents.filter((d) => d.isFile() && NOTE_FILE.test(d.name)).sort(byName)
    let count = 0

    for (const folder of folders) {
      if (entries.length >= MAX_ENTRIES || depth >= MAX_DEPTH) break
      const path = join(dir, folder.name)
      const index = entries.push({ path, name: folder.name, isDir: true, firstLine: null, modified: null }) - 1
      // An unreadable subfolder is skipped rather than failing the walk.
      const inside = await walk(path, depth + 1).catch(() => 0)
      if (inside === 0) entries.splice(index)
      count += inside
    }

    const kept = files.slice(0, Math.max(0, MAX_ENTRIES - entries.length))
    const summaries = await Promise.all(kept.map((file) => readSummary(join(dir, file.name))))
    kept.forEach((file, i) => {
      entries.push({ path: join(dir, file.name), name: file.name, isDir: false, ...summaries[i] })
    })
    return count + kept.length
  }

  await walk(root, 0)
  return entries
}
