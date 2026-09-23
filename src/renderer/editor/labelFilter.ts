import { StateEffect, StateField, type EditorState, type Range, type Text, type Transaction } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'
import { labelsOnLine, tagKey } from '../../shared/tags'

// Filtering a note by a label (5.5, D44): clicking a `[label]` shows only the
// lines carrying it; everything else collapses into a "12 lines" marker you
// can click to come back. The text itself is untouched, so saving, history and
// undo see a normal note.

export const setLabelFilter = StateEffect.define<string | null>()

// Fired on window whenever the filter changes, so the app can show its bar.
export const LABEL_FILTER_EVENT = 'scratchpost:labelfilter'

// The one way the filter changes: the editor state and the app stay in step.
export function applyLabelFilter(view: EditorView, word: string | null): void {
  view.dispatch({ effects: setLabelFilter.of(word) })
  window.dispatchEvent(new CustomEvent(LABEL_FILTER_EVENT, { detail: word }))
}

export const labelFilter = StateField.define<string | null>({
  create: () => null,
  update(word, tr) {
    for (const effect of tr.effects) if (effect.is(setLabelFilter)) return effect.value
    return word
  }
})

export const labelFilterOf = (state: EditorState): string | null => state.field(labelFilter, false) ?? null

class HiddenLinesWidget extends WidgetType {
  constructor(readonly lines: number) {
    super()
  }

  eq(other: HiddenLinesWidget): boolean {
    return other.lines === this.lines
  }

  toDOM(): HTMLElement {
    const el = document.createElement('div')
    el.className = 'cm-hidden-lines'
    el.textContent = `${this.lines} ${this.lines === 1 ? 'line' : 'lines'}`
    el.title = 'Show every line again'
    return el
  }

  ignoreEvent(): boolean {
    return false
  }
}

// Runs of lines without the label collapse into one widget each.
function filterDecorations(state: EditorState): DecorationSet {
  const word = labelFilterOf(state)
  if (word === null) return Decoration.none
  const wanted = tagKey(word)
  const ranges: Range<Decoration>[] = []
  const { doc } = state
  let runFrom: number | null = null
  let runTo = 0
  let runLines = 0

  const flush = () => {
    if (runFrom === null) return
    ranges.push(
      Decoration.replace({ block: true, widget: new HiddenLinesWidget(runLines) }).range(runFrom, runTo)
    )
    runFrom = null
    runLines = 0
  }

  for (let n = 1; n <= doc.lines; n++) {
    const line = doc.line(n)
    if (labelsOnLine(line.text).has(wanted)) {
      flush()
      continue
    }
    if (runFrom === null) runFrom = line.from
    runTo = line.to
    runLines++
  }
  flush()
  return Decoration.set(ranges, true)
}

// Whether a change could move a line in or out of the filter: only then is the
// whole note walked again. Typing inside a line that already matches, which is
// what happens most while filtered, just maps what is already there.
function membershipChanged(tr: Transaction, word: string): boolean {
  const wanted = tagKey(word)
  const has = (doc: Text, from: number, to: number) => {
    const first = doc.lineAt(Math.min(from, doc.length)).number
    const last = doc.lineAt(Math.min(to, doc.length)).number
    const lines: boolean[] = []
    for (const text of doc.iterLines(first, last + 1)) lines.push(labelsOnLine(text).has(wanted))
    return lines
  }
  let changed = false
  tr.changes.iterChanges((fromA, toA, fromB, toB) => {
    if (changed) return
    const before = has(tr.startState.doc, fromA, toA)
    const after = has(tr.state.doc, fromB, toB)
    changed = before.length !== after.length || before.some((match, i) => match !== after[i])
  })
  return changed
}

const filterDecorationsField = StateField.define<DecorationSet>({
  create: filterDecorations,
  update(value, tr) {
    const word = labelFilterOf(tr.state)
    if (tr.effects.some((effect) => effect.is(setLabelFilter))) return filterDecorations(tr.state)
    if (!tr.docChanged || word === null) return value.map(tr.changes)
    return membershipChanged(tr, word) ? filterDecorations(tr.state) : value.map(tr.changes)
  },
  provide: (field) => EditorView.decorations.from(field)
})

// Clicking the marker shows the whole note again.
const clearOnClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!(event.target instanceof HTMLElement) || !event.target.closest('.cm-hidden-lines')) return false
    event.preventDefault()
    applyLabelFilter(view, null)
    return true
  }
})

export const labelFiltering = [labelFilter, filterDecorationsField, clearOnClick]
