import { StateField, Transaction, type EditorState, type Range } from '@codemirror/state'
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

// A note opens fully rendered: nothing reveals until the user does something
// in it (clicks, types, moves the cursor, runs an editing command). Otherwise
// the cursor's starting line, usually the title, would always show its syntax.
// Any transaction with a user event arms it. See MARKDOWN_SPEC.md, "Cursor reveal".
export const revealArmed = StateField.define<boolean>({
  create: () => false,
  update: (armed, tr) => armed || tr.annotation(Transaction.userEvent) !== undefined
})

// Every line a cursor sits on or a selection covers: a selection from line 3
// to line 7 reveals all five, so a selection is never part raw and part
// rendered (5.1). See MARKDOWN_SPEC.md, "Cursor reveal".
// States without revealArmed (tests) always reveal.
export function revealedLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  if (state.field(revealArmed, false) === false) return lines
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) lines.add(n)
  }
  return lines
}

export function skipSpaces(state: EditorState, pos: number, end: number): number {
  while (pos < end && /[ \t]/.test(state.sliceDoc(pos, pos + 1))) pos++
  return pos
}
