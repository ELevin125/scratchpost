import type { ChangeSpec, EditorState, StateCommand, TransactionSpec } from '@codemirror/state'
import { WidgetType } from '@codemirror/view'

// Width in ch; blocks.ts uses it for the hanging indent.
export const CHECKBOX_COLS = 2

// Drawn entirely in CSS (theme.ts), so no colour lives here.
export class CheckboxWidget extends WidgetType {
  readonly checked: boolean

  constructor(checked: boolean) {
    super()
    this.checked = checked
  }

  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked
  }

  toDOM(): HTMLElement {
    const box = document.createElement('span')
    box.className = this.checked ? 'cm-checkbox cm-checkbox-done' : 'cm-checkbox'
    box.setAttribute('role', 'checkbox')
    box.setAttribute('aria-checked', String(this.checked))
    return box
  }

  // Let clicks reach the livePreview mousedown handler.
  ignoreEvent(): boolean {
    return false
  }
}

const TASK = /^(\s*[-*+]\s+\[)([ xX])\](?=[ \t])/

// Flips `- [ ]` and `- [x]` on the line containing pos. Same-length change,
// so every selection stays exactly where it was.
export function toggleTaskAt(state: EditorState, pos: number): TransactionSpec | null {
  const line = state.doc.lineAt(pos)
  const match = TASK.exec(line.text)
  if (!match) return null
  const at = line.from + match[1].length
  return {
    changes: { from: at, to: at + 1, insert: match[2] === ' ' ? 'x' : ' ' },
    userEvent: 'input.toggle'
  }
}

// Ctrl+Enter and the toggle command: flips every task line touched by a
// selection. Returns false when there is no task to toggle.
export const toggleTasksAtSelection: StateCommand = ({ state, dispatch }) => {
  const changes: ChangeSpec[] = []
  const seen = new Set<number>()
  for (const range of state.selection.ranges) {
    for (let pos = range.from; pos <= range.to; ) {
      const line = state.doc.lineAt(pos)
      pos = line.to + 1
      if (seen.has(line.number)) continue
      seen.add(line.number)
      const spec = toggleTaskAt(state, line.from)
      if (spec?.changes) changes.push(spec.changes)
    }
  }
  if (changes.length === 0) return false
  dispatch(state.update({ changes, userEvent: 'input.toggle' }))
  return true
}
