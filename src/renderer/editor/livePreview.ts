import { syntaxTree } from '@codemirror/language'
import { countColumn, type EditorState, type Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { CHECKBOX_COLS, CheckboxWidget, toggleTaskAt } from './checkbox'

// Live preview for headings, bullets, numbered items and checkboxes.
// Syntax is hidden except on lines holding a cursor or selection endpoint;
// see MARKDOWN_SPEC.md, "Cursor reveal". Only visible ranges are walked.

const MAX_LIST_DEPTH = 3

// Blocks the spec treats as plain text; nothing inside them is decorated.
export const PLAIN_BLOCKS = new Set(['Blockquote', 'FencedCode', 'CodeBlock', 'HTMLBlock', 'Table'])

class BulletWidget extends WidgetType {
  eq(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '•'
    return span
  }
}

const hidden = Decoration.replace({})
const bullet = Decoration.replace({ widget: new BulletWidget() })
const checkbox = {
  open: Decoration.replace({ widget: new CheckboxWidget(false) }),
  done: Decoration.replace({ widget: new CheckboxWidget(true) })
}
const doneText = Decoration.mark({ class: 'cm-task-done' })

// h4 to h6 render at h3 size.
const headingLines = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-heading cm-h${Math.min(level, 3)}` })
)

// Wrapped lines of a list item align with its text, not its marker.
const hangingIndent = (cols: number) =>
  Decoration.line({ attributes: { style: `padding-left: ${cols}ch; text-indent: -${cols}ch` } })

// Every line holding a cursor or a selection endpoint. A selection spanning
// lines 3 to 7 reveals 3 and 7 only.
export function revealedLines(state: EditorState): Set<number> {
  const lines = new Set<number>()
  for (const range of state.selection.ranges) {
    lines.add(state.doc.lineAt(range.anchor).number)
    lines.add(state.doc.lineAt(range.head).number)
  }
  return lines
}

type Add = (key: string, range: Range<Decoration>) => void

function skipSpaces(state: EditorState, pos: number, end: number): number {
  while (pos < end && /[ \t]/.test(state.sliceDoc(pos, pos + 1))) pos++
  return pos
}

function listDepth(item: SyntaxNode): number {
  let depth = 0
  for (let node = item.parent; node; node = node.parent) {
    if (node.name === 'BulletList' || node.name === 'OrderedList') depth++
  }
  return depth
}

function decorateHeading(state: EditorState, node: SyntaxNode, level: number, revealed: Set<number>, add: Add) {
  const line = state.doc.lineAt(node.from)
  add(`heading:${line.from}`, headingLines[level - 1].range(line.from))

  const mark = node.firstChild
  if (revealed.has(line.number) || mark?.name !== 'HeaderMark') return
  add(`hide:${mark.from}`, hidden.range(mark.from, skipSpaces(state, mark.to, line.to)))
}

function decorateListItem(state: EditorState, item: SyntaxNode, revealed: Set<number>, add: Add) {
  const mark = item.getChild('ListMark')
  if (!mark || listDepth(item) > MAX_LIST_DEPTH) return

  const line = state.doc.lineAt(mark.from)
  const ordered = item.parent?.name === 'OrderedList'
  const task = ordered ? null : item.getChild('Task')?.getChild('TaskMarker')
  const taskMarker = task && task.to <= line.to ? task : null
  const contentStart = skipSpaces(state, taskMarker ? taskMarker.to : mark.to, line.to)
  const done = taskMarker !== null && state.sliceDoc(taskMarker.from, taskMarker.to) !== '[ ]'
  const colsTo = (pos: number) => countColumn(state.sliceDoc(line.from, pos), state.tabSize)

  // Styling stays on revealed lines; only the syntax reappears.
  if (done && contentStart < line.to) add(`done:${contentStart}`, doneText.range(contentStart, line.to))

  let prefixCols = colsTo(contentStart)
  if (!revealed.has(line.number)) {
    if (taskMarker) {
      add(`hide:${mark.from}`, (done ? checkbox.done : checkbox.open).range(mark.from, contentStart))
      prefixCols = colsTo(mark.from) + CHECKBOX_COLS
    } else if (!ordered) {
      add(`hide:${mark.from}`, bullet.range(mark.from, mark.to))
    }
  }
  add(`indent:${line.from}`, hangingIndent(prefixCols).range(line.from))
}

export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const revealed = revealedLines(state)
  const decorations: Range<Decoration>[] = []
  // A node crossing two visible ranges is visited twice; decorate it once.
  const seen = new Set<string>()
  const add: Add = (key, range) => {
    if (seen.has(key)) return
    seen.add(key)
    decorations.push(range)
  }

  const tree = syntaxTree(state)
  for (const { from, to } of ranges) {
    tree.iterate({
      from,
      to,
      enter: (node) => {
        if (PLAIN_BLOCKS.has(node.name)) return false
        const heading = /^ATXHeading([1-6])$/.exec(node.name)
        if (heading) decorateHeading(state, node.node, Number(heading[1]), revealed, add)
        else if (node.name === 'ListItem') decorateListItem(state, node.node, revealed, add)
      }
    })
  }
  return Decoration.set(decorations, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state, view.visibleRanges)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildDecorations(update.state, update.view.visibleRanges)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // Handling mousedown stops CodeMirror placing the cursor, so a click
      // toggles the checkbox without moving the selection.
      mousedown(event, view) {
        const target = event.target
        if (event.button !== 0 || !(target instanceof HTMLElement)) return false
        if (!target.classList.contains('cm-checkbox')) return false
        const spec = toggleTaskAt(view.state, view.posAtDOM(target))
        if (spec) view.dispatch(spec)
        event.preventDefault()
        return true
      }
    }
  }
)
