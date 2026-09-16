import { syntaxTree } from '@codemirror/language'
import {
  EditorSelection,
  RangeSet,
  RangeValue,
  StateEffect,
  StateField,
  type EditorState,
  type StateCommand,
  type TransactionSpec
} from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'

// Typing helpers (2.20, D32): auto-closing pairs and pasting a URL onto a
// selection. See MARKDOWN_SPEC.md, "Typing helpers" and "Copy and paste".
// Single cursor only; with several cursors typing is plain.

const PAIRS: Record<string, string> = { '(': ')', '[': ']', '`': '`' }

// A pair only opens where it can't be the middle of a word or an escape.
const OPENS_AFTER = /^$|[\s([{"'`]/
const CLOSES_BEFORE = /^$|[\s)\]}.,;:!?`*]/

const CODE_NODES = new Set(['FencedCode', 'CodeBlock', 'InlineCode'])

export function inCode(state: EditorState, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(state).resolveInner(pos, -1); node; node = node.parent) {
    if (CODE_NODES.has(node.name)) return true
  }
  return false
}

// Closing characters the helper inserted, one range per character, so typing
// over one skips it instead of doubling it. Only kept on the cursor's line.
const closer = new (class extends RangeValue {})()
closer.startSide = 1
closer.endSide = -1

const addClosers = StateEffect.define<number[]>()

const closers = StateField.define<RangeSet<RangeValue>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    value = value.map(tr.changes)
    if (tr.selection) {
      const line = tr.state.doc.lineAt(tr.selection.main.head)
      value = value.update({ filter: (from) => from >= line.from && from <= line.to })
    }
    for (const effect of tr.effects) {
      if (effect.is(addClosers)) {
        value = value.update({ add: effect.value.map((pos) => closer.range(pos, pos + 1)), sort: true })
      }
    }
    return value
  }
})

function closerAt(state: EditorState, pos: number): boolean {
  let found = false
  state.field(closers, false)?.between(pos, pos + 1, (from) => {
    if (from !== pos) return
    found = true
    return false
  })
  return found
}

const input = (spec: TransactionSpec): TransactionSpec => ({ ...spec, scrollIntoView: true, userEvent: 'input.type' })

// What typing ch at an empty cursor does, or null for plain typing.
export function typeAt(state: EditorState, pos: number, ch: string): TransactionSpec | null {
  const before = state.sliceDoc(pos - 1, pos)
  const after = state.sliceDoc(pos, pos + 1)

  // `**|**` then `*`: the pair was a rule or `***` in the making.
  if (ch === '*' && state.sliceDoc(pos - 2, pos) === '**' && closerAt(state, pos) && closerAt(state, pos + 1)) {
    return input({ changes: { from: pos, to: pos + 2, insert: '*' }, selection: EditorSelection.cursor(pos + 1) })
  }

  // Typing over a closer the helper inserted.
  if (after === ch && (ch === '*' || Object.values(PAIRS).includes(ch)) && closerAt(state, pos)) {
    return input({ selection: EditorSelection.cursor(pos + 1) })
  }

  if (!CLOSES_BEFORE.test(after) || before === '\\') return null

  // The second `*` of `**` opens bold.
  if (ch === '*') {
    if (before !== '*' || !OPENS_AFTER.test(state.sliceDoc(pos - 2, pos - 1)) || inCode(state, pos)) return null
    return input({
      changes: { from: pos, insert: '***' },
      selection: EditorSelection.cursor(pos + 1),
      effects: addClosers.of([pos + 1, pos + 2])
    })
  }

  const close = PAIRS[ch]
  if (!close) return null
  // A backtick after a backtick is a fence or a double-tick span being typed.
  if (ch === '`' && (before === '`' || /\w/.test(before))) return null
  return input({
    changes: { from: pos, insert: ch + close },
    selection: EditorSelection.cursor(pos + 1),
    effects: addClosers.of([pos + 1])
  })
}

// Typing an opener over a selection on one line wraps it and keeps it selected.
export function wrapSelection(state: EditorState, ch: string): TransactionSpec | null {
  const close = ch === '*' ? '*' : PAIRS[ch]
  const { from, to, anchor, head } = state.selection.main
  if (!close || state.doc.lineAt(from).number !== state.doc.lineAt(to).number) return null
  return input({
    changes: [
      { from, insert: ch },
      { from: to, insert: close }
    ],
    selection: EditorSelection.range(anchor + 1, head + 1)
  })
}

const typingHandler = EditorView.inputHandler.of((view, from, to, text) => {
  const { state } = view
  if (view.composing || state.readOnly || text.length !== 1 || state.selection.ranges.length !== 1) return false
  const { main } = state.selection
  if (main.from !== from || main.to !== to) return false
  const spec = main.empty ? typeAt(state, from, text) : wrapSelection(state, text)
  if (!spec) return false
  view.dispatch(spec)
  return true
})

// Backspace inside a pair the helper just opened removes both halves.
// `**|**` goes back to `*|`, the step before it paired.
export const deletePair: StateCommand = ({ state, dispatch }) => {
  const { main } = state.selection
  if (state.selection.ranges.length !== 1 || !main.empty) return false
  const pos = main.head
  let from: number
  let to: number
  if (
    state.sliceDoc(pos - 2, pos) === '**' &&
    state.sliceDoc(pos, pos + 2) === '**' &&
    closerAt(state, pos) &&
    closerAt(state, pos + 1)
  ) {
    from = pos - 1
    to = pos + 2
  } else {
    const close = PAIRS[state.sliceDoc(pos - 1, pos)]
    if (!close || state.sliceDoc(pos, pos + 1) !== close || !closerAt(state, pos)) return false
    from = pos - 1
    to = pos + 1
  }
  dispatch(
    state.update({
      changes: { from, to },
      selection: EditorSelection.cursor(from),
      scrollIntoView: true,
      userEvent: 'delete.backward'
    })
  )
  return true
}

const URL_TEXT = /^(https?:\/\/|mailto:)\S+$/

const balanced = (text: string) => text.split('(').length === text.split(')').length

// Pasting a URL onto a selection makes it the link's label. Anything else,
// including a URL pasted with nothing selected, pastes verbatim.
export function linkForPaste(state: EditorState, text: string): string | null {
  const url = text.trim()
  if (!URL_TEXT.test(url) || !balanced(url) || state.selection.ranges.length !== 1) return null
  const { from, to } = state.selection.main
  const label = state.sliceDoc(from, to)
  if (from === to || /[\n[\]]/.test(label) || URL_TEXT.test(label.trim()) || inCode(state, from)) return null
  return `[${label}](${url})`
}

const pasteHandler = EditorView.domEventHandlers({
  paste(event, view) {
    const link = linkForPaste(view.state, event.clipboardData?.getData('text/plain') ?? '')
    if (link === null) return false
    event.preventDefault()
    view.dispatch(view.state.replaceSelection(link), { scrollIntoView: true, userEvent: 'input.paste' })
    return true
  }
})

// Backspace is a typing key, like Enter and Tab in lists.ts; see D24 and D32.
export const typingHelpers = [
  closers,
  typingHandler,
  pasteHandler,
  keymap.of([{ key: 'Backspace', run: deletePair }])
]
