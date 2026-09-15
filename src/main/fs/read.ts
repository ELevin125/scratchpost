import { readFile } from 'node:fs/promises'
import type { FilePayload } from '../../preload/api'

// Strips the BOM and converts CRLF to LF for the editor; FileMeta records both
// so write.ts can restore the original bytes. Never normalise on disk.
export function decode(bytes: Buffer): FilePayload {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  let text = bytes.toString('utf8')
  if (bom) text = text.slice(1)

  // The first line break decides; mixed line endings are not preserved.
  const firstBreak = text.indexOf('\n')
  const eol = firstBreak > 0 && text[firstBreak - 1] === '\r' ? '\r\n' : '\n'
  const content = eol === '\r\n' ? text.replace(/\r\n/g, '\n') : text

  return { content, meta: { eol, bom, encoding: 'utf8' } }
}

export async function readTextFile(path: string): Promise<FilePayload> {
  return decode(await readFile(path))
}
