import { indentUnit, syntaxTree } from '@codemirror/language'
import {
  EditorSelection,
  Prec,
  type ChangeSpec,
  type EditorState,
  type Line,
  type StateCommand
} from '@codemirror/state'
import { keymap } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { PLAIN_BLOCKS } from './livePreview'

// Enter continues lists; Tab and Shift+Tab indent. See MARKDOWN_SPEC.md,
// "List continuation", and D21 for why these keys live here rather than in
// the command registry.

const LIST_ITEM = /^([ \t]*)(?:([-*+])|(\d{1,9})([.)]))([ \t]+)(\[[ xX]\][ \t]+)?(.*)$/

export interface ListItem {
  indent: string
  marker: string // "-", "*", "+", "1.", "2)"
  number: number | null // null for bullets
  numberText: string // digits as typed, e.g. "01"
  delimiter: string // "." or ")" for numbered items, "" for bullets
  task: boolean
  content: string
  contentOffset: number // column where a child item's marker starts
}

export function parseListItem(text: string): ListItem | null {
  const match = LIST_ITEM.exec(text)
  if (!match) return null
  const [, indent, bullet, digits, delimiter, spacing, task, content] = match
  const marker = bullet ?? `${digits}${delimiter}`
  return {
    indent,
    marker,
    number: digits === undefined ? null : Number(digits),
    numberText: digits ?? '',
    delimiter: delimiter ?? '',
    task: task !== undefined,
    content,
    contentOffset: indent.length + marker.length + spacing.length
  }
}

export const leadingWidth = (text: string): number => /^[ \t]*/.exec(text)![0].length

// Lists inside code, quotes and HTML are plain text, as is `- - -`.
function inPlainBlock(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, 1); node; node = node.parent) {
    if (PLAIN_BLOCKS.has(node.name) || node.name === 'HorizontalRule') return true
  }
  return false
}

const listItemAt = (state: EditorState, line: Line) =>
  inPlainBlock(state, line.from) ? null : parseListItem(line.text)

// Enter, per the three rules in the spec. Every cursor decides on its own.
export const continueList: StateCommand = ({ state, dispatch }) => {
  const spec = state.changeByRange((range) => {
    const line = state.doc.lineAt(range.head)
    const item = range.empty ? listItemAt(state, line) : null

    // Rule 2: a marker with no content exits the list, leaving an empty line.
    if (item && item.content.trim() === '') {
      return { changes: { from: line.from, to: line.to }, range: EditorSelection.cursor(line.from) }
    }

    // Rule 1: at the end of an item, start the next one. Tasks restart unchecked.
    if (item && range.head === line.to) {
      const marker = item.number === null ? item.marker : `${item.number + 1}${item.delimiter}`
      const insert = `\n${item.indent}${marker} ${item.task ? '[ ] ' : ''}`
      return {
        changes: { from: range.head, insert },
        range: EditorSelection.cursor(range.head + insert.length)
      }
    }

    // Rule 3: a plain newline, with no auto-indent.
    return {
      changes: { from: range.from, to: range.to, insert: '\n' },
      range: EditorSelection.cursor(range.from + 1)
    }
  })
  dispatch(state.update(spec, { scrollIntoView: true, userEvent: 'input' }))
  return true
}

// Nearest list item above at exactly this indent, skipping blank lines and
// anything nested deeper. Null once something shallower is reached.
function previousSibling(state: EditorState, lineNo: number, indent: number): ListItem | null {
  for (let n = lineNo - 1; n >= 1; n--) {
    const text = state.doc.line(n).text
    if (text.trim() === '') continue
    const item = parseListItem(text)
    const width = item ? item.indent.length : leadingWidth(text)
    if (width > indent) continue
    return item && width === indent ? item : null
  }
  return null
}

// Nearest list item above that is shallower than this indent.
function parentItem(state: EditorState, lineNo: number, indent: number): ListItem | null {
  for (let n = lineNo - 1; n >= 1; n--) {
    const text = state.doc.line(n).text
    if (text.trim() === '') continue
    const item = parseListItem(text)
    if (item && item.indent.length < indent) return item
    if (!item && leadingWidth(text) < indent) return null
  }
  return null
}

// Every line touched by a selection. A range ending at the start of a line
// doesn't include that line.
function selectedLines(state: EditorState): Line[] {
  const lines = new Map<number, Line>()
  for (const range of state.selection.ranges) {
    const last = !range.empty && state.doc.lineAt(range.to).from === range.to ? range.to - 1 : range.to
    for (let pos = range.from; pos <= last; ) {
      const line = state.doc.lineAt(pos)
      lines.set(line.number, line)
      pos = line.to + 1
    }
  }
  return [...lines.values()].sort((a, b) => a.number - b.number)
}

function listItemIndent(state: EditorState, line: Line, item: ListItem, direction: 1 | -1): ChangeSpec[] {
  const current = item.indent.length
  let target: number
  if (direction > 0) {
    // One level deeper means under the previous sibling's text. The first
    // item of a list has no sibling to nest under, so it stays put.
    const sibling = previousSibling(state, line.number, current)
    if (!sibling) return []
    target = sibling.contentOffset
  } else {
    const parent = parentItem(state, line.number, current)
    if (!parent && current === 0) return []
    target = parent ? parent.indent.length : 0
  }

  const changes: ChangeSpec[] = [{ from: line.from, to: line.from + current, insert: ' '.repeat(target) }]

  // A numbered item indented into a new sub-list starts it at 1. Renumbering
  // (renumber.ts) takes care of everything after it.
  if (direction > 0 && item.number !== null) {
    const child = previousSibling(state, line.number, target)
    const continues = child !== null && child.number !== null && child.delimiter === item.delimiter
    if (!continues) {
      const from = line.from + current
      changes.push({ from, to: from + item.numberText.length, insert: '1' })
    }
  }
  return changes
}

function indentLines(direction: 1 | -1): StateCommand {
  return ({ state, dispatch }) => {
    const unit = state.facet(indentUnit)
    const lines = selectedLines(state)
    const changes: ChangeSpec[] = []

    for (const line of lines) {
      const item = listItemAt(state, line)
      if (item) {
        changes.push(...listItemIndent(state, line, item, direction))
      } else if (lines.length > 1 && line.text.trim() === '') {
        continue
      } else if (direction > 0) {
        changes.push({ from: line.from, insert: unit })
      } else {
        const remove = Math.min(leadingWidth(line.text), unit.length)
        if (remove > 0) changes.push({ from: line.from, to: line.from + remove })
      }
    }

    if (changes.length > 0) {
      const set = state.changes(changes)
      dispatch(
        state.update({
          changes: set,
          // assoc 1: a cursor at the start of the line moves with the indent.
          selection: state.selection.map(set, 1),
          scrollIntoView: true,
          userEvent: direction > 0 ? 'input.indent' : 'delete.dedent'
        })
      )
    }
    // Always handled, so Tab never moves focus out of the editor.
    return true
  }
}

// High precedence so these win over the default keymap's Enter.
export const listKeymap = Prec.high(
  keymap.of([
    { key: 'Enter', run: continueList },
    { key: 'Tab', run: indentLines(1), shift: indentLines(-1) }
  ])
)
