import type { SearchHit } from '../../preload/api'
import { listFolder } from './list'
import { scanFiles } from './scan'

// Folder-wide content search: case-insensitive substring, line by line. See D27.

export const MAX_HITS = 500
const MAX_LINE_CHARS = 300

export async function searchFolder(root: string, query: string): Promise<SearchHit[]> {
  const needle = query.toLowerCase()
  if (needle.trim() === '') return []

  const files = (await listFolder(root)).filter((entry) => !entry.isDir).map((entry) => entry.path)
  const hits: SearchHit[] = []

  await scanFiles(files, (path, text) => {
    if (!text.toLowerCase().includes(needle)) return
    const lines = text.split(/\r?\n/)
    for (const [i, line] of lines.entries()) {
      if (!line.toLowerCase().includes(needle)) continue
      hits.push({ path, line: i + 1, text: line.slice(0, MAX_LINE_CHARS) })
      if (hits.length >= MAX_HITS) return false
    }
  })
  return hits
}
