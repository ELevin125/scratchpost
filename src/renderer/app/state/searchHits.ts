import type { SearchHit } from '../../../preload/api'

// Folder search helpers. Pure. See D27.

export const MIN_SEARCH_LENGTH = 2

export interface HitGroup {
  path: string
  hits: SearchHit[]
}

// Consecutive hits from the same file, in result order.
export function groupHits(hits: readonly SearchHit[]): HitGroup[] {
  const groups: HitGroup[] = []
  for (const hit of hits) {
    const last = groups.at(-1)
    if (last?.path === hit.path) last.hits.push(hit)
    else groups.push({ path: hit.path, hits: [hit] })
  }
  return groups
}

export interface HitSelection {
  anchor: number // start of the match, or of the line if the match isn't found
  head: number // end of the match
  scrollTo: number // start of a line a little above, so the match isn't pinned to the top
}

const CONTEXT_LINES = 5

// Where to put the selection for a hit, in a document with "\n" line breaks.
export function selectionForHit(doc: string, line: number, query: string): HitSelection {
  const lines = doc.split('\n')
  const n = Math.min(Math.max(line, 1), lines.length)
  const startOf = (lineNo: number) => {
    let offset = 0
    for (let i = 0; i < lineNo - 1; i++) offset += lines[i].length + 1
    return offset
  }

  const lineStart = startOf(n)
  const column = query === '' ? -1 : lines[n - 1].toLowerCase().indexOf(query.toLowerCase())
  const anchor = column >= 0 ? lineStart + column : lineStart
  const head = column >= 0 ? anchor + query.length : lineStart
  return { anchor, head, scrollTo: startOf(Math.max(1, n - CONTEXT_LINES)) }
}
