import { EditorView } from '@codemirror/view'

// CSS custom properties only; values live in themes/. See docs/THEMING.md.
// Sizes are in em against the 13px body so the heading ramp scales with the
// font-size setting: h1 18px, h2 15px, h3 13px.
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--body)',
    backgroundColor: 'var(--paper)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.75' },
  '.cm-content': { padding: '16px 24px', caretColor: 'var(--ink)' },
  // No default line padding, so hanging indents in ch line up exactly.
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--bar)' },

  // Live preview
  '.cm-heading': { fontWeight: '500', color: 'var(--ink)' },
  '.cm-h1': { fontSize: `${18 / 13}em` },
  '.cm-h2': { fontSize: `${15 / 13}em` },
  '.cm-h3': { fontSize: '1em' },
  '.cm-bullet': { color: 'var(--ink-soft)' },
  '.cm-task-done': { color: 'var(--ink-soft)', textDecoration: 'line-through' },

  // 2ch wide, matching CHECKBOX_COLS in checkbox.ts. Square corners.
  '.cm-checkbox': {
    position: 'relative',
    display: 'inline-block',
    width: '2ch',
    height: '1em',
    verticalAlign: '-0.125em',
    cursor: 'pointer'
  },
  '.cm-checkbox::before': {
    content: '""',
    position: 'absolute',
    left: '0',
    top: '0.075em',
    width: '0.85em',
    height: '0.85em',
    boxSizing: 'border-box',
    border: '1px solid var(--ink-soft)'
  },
  '.cm-checkbox-done::before': {
    backgroundColor: 'var(--spot)',
    borderColor: 'var(--spot)'
  },
  '.cm-checkbox-done::after': {
    content: '""',
    position: 'absolute',
    left: '0.3em',
    top: '0.2em',
    width: '0.22em',
    height: '0.42em',
    borderRight: '1.5px solid var(--paper)',
    borderBottom: '1.5px solid var(--paper)',
    transform: 'rotate(45deg)'
  }
})
