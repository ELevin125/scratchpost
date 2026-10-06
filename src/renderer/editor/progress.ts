import { Decoration, WidgetType } from '@codemirror/view'
import { countBoxes, isPlainAt, listBeside, taskBoxes } from './checklist'
import type { Context } from './decorations'

// `[%]` on a line of its own draws a progress bar for the checklist beside it
// (6.1). The bar is a view of the list's boxes; nothing is written to the
// note. See MARKDOWN_SPEC.md, "Checklists".

const PROGRESS_LINE = /^([ \t]*)\[%\][ \t]*$/

// Drawn in CSS (theme.ts), so no colour lives here.
class ProgressWidget extends WidgetType {
  constructor(
    readonly done: number,
    readonly total: number
  ) {
    super()
  }

  eq(other: ProgressWidget): boolean {
    return other.done === this.done && other.total === this.total
  }

  toDOM(): HTMLElement {
    const { done, total } = this
    const bar = document.createElement('span')
    bar.className = total > 0 && done === total ? 'cm-progress cm-progress-full' : 'cm-progress'
    bar.setAttribute('role', 'progressbar')
    bar.setAttribute('aria-valuemin', '0')
    bar.setAttribute('aria-valuemax', String(total))
    bar.setAttribute('aria-valuenow', String(done))

    const track = bar.appendChild(document.createElement('span'))
    track.className = 'cm-progress-track'
    const fill = track.appendChild(document.createElement('span'))
    fill.className = 'cm-progress-fill'
    fill.style.width = `${total === 0 ? 0 : (done / total) * 100}%`

    const count = bar.appendChild(document.createElement('span'))
    count.className = 'cm-progress-count'
    count.textContent = total === 0 ? 'no checklist' : `${done}/${total}`
    return bar
  }
}

export function decorateProgress(ctx: Context, from: number, to: number): void {
  const { state } = ctx
  for (let pos = from; pos <= to; ) {
    const line = state.doc.lineAt(pos)
    pos = line.to + 1
    const match = PROGRESS_LINE.exec(line.text)
    // On a revealed line the three characters show, like any other syntax.
    if (!match || ctx.revealedAt(line.from)) continue
    const start = line.from + match[1].length
    if (isPlainAt(state, start)) continue
    const list = listBeside(state, start)
    const { open, done } = list ? countBoxes(taskBoxes(state, list.from, list.to)) : { open: 0, done: 0 }
    const widget = Decoration.replace({ widget: new ProgressWidget(done, open + done) })
    ctx.add(`progress:${start}`, widget.range(start, start + 3))
  }
}
