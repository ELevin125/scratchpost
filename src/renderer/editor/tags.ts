import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { findLabels, findTags, tagHue } from '../../shared/tags'
import { hidden, type Context } from './decorations'

// `[label]` pills and `#tag` words. Matched by the shared patterns, not the
// markdown grammar, and rendered here rather than by a MatchDecorator so label
// brackets reveal with the cursor like all other syntax. See MARKDOWN_SPEC.md,
// "Labels and tags", and D34.

// Code and HTML are verbatim: no labels or tags inside.
const VERBATIM = new Set(['FencedCode', 'CodeBlock', 'InlineCode', 'HTMLBlock', 'HTMLTag', 'URL', 'Autolink'])

function inVerbatim(ctx: Context, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(ctx.state).resolveInner(pos, 1); node; node = node.parent) {
    if (VERBATIM.has(node.name)) return true
  }
  return false
}

// The hue rides on a CSS custom property; the colour itself is built in
// global.css from theme tokens, so no colour literal lives here.
const hueStyle = (word: string) => ({ style: `--tag-hue: ${tagHue(word)}` })

export function decorateTags(ctx: Context, from: number, to: number): void {
  const { doc } = ctx.state
  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos)
    pos = line.to + 1

    for (const match of findLabels(line.text)) {
      const start = line.from + match.from
      const end = line.from + match.to
      if (inVerbatim(ctx, start)) continue
      const pill = Decoration.mark({
        class: 'cm-label',
        attributes: { ...hueStyle(match.word), 'data-label': match.word }
      })
      ctx.add(`label:${start}`, pill.range(start + 1, end - 1))
      if (!ctx.revealedAt(start)) {
        ctx.add(`label-open:${start}`, hidden.range(start, start + 1))
        ctx.add(`label-close:${end - 1}`, hidden.range(end - 1, end))
      }
    }

    // Tags hide nothing: the `#` stays, so a tag never looks like a label.
    for (const match of findTags(line.text)) {
      const start = line.from + match.from
      const end = line.from + match.to
      if (inVerbatim(ctx, start)) continue
      const tag = Decoration.mark({
        class: 'cm-hashtag',
        attributes: { ...hueStyle(match.word), 'data-tag': match.word.toLowerCase() }
      })
      ctx.add(`tag:${start}`, tag.range(start, end))
    }
  }
}
