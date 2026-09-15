import type { TagSummary } from '../../preload/api'
import { findTags, tagKey } from '../../shared/tags'
import { listFolder } from './list'
import { scanFiles } from './scan'

// The tag index for the file tree. Main has no syntax tree, so code is skipped
// by text rules: fenced blocks by their fences, inline code by its backticks.
// See MARKDOWN_SPEC.md, "Indexing", and D27.

const FENCE = /^ {0,3}(```|~~~)/
const INLINE_CODE = /`[^`\n]*`/g

// Every tag occurrence in a note, lowercased.
export function tagsInText(text: string): string[] {
  const tags: string[] = []
  let inFence = false
  for (const line of text.split(/\r?\n/)) {
    if (FENCE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const withoutCode = line.replace(INLINE_CODE, (code) => ' '.repeat(code.length))
    for (const match of findTags(withoutCode)) tags.push(tagKey(match.tag))
  }
  return tags
}

// Most used first. Counts are occurrences, not files.
export async function indexTags(root: string): Promise<TagSummary[]> {
  const files = (await listFolder(root)).filter((entry) => !entry.isDir).map((entry) => entry.path)
  const index = new Map<string, { count: number; paths: Set<string> }>()

  await scanFiles(files, (path, text) => {
    for (const tag of tagsInText(text)) {
      const entry = index.get(tag) ?? { count: 0, paths: new Set<string>() }
      entry.count++
      entry.paths.add(path)
      index.set(tag, entry)
    }
  })

  return [...index]
    .map(([tag, { count, paths }]) => ({ tag, count, paths: [...paths] }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}
