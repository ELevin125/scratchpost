import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { EditorState, type Extension } from '@codemirror/state'
import { drawSelection, EditorView, keymap, type ViewUpdate } from '@codemirror/view'
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

// Shared by every tab's EditorState; one EditorView swaps between them.
export function editorExtensions(onUpdate: (update: ViewUpdate) => void): Extension[] {
  return [
    history(),
    drawSelection(),
    EditorView.lineWrapping,
    markdown(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    editorTheme,
    EditorView.updateListener.of(onUpdate)
  ]
}

export function createEditorState(doc: string, extensions: Extension[]): EditorState {
  return EditorState.create({ doc, extensions })
}
