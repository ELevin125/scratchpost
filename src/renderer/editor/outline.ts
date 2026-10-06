// The headings of a note, for the outline in the left column (6.4). Read from
// the text by the same rules the editor renders headings with: `#` to `######`
// at the start of a line, outside fenced code.

export interface Heading {
  level: number // 1 to 6
  text: string // without the `#`s or inline markdown
  line: number // 1-based
}

const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/

// What the heading reads as: emphasis, code and link syntax dropped.
function plain(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|[\s(])[*_](?=\S)/g, '$1')
    .replace(/(\S)[*_](?=$|[\s).,;:!?])/g, '$1')
    .trim()
}

export function headingsOf(lines: Iterable<string>): Heading[] {
  const headings: Heading[] = []
  let fence: string | null = null
  let number = 0
  for (const line of lines) {
    number++
    const mark = FENCE.exec(line)?.[1]
    if (fence !== null) {
      // A fence closes on the same character, at least as many of them.
      if (mark && mark[0] === fence[0] && mark.length >= fence.length && line.trim() === mark) fence = null
      continue
    }
    if (mark) {
      fence = mark
      continue
    }
    const match = HEADING.exec(line)
    if (!match) continue
    const text = plain(match[2])
    if (text !== '') headings.push({ level: match[1].length, text, line: number })
  }
  return headings
}

export const sameHeadings = (a: readonly Heading[], b: readonly Heading[]): boolean =>
  a.length === b.length && a.every((h, i) => h.level === b[i].level && h.text === b[i].text && h.line === b[i].line)

// The heading the line sits under, as an index into the list; -1 above the first.
export function headingIndexAt(headings: readonly Heading[], line: number): number {
  let index = -1
  for (const [i, heading] of headings.entries()) {
    if (heading.line > line) break
    index = i
  }
  return index
}
