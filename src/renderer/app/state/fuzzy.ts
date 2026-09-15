// Subsequence fuzzy matching for the command palette (and the quick switcher
// in 2.6). Every query character must appear in order; consecutive runs and
// word starts score higher.

const WORD_BREAK = /[\s\-_./]/

export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().replace(/\s+/g, '')
  const t = text.toLowerCase()
  let score = 0
  let from = 0
  let previous = -2

  for (const ch of q) {
    const i = t.indexOf(ch, from)
    if (i === -1) return null
    score += 1
    if (i === previous + 1) score += 2
    if (i === 0 || WORD_BREAK.test(t[i - 1])) score += 3
    previous = i
    from = i + 1
  }
  return score
}

// Best matches first; ties keep the original order. An empty query returns
// everything unchanged.
export function fuzzyFilter<T>(items: readonly T[], query: string, text: (item: T) => string): T[] {
  if (query.trim() === '') return [...items]
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, text(item)) }))
    .filter((match): match is { item: T; index: number; score: number } => match.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((match) => match.item)
}
