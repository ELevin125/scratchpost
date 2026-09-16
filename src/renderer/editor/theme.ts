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

  // Inline formatting
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strong': { fontWeight: '500' },
  '.cm-strike': { textDecoration: 'line-through' },
  '.cm-inline-code': { backgroundColor: 'var(--bar)' },
  '.cm-link': { color: 'var(--spot)', textDecoration: 'underline', cursor: 'pointer' },

  // Find bar (2.12). Selectors carry extra classes to outrank CodeMirror's
  // base theme, which styles these for its own light and dark modes.
  '.cm-panels': { backgroundColor: 'var(--paper-2)', color: 'var(--body)' },
  '.cm-panels.cm-panels-top': { borderBottom: '1px solid var(--rule)' },
  '& .cm-panel.cm-search': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px 8px',
    padding: '6px 12px 6px 24px',
    fontSize: '12px'
  },
  '& .cm-panel.cm-search br': { flexBasis: '100%', height: '0' },
  '& .cm-panel.cm-search .cm-textfield': {
    font: 'inherit',
    color: 'var(--ink)',
    backgroundColor: 'var(--paper)',
    border: '1px solid var(--rule)',
    borderRadius: '0',
    padding: '2px 6px',
    margin: '0'
  },
  '& .cm-panel.cm-search .cm-button': {
    font: 'inherit',
    color: 'var(--body)',
    backgroundColor: 'var(--paper)',
    backgroundImage: 'none',
    border: '1px solid var(--rule)',
    borderRadius: '0',
    padding: '2px 8px',
    margin: '0'
  },
  '& .cm-panel.cm-search .cm-button:hover': { backgroundColor: 'var(--bar)' },
  '& .cm-panel.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--ink-soft)' },
  '& .cm-panel.cm-search button[name=close]': {
    position: 'static',
    marginLeft: 'auto',
    color: 'var(--ink-soft)',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '14px'
  },
  '& .cm-content .cm-line .cm-searchMatch': { backgroundColor: 'var(--bar)' },
  '& .cm-content .cm-line .cm-searchMatch-selected': { outline: '1px solid var(--ink-soft)' },

  // Block constructs
  '.cm-quote': { borderLeft: '1px solid var(--rule)', paddingLeft: '12px' },
  // The shadow fills the sub-pixel gap fractional line heights leave between
  // tinted lines, which otherwise shows as faint stripes.
  '.cm-code-block': { backgroundColor: 'var(--bar)', boxShadow: '0 1px 0 var(--bar)' },
  // Highlighting (2.21). Scoped to code block lines; see codeLanguages.ts.
  '.cm-code-block .cm-code-keyword': { color: 'var(--ink)', fontWeight: '500' },
  '.cm-code-block .cm-code-string': { color: 'var(--code-string)' },
  '.cm-code-block .cm-code-literal': { color: 'var(--code-literal)' },
  '.cm-code-block .cm-code-comment': { color: 'var(--ink-soft)', fontStyle: 'italic' },
  '.cm-code-block .cm-code-name': { color: 'var(--code-name)' },
  '.cm-hr': {
    backgroundImage: 'linear-gradient(var(--rule), var(--rule))',
    backgroundSize: '100% 1px',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat'
  },

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
