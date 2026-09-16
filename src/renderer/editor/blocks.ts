import { countColumn } from '@codemirror/state'
import { Decoration, WidgetType } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { CHECKBOX_COLS, CheckboxWidget } from './checkbox'
import { hidden, skipSpaces, type Context } from './decorations'

// Block-level live preview: headings, list items, checkboxes, block quotes,
// fenced code and horizontal rules. See MARKDOWN_SPEC.md.

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

const bullet = Decoration.replace({ widget: new BulletWidget() })
const checkbox = {
  open: Decoration.replace({ widget: new CheckboxWidget(false) }),
  done: Decoration.replace({ widget: new CheckboxWidget(true) })
}
const doneText = Decoration.mark({ class: 'cm-task-done' })
const quoteLine = Decoration.line({ class: 'cm-quote' })
const codeLine = Decoration.line({ class: 'cm-code-block' })
// The block's first and last lines round its corners.
const codeFirst = Decoration.line({ class: 'cm-code-block cm-code-first' })
const codeLast = Decoration.line({ class: 'cm-code-block cm-code-last' })
const codeOnly = Decoration.line({ class: 'cm-code-block cm-code-first cm-code-last' })
const ruleLine = Decoration.line({ class: 'cm-hr' })

// h4 to h6 render at h3 size.
const headingLines = [1, 2, 3, 4, 5, 6].map((level) =>
  Decoration.line({ class: `cm-heading cm-h${Math.min(level, 3)}` })
)

// Wrapped lines of a list item align with its text, not its marker.
const hangingIndent = (cols: number) =>
  Decoration.line({ attributes: { style: `padding-left: ${cols}ch; text-indent: -${cols}ch` } })

export function decorateHeading(ctx: Context, node: SyntaxNode, level: number): void {
  const line = ctx.state.doc.lineAt(node.from)
  ctx.add(`heading:${line.from}`, headingLines[level - 1].range(line.from))

  const mark = node.firstChild
  if (ctx.revealedAt(line.from) || mark?.name !== 'HeaderMark') return
  ctx.add(`heading-mark:${mark.from}`, hidden.range(mark.from, skipSpaces(ctx.state, mark.to, line.to)))
}

export function decorateListItem(ctx: Context, item: SyntaxNode): void {
  const { state } = ctx
  const mark = item.getChild('ListMark')
  if (!mark) return

  const line = state.doc.lineAt(mark.from)
  const ordered = item.parent?.name === 'OrderedList'
  const task = ordered ? null : item.getChild('Task')?.getChild('TaskMarker')
  const taskMarker = task && task.to <= line.to ? task : null
  const contentStart = skipSpaces(state, taskMarker ? taskMarker.to : mark.to, line.to)
  const done = taskMarker !== null && state.sliceDoc(taskMarker.from, taskMarker.to) !== '[ ]'
  const colsTo = (pos: number) => countColumn(state.sliceDoc(line.from, pos), state.tabSize)

  // Styling stays on revealed lines; only the syntax reappears.
  if (done && contentStart < line.to) ctx.add(`done:${contentStart}`, doneText.range(contentStart, line.to))

  let prefixCols = colsTo(contentStart)
  if (!ctx.revealedAt(line.from)) {
    if (taskMarker) {
      ctx.add(`list-mark:${mark.from}`, (done ? checkbox.done : checkbox.open).range(mark.from, contentStart))
      prefixCols = colsTo(mark.from) + CHECKBOX_COLS
    } else if (!ordered) {
      ctx.add(`list-mark:${mark.from}`, bullet.range(mark.from, mark.to))
    }
  }
  ctx.add(`indent:${line.from}`, hangingIndent(prefixCols).range(line.from))
}

// One hairline for every line of the outermost quote, lazy continuation
// lines included.
export function decorateQuote(ctx: Context, node: SyntaxNode): void {
  const { doc } = ctx.state
  const last = doc.lineAt(node.to).number
  for (let n = doc.lineAt(node.from).number; n <= last; n++) {
    const line = doc.line(n)
    ctx.add(`quote:${line.from}`, quoteLine.range(line.from))
  }
}

export function hideQuoteMark(ctx: Context, mark: SyntaxNode): void {
  if (ctx.revealedAt(mark.from)) return
  const end = ctx.state.sliceDoc(mark.to, mark.to + 1) === ' ' ? mark.to + 1 : mark.to
  ctx.add(`quote-mark:${mark.from}`, hidden.range(mark.from, end))
}

// Tinted lines, fences hidden per line, contents verbatim.
export function decorateFencedCode(ctx: Context, node: SyntaxNode): void {
  const { doc } = ctx.state
  const first = doc.lineAt(node.from).number
  const last = doc.lineAt(node.to).number
  for (let n = first; n <= last; n++) {
    const line = doc.line(n)
    const deco = first === last ? codeOnly : n === first ? codeFirst : n === last ? codeLast : codeLine
    ctx.add(`code:${line.from}`, deco.range(line.from))
  }

  // Each fence's marker and info string (```js) hide to the end of its line.
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== 'CodeMark' || ctx.revealedAt(child.from)) continue
    ctx.add(`fence:${child.from}`, hidden.range(child.from, doc.lineAt(child.from).to))
  }
}

export function decorateRule(ctx: Context, node: SyntaxNode): void {
  if (ctx.revealedAt(node.from)) return
  const line = ctx.state.doc.lineAt(node.from)
  ctx.add(`hr:${line.from}`, ruleLine.range(line.from))
  ctx.add(`hr-mark:${node.from}`, hidden.range(node.from, node.to))
}
