import { readFile, stat } from 'node:fs/promises'

// Reads note files for folder search and the tag index.

export const MAX_FILE_BYTES = 1_000_000
const BATCH = 16

async function readSmallText(path: string): Promise<string | null> {
  try {
    if ((await stat(path)).size > MAX_FILE_BYTES) return null
    return (await readFile(path, 'utf8')).replace(/^﻿/, '')
  } catch {
    return null
  }
}

// Visits each file's text in order, a batch at a time, skipping unreadable and
// oversized files. The visitor returns false to stop early.
export async function scanFiles(
  paths: readonly string[],
  visit: (path: string, text: string) => boolean | void
): Promise<void> {
  for (let i = 0; i < paths.length; i += BATCH) {
    const batch = paths.slice(i, i + BATCH)
    const texts = await Promise.all(batch.map(readSmallText))
    for (const [j, text] of texts.entries()) {
      if (text !== null && visit(batch[j], text) === false) return
    }
  }
}
