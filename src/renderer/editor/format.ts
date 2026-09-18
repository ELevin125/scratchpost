import { findLabels, renameLabelInText } from '../../shared/tags'
import {
  EditorSelection,
  type EditorState,
  type SelectionRange,
  type StateCommand,
  type TransactionSpec
} from '@codemirror/state'

// Formatting commands (4.8, 4.10, 4.11): inline markers, links, labels,
// headings and list types. All work on the selection, or the word or line at
// the cursor, and are plain undoable edits. See MARKDOWN_SPEC.md, "Formatting".

const done = (state: EditorState, spec: TransactionSpec) =>
  state.update(spec, { scrollIntoView: true, userEvent: 'input.format' })

// The range a command acts on: the selection, or the word at an empty cursor.
function target(state: EditorState, range: SelectionRange): { from: number; to: number } {
  if (!range.empty) return range
  const word = state.wordAt(range.head)
  return word ?? range
}

// `*` next to `**` is part of a bold marker, not an italic one; `***` has both.
// text is up to three characters on that side of the range.
function hasMarker(text: string, marker: string, side: 'before' | 'after'): boolean {
  const edge = (n: number) => (side === 'before' ? text.slice(-n) : text.slice(0, n))
  if (edge(marker.length) !== marker) return false
  if (marker !== '*') return true
  return edge(2) !== '**' || edge(3) === '***'
}

// Wraps each range in marker, or removes it when already wrapped. An empty
// cursor outside a word gets an empty pair with the cursor inside.
export function toggleMarker(marker: string): StateCommand {
  return ({ state, dispatch }) => {
    const size = marker.length
    const tr = state.changeByRange((range) => {
      const { from, to } = target(state, range)
      const text = state.sliceDoc(from, to)
      const before = state.sliceDoc(Math.max(0, from - 3), from)
      const after = state.sliceDoc(to, to + 3)
      if (from !== to && hasMarker(before, marker, 'before') && hasMarker(after, marker, 'after')) {
        return {
          changes: [
            { from: from - size, to: from },
            { from: to, to: to + size }
          ],
          range: EditorSelection.range(range.anchor - size, range.head - size)
        }
      }
      if (text.length > size * 2 && text.startsWith(marker) && text.endsWith(marker)) {
        return {
          changes: { from, to, insert: text.slice(size, -size) },
          range: EditorSelection.range(from, to - size * 2)
        }
      }
      return {
        changes: [
          { from, insert: marker },
          { from: to, insert: marker }
        ],
        range:
          from === to
            ? EditorSelection.cursor(from + size)
            : EditorSelection.range(range.anchor + size, range.head + size)
      }
    })
    dispatch(done(state, tr))
    return true
  }
}

// `[text](|)`, with the cursor where the URL goes.
export const insertLink: StateCommand = ({ state, dispatch }) => {
  const tr = state.changeByRange((range) => {
    const { from, to } = target(state, range)
    const text = state.sliceDoc(from, to)
    return {
      changes: { from, to, insert: `[${text}]()` },
      range: EditorSelection.cursor(from + text.length + (text ? 3 : 1))
    }
  })
  dispatch(done(state, tr))
  return true
}

// A label: the selection becomes `[selection]`; otherwise `[word]` goes in at
// the cursor (after the word it is in), with a space on either side where
// needed.
export function insertLabel(word: string): StateCommand {
  return ({ state, dispatch }) => {
    const tr = state.changeByRange((range) => {
      if (!range.empty) {
        const text = state.sliceDoc(range.from, range.to).trim().replace(/\s+/g, '_')
        const insert = `[${text}]`
        return {
          changes: { from: range.from, to: range.to, insert },
          range: EditorSelection.cursor(range.from + insert.length)
        }
      }
      // Inside a word, the label goes after it.
      const around = state.wordAt(range.head)
      const pos = around && around.from < range.head ? around.to : range.head
      const before = state.sliceDoc(pos - 1, pos)
      const after = state.sliceDoc(pos, pos + 1)
      const insert = `${before && !/\s/.test(before) ? ' ' : ''}[${word}]${after && /\s/.test(after) ? '' : ' '}`
      return { changes: { from: pos, insert }, range: EditorSelection.cursor(pos + insert.length) }
    })
    dispatch(done(state, tr))
    return true
  }
}

// The label the position sits in, if any (5.6).
export function labelAt(state: EditorState, pos: number): string | null {
  const line = state.doc.lineAt(pos)
  const at = pos - line.from
  for (const match of findLabels(line.text)) {
    if (at >= match.from && at <= match.to) return match.word
  }
  return null
}

// Renames every `[from]` in the document to `[to]`, as one undoable edit,
// under the same rules main uses for the whole folder.
export function renameLabelHere(from: string, to: string): StateCommand {
  return ({ state, dispatch }) => {
    const next = renameLabelInText(state.doc.toString(), from, to)
    if (next === null) return false
    dispatch(done(state, { changes: { from: 0, to: state.doc.length, insert: next } }))
    return true
  }
}

export const labelWord = (input: string): string | null => {
  const word = input.trim().replace(/^\[|\]$/g, '').replace(/\s+/g, '_')
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(word) ? word : null
}

function selectedLines(state: EditorState): number[] {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    const first = state.doc.lineAt(range.from).number
    const last = state.doc.lineAt(range.to).number
    for (let n = first; n <= last; n++) lines.add(n)
  }
  return [...lines].sort((a, b) => a - b)
}

const HEADING = /^(#{1,6})[ \t]+/

// Sets the lines to a heading level; the same level again (or 0) makes them
// plain text.
export function setHeading(level: number): StateCommand {
  return ({ state, dispatch }) => {
    const lines = selectedLines(state).map((n) => state.doc.line(n))
    const all = lines.every((line) => HEADING.exec(line.text)?.[1].length === level)
    const changes = lines.map((line) => {
      const current = HEADING.exec(line.text)?.[0] ?? ''
      const insert = level === 0 || all ? '' : `${'#'.repeat(level)} `
      return { from: line.from, to: line.from + current.length, insert }
    })
    dispatch(done(state, { changes }))
    return true
  }
}

export type ListKind = 'bullet' | 'task' | 'ordered'

const LIST_PREFIX = /^([ \t]*)(?:([-*+])[ \t]+(?:\[([ xX])\][ \t]+)?|(\d{1,9})[.)][ \t]+)?/

function kindOf(text: string): ListKind | null {
  const match = LIST_PREFIX.exec(text)!
  if (match[4]) return 'ordered'
  if (!match[2]) return null
  return match[3] !== undefined ? 'task' : 'bullet'
}

// The lines a list command acts on: the selection, or the whole list around an
// empty cursor.
function listLines(state: EditorState): number[] {
  const main = state.selection.main
  if (!main.empty || state.selection.ranges.length > 1) return selectedLines(state)
  const at = state.doc.lineAt(main.head)
  if (kindOf(at.text) === null) return [at.number]
  let first = at.number
  let last = at.number
  const inList = (n: number) => {
    const text = state.doc.line(n).text
    return kindOf(text) !== null || (/^[ \t]+\S/.test(text) && text.trim() !== '')
  }
  while (first > 1 && inList(first - 1)) first--
  while (last < state.doc.lines && inList(last + 1)) last++
  // Continuation lines stay as they are.
  return Array.from({ length: last - first + 1 }, (_, i) => first + i).filter(
    (n) => kindOf(state.doc.line(n).text) !== null
  )
}

// Turns the lines into bullets, a checklist or a numbered list, keeping
// indentation and ticks. Lines already of that kind go back to plain text.
export function setListKind(kind: ListKind): StateCommand {
  return ({ state, dispatch }) => {
    const lines = listLines(state)
      .map((n) => state.doc.line(n))
      .filter((line) => line.text.trim() !== '')
    if (lines.length === 0) return false
    const all = lines.every((line) => kindOf(line.text) === kind)
    const counters = new Map<string, number>()
    const changes = lines.map((line) => {
      const match = LIST_PREFIX.exec(line.text)!
      const indent = match[1]
      for (const key of counters.keys()) if (key.length > indent.length) counters.delete(key)
      let prefix = indent
      if (!all) {
        if (kind === 'bullet') prefix += '- '
        else if (kind === 'task') prefix += `- [${match[3] && match[3] !== ' ' ? 'x' : ' '}] `
        else {
          const n = (counters.get(indent) ?? 0) + 1
          counters.set(indent, n)
          prefix += `${n}. `
        }
      }
      return { from: line.from, to: line.from + match[0].length, insert: prefix }
    })
    dispatch(done(state, { changes }))
    return true
  }
}
