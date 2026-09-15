import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState } from '@codemirror/state'
import { drawSelection, EditorView, keymap } from '@codemirror/view'
import { editorTheme } from './theme'

export interface EditorStats {
  line: number
  column: number
  words: number
}

export function statsFor(state: EditorState): EditorStats {
  const head = state.selection.main.head
  const line = state.doc.lineAt(head)
  const words = state.doc.toString().match(/\S+/g)?.length ?? 0
  return { line: line.number, column: head - line.from + 1, words }
}

interface EditorOptions {
  doc?: string
  onStats?: (stats: EditorStats) => void
}

export function createEditor(parent: HTMLElement, opts: EditorOptions = {}): EditorView {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: opts.doc ?? '',
      extensions: [
        history(),
        drawSelection(),
        EditorView.lineWrapping,
        markdown(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        editorTheme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged || update.selectionSet) opts.onStats?.(statsFor(update.state))
        })
      ]
    })
  })
  opts.onStats?.(statsFor(view.state))
  return view
}
