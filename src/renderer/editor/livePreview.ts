import { syntaxTree } from '@codemirror/language'
import type { EditorState, Range } from '@codemirror/state'
import {
  Decoration,
  ViewPlugin,
  type DecorationSet,
  type EditorView,
  type ViewUpdate
} from '@codemirror/view'
import {
  decorateFencedCode,
  decorateHeading,
  decorateListItem,
  decorateQuote,
  decorateRule,
  hideQuoteMark
} from './blocks'
import { toggleTaskAt } from './checkbox'
import { revealedLines, type Context } from './decorations'
import { decorateInline } from './inline'

// Live preview. Syntax is hidden except on lines holding a cursor or selection
// endpoint; see MARKDOWN_SPEC.md, "Cursor reveal". Only visible ranges are
// walked. The decorations themselves live in blocks.ts and inline.ts.

// Rendered as plain text: nothing inside is decorated.
const UNSUPPORTED_BLOCKS = new Set(['CodeBlock', 'HTMLBlock', 'Table'])

export function buildDecorations(
  state: EditorState,
  ranges: readonly { from: number; to: number }[]
): DecorationSet {
  const revealed = revealedLines(state)
  const decorations: Range<Decoration>[] = []
  const seen = new Set<string>()
  const ctx: Context = {
    state,
    revealedAt: (pos) => revealed.has(state.doc.lineAt(pos).number),
    add: (key, range) => {
      if (seen.has(key)) return
      seen.add(key)
      decorations.push(range)
    }
  }

  const tree = syntaxTree(state)
  for (const { from, to } of ranges) {
    let quoteDepth = 0
    tree.iterate({
      from,
      to,
      enter: (node) => {
        const { name } = node
        if (UNSUPPORTED_BLOCKS.has(name)) return false
        if (name === 'FencedCode') {
          decorateFencedCode(ctx, node.node)
          return false // contents are verbatim
        }
        if (name === 'HorizontalRule') {
          decorateRule(ctx, node.node)
          return false
        }
        if (name === 'Blockquote') {
          if (quoteDepth++ === 0) decorateQuote(ctx, node.node)
          return
        }
        if (name === 'QuoteMark') {
          hideQuoteMark(ctx, node.node)
          return
        }
        // Headings, lists and checkboxes inside quotes stay plain text;
        // inline formatting still renders there.
        if (quoteDepth === 0) {
          const heading = /^ATXHeading([1-6])$/.exec(name)
          if (heading) return decorateHeading(ctx, node.node, Number(heading[1]))
          if (name === 'ListItem') return decorateListItem(ctx, node.node)
        }
        decorateInline(ctx, node.node)
      },
      leave: (node) => {
        if (node.name === 'Blockquote') quoteDepth--
      }
    })
  }
  return Decoration.set(decorations, true)
}

export const livePreview = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view.state, view.visibleRanges)
    }

    update(update: ViewUpdate) {
      if (
        update.docChanged ||
        update.viewportChanged ||
        update.selectionSet ||
        syntaxTree(update.startState) !== syntaxTree(update.state)
      ) {
        this.decorations = buildDecorations(update.state, update.view.visibleRanges)
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations,
    eventHandlers: {
      // Handling mousedown stops CodeMirror placing the cursor, so these clicks
      // never move the selection.
      mousedown(event, view) {
        const target = event.target
        if (event.button !== 0 || !(target instanceof HTMLElement)) return false

        if (target.classList.contains('cm-checkbox')) {
          const spec = toggleTaskAt(view.state, view.posAtDOM(target))
          if (spec) view.dispatch(spec)
          event.preventDefault()
          return true
        }

        // A rendered link opens in the system browser. On a revealed line the
        // syntax is showing, so a click edits instead.
        const link = target.closest<HTMLElement>('.cm-link')
        const href = link?.dataset.href
        if (link && href) {
          const line = view.state.doc.lineAt(view.posAtDOM(link))
          if (revealedLines(view.state).has(line.number)) return false
          event.preventDefault()
          window.scratchpost.openExternal(href).catch(() => {})
          return true
        }
        return false
      }
    }
  }
)
