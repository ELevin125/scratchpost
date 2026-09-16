import { history, standardKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { closeSearchPanel, search } from '@codemirror/search'
import { EditorSelection, EditorState, type Extension, type TransactionSpec } from '@codemirror/state'
import { drawSelection, EditorView, keymap, type ViewUpdate } from '@codemirror/view'
import { Strikethrough, TaskList } from '@lezer/markdown'
import { codeHighlighting, codeLanguages } from './codeLanguages'
import { revealArmed } from './decorations'
import { listKeymap } from './lists'
import { livePreview } from './livePreview'
import { renumberLists } from './renumber'
import { editorTheme } from './theme'
import { typingHelpers } from './typing'

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
    // CommonMark plus GFM task lists and strikethrough; see MARKDOWN_SPEC.md.
    // The package's own Enter handling is off: lists.ts implements the spec's.
    // Fences naming a bundled language are highlighted; see codeLanguages.ts.
    markdown({ extensions: [TaskList, Strikethrough], addKeymap: false, codeLanguages }),
    codeHighlighting,
    revealArmed,
    livePreview,
    renumberLists,
    listKeymap,
    typingHelpers,
    // The find bar (2.12). Opening it is a registry command; Escape, scoped to
    // the bar, is the bar's own key. See D29.
    search({ top: true }),
    keymap.of([{ key: 'Escape', run: closeSearchPanel, scope: 'editor search-panel' }]),
    // Only cursor motion, selection and deletion. Every other binding is a
    // command in app/state/commands.ts. See D24.
    keymap.of(standardKeymap),
    editorTheme,
    EditorView.updateListener.of(onUpdate)
  ]
}

// anchor defaults to cursor; pass both to start with a selection, as opening a
// search result does.
export function createEditorState(doc: string, extensions: Extension[], cursor = 0, anchor = cursor): EditorState {
  const clamp = (pos: number) => Math.max(0, Math.min(pos, doc.length))
  return EditorState.create({
    doc,
    selection: EditorSelection.single(clamp(anchor), clamp(cursor)),
    extensions
  })
}

// Replaces a document with text from disk, changing only the part that
// differs, so the cursor and scroll stay put wherever the text is unchanged.
// Used when a note changes outside the app (3.1).
export function replaceDocSpec(state: EditorState, text: string): TransactionSpec | null {
  const current = state.doc.toString()
  if (current === text) return null
  let start = 0
  const max = Math.min(current.length, text.length)
  while (start < max && current.charCodeAt(start) === text.charCodeAt(start)) start++
  let end = 0
  while (
    end < max - start &&
    current.charCodeAt(current.length - 1 - end) === text.charCodeAt(text.length - 1 - end)
  ) {
    end++
  }
  return { changes: { from: start, to: current.length - end, insert: text.slice(start, text.length - end) } }
}
