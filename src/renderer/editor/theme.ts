import { EditorView } from '@codemirror/view'

// CSS custom properties only; values live in themes/. See docs/THEMING.md.
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--body)',
    backgroundColor: 'var(--paper)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.75' },
  '.cm-content': { padding: '16px 24px', caretColor: 'var(--ink)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--bar)' }
})
