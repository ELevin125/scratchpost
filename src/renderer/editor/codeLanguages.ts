import { LanguageDescription, LanguageSupport, StreamLanguage, syntaxHighlighting } from '@codemirror/language'
import { tagHighlighter, tags as t } from '@lezer/highlight'

// Fenced code highlighting (2.21, D32). A small bundled set, each loaded the
// first time a fence names it. Any other info string stays verbatim text.
export const codeLanguages: LanguageDescription[] = [
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'jsx', 'mjs', 'cjs'],
    load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true })
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'tsx', 'mts', 'cts'],
    load: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true, typescript: true })
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['jsonc', 'json5'],
    load: async () => (await import('@codemirror/lang-json')).json()
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    load: async () => (await import('@codemirror/lang-python')).python()
  }),
  LanguageDescription.of({
    name: 'CSS',
    load: async () => (await import('@codemirror/lang-css')).css()
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['htm'],
    load: async () => (await import('@codemirror/lang-html')).html()
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['sh', 'bash', 'zsh', 'console'],
    load: async () => {
      const { shell } = await import('@codemirror/legacy-modes/mode/shell')
      return new LanguageSupport(StreamLanguage.define(shell))
    }
  })
]

// Class names only; theme.ts colours them, and only inside code block lines,
// so markdown's own tokens (an HTML comment, say) never pick them up.
export const codeHighlighter = tagHighlighter([
  {
    tag: [
      t.keyword,
      t.controlKeyword,
      t.moduleKeyword,
      t.definitionKeyword,
      t.operatorKeyword,
      t.modifier,
      t.self
    ],
    class: 'cm-code-keyword'
  },
  { tag: [t.string, t.special(t.string), t.regexp, t.attributeValue], class: 'cm-code-string' },
  { tag: [t.number, t.bool, t.null, t.atom, t.unit], class: 'cm-code-literal' },
  { tag: [t.lineComment, t.blockComment, t.docComment, t.comment], class: 'cm-code-comment' },
  {
    tag: [
      t.function(t.variableName),
      t.function(t.propertyName),
      t.function(t.definition(t.variableName)),
      t.definition(t.className),
      t.className,
      t.typeName,
      t.tagName
    ],
    class: 'cm-code-name'
  }
])

export const codeHighlighting = syntaxHighlighting(codeHighlighter)
