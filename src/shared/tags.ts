// The tag pattern from MARKDOWN_SPEC.md, shared by the editor (pills) and the
// main process (tag index), so both always agree on what a tag is. See D27.

// `[word]`: no spaces, starts alphanumeric, not followed by `(` or `[` (links),
// not preceded by a word character or `]` (the second half of a reference link).
const TAG_PATTERN = String.raw`(?<![\w\]])\[([A-Za-z0-9][A-Za-z0-9._-]*)\](?![(\[])`

const LIST_MARKER_BEFORE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+$/

export interface TagMatch {
  from: number // offset of `[` within the line
  to: number // offset just past `]`
  tag: string // the word, as written
}

export function findTags(line: string): TagMatch[] {
  const matches: TagMatch[] = []
  for (const match of line.matchAll(new RegExp(TAG_PATTERN, 'g'))) {
    const from = match.index
    const tag = match[1]
    // `- [x] task` is a checkbox, which takes precedence over tags.
    if ((tag === 'x' || tag === 'X') && LIST_MARKER_BEFORE.test(line.slice(0, from))) continue
    matches.push({ from, to: from + match[0].length, tag })
  }
  return matches
}

// Tags are case-insensitive: [Urgent] and [urgent] are one tag.
export const tagKey = (tag: string): string => tag.toLowerCase()

// FNV-1a over the lowercased tag, mapped to a hue from 0 to 359. Stable across
// runs and machines, so a tag keeps its colour. See D16.
export function tagHue(tag: string): number {
  let hash = 0x811c9dc5
  for (const ch of tagKey(tag)) {
    hash ^= ch.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 360
}
