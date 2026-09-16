import { EditorView } from '@codemirror/view'

// CSS custom properties only; values live in themes/. See docs/THEMING.md.
// Sizes are in em against the 13px body so the heading ramp scales with the
// font-size setting: h1 30px and h2 19px in the condensed title face (D33),
// h3 13px in mono.
export const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--body)',
    backgroundColor: 'transparent'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.75' },
  // Capped at 80 characters (D33), so notes hard-wrapped at 80 never wrap
  // twice; the bottom room keeps the last line clear of the dock.
  '.cm-content': { maxWidth: 'calc(80ch + 80px)', padding: '10px 40px 96px', caretColor: 'var(--ink)' },
  // No default line padding, so hanging indents in ch line up exactly.
  '.cm-line': { padding: '0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
  '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: 'var(--selection)' },

  // Live preview
  '.cm-heading': { fontWeight: '500', color: 'var(--ink)' },
  '.cm-h1': {
    fontFamily: 'var(--font-title)',
    fontSize: `${30 / 13}em`,
    fontWeight: '600',
    lineHeight: '1.35',
    letterSpacing: '-0.01em'
  },
  '.cm-h2': { fontFamily: 'var(--font-title)', fontSize: `${19 / 13}em`, fontWeight: '600', lineHeight: '1.5' },
  '.cm-h3': { fontSize: '1em' },
  '.cm-bullet': { color: 'var(--soft)' },
  '.cm-task-done': { color: 'var(--soft)', textDecoration: 'line-through' },

  // Inline formatting
  '.cm-em': { fontStyle: 'italic' },
  '.cm-strong': { fontWeight: '500' },
  '.cm-strike': { textDecoration: 'line-through' },
  '.cm-inline-code': { backgroundColor: 'var(--sunken)', borderRadius: '4px' },
  '.cm-link': { color: 'var(--chip)', textDecoration: 'underline', cursor: 'pointer' },

  // Find bar (2.12). Selectors carry extra classes to outrank CodeMirror's
  // base theme, which styles these for its own light and dark modes.
  '.cm-panels': { backgroundColor: 'transparent', color: 'var(--body)' },
  '.cm-panels.cm-panels-top': { borderBottom: 'none' },
  '& .cm-panel.cm-search': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '6px 8px',
    padding: '10px 20px 6px 40px',
    fontFamily: 'var(--font-sans)',
    fontSize: '12px'
  },
  '& .cm-panel.cm-search br': { flexBasis: '100%', height: '0' },
  '& .cm-panel.cm-search .cm-textfield': {
    font: 'inherit',
    color: 'var(--ink)',
    backgroundColor: 'var(--sunken)',
    border: 'none',
    borderRadius: '10px',
    padding: '5px 10px',
    margin: '0'
  },
  '& .cm-panel.cm-search .cm-button': {
    font: 'inherit',
    color: 'var(--body)',
    backgroundColor: 'var(--raised)',
    backgroundImage: 'none',
    border: 'none',
    borderRadius: '999px',
    padding: '5px 12px',
    margin: '0'
  },
  '& .cm-panel.cm-search .cm-button:hover': { color: 'var(--chip-ink)', backgroundColor: 'var(--chip)' },
  '& .cm-panel.cm-search label': { display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--soft)' },
  '& .cm-panel.cm-search button[name=close]': {
    position: 'static',
    marginLeft: 'auto',
    color: 'var(--soft)',
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '16px'
  },
  '& .cm-content .cm-line .cm-searchMatch': { backgroundColor: 'var(--selection)', borderRadius: '3px' },
  '& .cm-content .cm-line .cm-searchMatch-selected': { outline: '1.5px solid var(--chip)' },

  // Block constructs
  '.cm-quote': { borderLeft: '2px solid var(--line)', paddingLeft: '12px' },
  // The shadow fills the sub-pixel gap fractional line heights leave between
  // tinted lines, which otherwise shows as faint stripes.
  '.cm-code-block': { backgroundColor: 'var(--sunken)', boxShadow: '0 1px 0 var(--sunken)', paddingInline: '12px' },
  '.cm-code-first': { borderTopLeftRadius: '12px', borderTopRightRadius: '12px' },
  '.cm-code-last': { borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px', boxShadow: 'none' },
  // Highlighting (2.21). Scoped to code block lines; see codeLanguages.ts.
  '.cm-code-block .cm-code-keyword': { color: 'var(--ink)', fontWeight: '500' },
  '.cm-code-block .cm-code-string': { color: 'var(--code-string)' },
  '.cm-code-block .cm-code-literal': { color: 'var(--code-literal)' },
  '.cm-code-block .cm-code-comment': { color: 'var(--soft)', fontStyle: 'italic' },
  '.cm-code-block .cm-code-name': { color: 'var(--code-name)' },
  '.cm-hr': {
    backgroundImage: 'linear-gradient(var(--line), var(--line))',
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
    border: '1.5px solid var(--soft)',
    borderRadius: '3px'
  },
  '.cm-checkbox-done::before': {
    backgroundColor: 'var(--chip)',
    borderColor: 'var(--chip)'
  },
  '.cm-checkbox-done::after': {
    content: '""',
    position: 'absolute',
    left: '0.3em',
    top: '0.2em',
    width: '0.22em',
    height: '0.42em',
    borderRight: '1.5px solid var(--chip-ink)',
    borderBottom: '1.5px solid var(--chip-ink)',
    transform: 'rotate(45deg)'
  }
})
