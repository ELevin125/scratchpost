import type { EditorState, Range } from '@codemirror/state'
import { Decoration } from '@codemirror/view'

// Shared by the live preview modules (blocks.ts, inline.ts) and lists.ts.

// Blocks whose lines never render as headings, lists or checkboxes, and where
// Enter and Tab don't treat lines as list items.
export const PLAIN_BLOCKS = new Set(['Blockquote', 'FencedCode', 'CodeBlock', 'HTMLBlock', 'Table'])

export interface Context {
  state: EditorState
  // True when the line holding pos has a cursor or selection endpoint.
  revealedAt: (pos: number) => boolean
  // Keyed, so a node visited from two visible ranges is decorated once.
  add: (key: string, range: Range<Decoration>) => void
}

export const hidden = Decoration.replace({})

// Every line holding a cursor or a selection endpoint. A selection spanning
// lines 3 to 7 reveals 3 and 7 only. See MARKDOWN_SPEC.md, "Cursor reveal".
export function revealedLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    lines.add(state.doc.lineAt(range.anchor).number)
    lines.add(state.doc.lineAt(range.head).number)
  }
  return lines
}

export function skipSpaces(state: EditorState, pos: number, end: number): number {
  while (pos < end && /[ \t]/.test(state.sliceDoc(pos, pos + 1))) pos++
  return pos
}
