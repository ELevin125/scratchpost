// Labels and tags, shared by the editor (rendering) and the main process (tag
// index), so both always agree. See MARKDOWN_SPEC.md, "Labels and tags", and D34.
//
// - A label, `[word]`, colours a word inside one note. Never indexed.
// - A tag, `#word`, groups notes: the tag index collects it across the folder.
// Both take their colour from the word, so `[ideas]` and `#ideas` match.

// `[word]`: no spaces, starts alphanumeric, not followed by `(` or `[` (links),
// not preceded by a word character or `]` (the second half of a reference link).
const LABEL_PATTERN = String.raw`(?<![\w\]])\[([A-Za-z0-9][A-Za-z0-9._-]*)\](?![(\[])`

// `#word`: starts with a letter, so `#12` and headings (`# Title`) aren't tags.
// Only after whitespace, `(` or the line start, so `C#` and `page#anchor`
// aren't either. Letters, digits, `-`, `_` and `/` continue the word; any
// other character, such as a full stop, ends it.
const TAG_PATTERN = String.raw`(?<=^|[\s(])#([A-Za-z][A-Za-z0-9_/-]*)`

const LIST_MARKER_BEFORE = /^\s*(?:[-*+]|\d{1,9}[.)])\s+$/

export interface WordMatch {
  from: number // offset of `[` or `#` within the line
  to: number // offset just past the match
  word: string // the word, as written, without brackets or `#`
}

export function findLabels(line: string): WordMatch[] {
  const matches: WordMatch[] = []
  for (const match of line.matchAll(new RegExp(LABEL_PATTERN, 'g'))) {
    const from = match.index
    const word = match[1]
    // `- [x] task` is a checkbox, which takes precedence over labels.
    if ((word === 'x' || word === 'X') && LIST_MARKER_BEFORE.test(line.slice(0, from))) continue
    matches.push({ from, to: from + match[0].length, word })
  }
  return matches
}

export function findTags(line: string): WordMatch[] {
  return [...line.matchAll(new RegExp(TAG_PATTERN, 'g'))].map((match) => ({
    from: match.index,
    to: match.index + match[0].length,
    word: match[1]
  }))
}

// Case-insensitive: #Urgent and #urgent are one tag, with one colour.
export const tagKey = (word: string): string => word.toLowerCase()

// FNV-1a over the lowercased word, mapped to a hue from 0 to 359. Stable across
// runs and machines, so a word keeps its colour. See D16.
export function tagHue(word: string): number {
  let hash = 0x811c9dc5
  for (const ch of tagKey(word)) {
    hash ^= ch.codePointAt(0)!
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0) % 360
}
