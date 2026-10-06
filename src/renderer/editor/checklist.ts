import { syntaxTree } from '@codemirror/language'
import type { EditorState, StateCommand } from '@codemirror/state'
import type { SyntaxNode } from '@lezer/common'
import type { TaskCount } from './createEditor'
import { PLAIN_BLOCKS, skipSpaces } from './decorations'

// Whole checklists (6.1, 6.2): finding the list a line belongs to, counting
// its boxes, and ticking or unticking all of them. A checklist is a whole
// list, nested items included. See MARKDOWN_SPEC.md, "Checklists".

export interface TaskBox {
  from: number // position of the `[`
  done: boolean
}

const isList = (node: SyntaxNode) => node.name === 'BulletList' || node.name === 'OrderedList'

function inPlainBlock(node: SyntaxNode | null): boolean {
  for (; node; node = node.parent) if (PLAIN_BLOCKS.has(node.name)) return true
  return false
}

// Inside a quote or code, where lists and checkboxes stay plain text.
export const isPlainAt = (state: EditorState, pos: number): boolean =>
  inPlainBlock(syntaxTree(state).resolveInner(pos, 1))

// The boxes that render as checkboxes between two positions: bullet items,
// outside quotes and code.
export function taskBoxes(state: EditorState, from: number, to: number): TaskBox[] {
  const boxes: TaskBox[] = []
  syntaxTree(state).iterate({
    from,
    to,
    enter: (node) => {
      if (PLAIN_BLOCKS.has(node.name)) return false
      if (node.name !== 'TaskMarker' || node.from < from || node.to > to) return
      if (node.node.parent?.parent?.parent?.name !== 'BulletList') return
      boxes.push({ from: node.from, done: state.sliceDoc(node.from, node.to) !== '[ ]' })
    }
  })
  return boxes
}

export function countBoxes(boxes: readonly TaskBox[]): TaskCount {
  const done = boxes.filter((box) => box.done).length
  return { open: boxes.length - done, done }
}

// The outermost list holding the line at pos.
export function listAt(state: EditorState, pos: number): SyntaxNode | null {
  const line = state.doc.lineAt(pos)
  const start = syntaxTree(state).resolveInner(skipSpaces(state, line.from, line.to), 1)
  if (inPlainBlock(start)) return null
  let list: SyntaxNode | null = null
  for (let node: SyntaxNode | null = start; node; node = node.parent) if (isList(node)) list = node
  return list
}

// The list a progress line counts: the one right below it, else the one right
// above, else the one it sits inside. A line typed straight under a list is
// part of that list's last item as far as markdown is concerned, so of the
// lists around it the one that starts no further right than the line is used.
export function listBeside(state: EditorState, pos: number): SyntaxNode | null {
  const line = state.doc.lineAt(pos)
  const at = skipSpaces(state, line.from, line.to)
  let block = syntaxTree(state).resolveInner(at, 1)
  if (inPlainBlock(block)) return null
  while (block.parent && !['Document', 'ListItem'].includes(block.parent.name)) block = block.parent

  const next = block.nextSibling
  if (next && isList(next)) return next
  const previous = block.prevSibling
  if (previous && isList(previous)) return previous

  const column = at - line.from
  let outermost: SyntaxNode | null = null
  for (let node = block.parent; node; node = node.parent) {
    if (!isList(node)) continue
    if (node.from - state.doc.lineAt(node.from).from <= column) return node
    outermost = node
  }
  return outermost
}

// What "tick all" acts on: the boxes on the selected lines, or with nothing
// selected, the whole list around the cursor.
export function tasksInScope(state: EditorState): TaskBox[] {
  const { ranges, main } = state.selection
  if (ranges.every((range) => range.empty)) {
    const list = listAt(state, main.head)
    return list ? taskBoxes(state, list.from, list.to) : []
  }
  const boxes = new Map<number, TaskBox>()
  for (const range of ranges) {
    const from = state.doc.lineAt(range.from).from
    const to = state.doc.lineAt(range.to).to
    for (const box of taskBoxes(state, from, to)) boxes.set(box.from, box)
  }
  return [...boxes.values()]
}

// Ticks or unticks every box in scope, as one undoable edit. Same-length
// changes, so the selection stays where it was.
export function setTasks(checked: boolean): StateCommand {
  return ({ state, dispatch }) => {
    const changes = tasksInScope(state)
      .filter((box) => box.done !== checked)
      .map((box) => ({ from: box.from + 1, to: box.from + 2, insert: checked ? 'x' : ' ' }))
    if (changes.length === 0) return false
    dispatch(state.update({ changes, userEvent: 'input.toggle' }))
    return true
  }
}
