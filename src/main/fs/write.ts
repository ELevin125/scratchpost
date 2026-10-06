import { open, rename, unlink } from 'node:fs/promises'
import { setTimeout as wait } from 'node:timers/promises'
import type { FileMeta } from '../../preload/api'

export function encode(content: string, meta: FileMeta): Buffer {
  const text = meta.eol === '\r\n' ? content.replace(/\r?\n/g, '\r\n') : content
  return Buffer.from((meta.bom ? '﻿' : '') + text, 'utf8')
}

// Windows refuses a rename while another program has either file open, and a
// file made a moment ago is exactly what a virus scanner, the search indexer
// or a sync client opens. They let go within moments, so the rename waits and
// tries again, for about a second and a half in all, before giving up.
const LOCKED = new Set(['EPERM', 'EACCES', 'EBUSY'])
const RETRY_AFTER_MS = [25, 50, 100, 200, 400, 800]

async function renameOver(tmp: string, path: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await rename(tmp, path)
    } catch (err) {
      const delay = RETRY_AFTER_MS[attempt]
      const locked = LOCKED.has((err as NodeJS.ErrnoException).code ?? '')
      if (process.platform !== 'win32' || !locked || delay === undefined) throw err
      await wait(delay)
    }
  }
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
    await renameOver(tmp, path)
  } catch (err) {
    await unlink(tmp).catch(() => {})
    throw err
  }
}
