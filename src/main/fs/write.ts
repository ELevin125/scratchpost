import { open, rename, unlink } from 'node:fs/promises'
import type { FileMeta } from '../../preload/api'

export function encode(content: string, meta: FileMeta): Buffer {
  const text = meta.eol === '\r\n' ? content.replace(/\r?\n/g, '\r\n') : content
  return Buffer.from((meta.bom ? '﻿' : '') + text, 'utf8')
}

// Atomic: write a sibling tmp file, fsync, then rename over the target, so a
// crash mid-write can never leave a half-written note.
export async function writeTextFile(path: string, content: string, meta: FileMeta): Promise<void> {
  const tmp = `${path}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(encode(content, meta))
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await rename(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
}
