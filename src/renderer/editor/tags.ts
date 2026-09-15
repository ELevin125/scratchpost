import { syntaxTree } from '@codemirror/language'
import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { findTags, tagHue } from '../../shared/tags'
import { hidden, type Context } from './decorations'

// `[tag]` pills. Matched by the shared regex, not the markdown grammar, and
// rendered here rather than by a MatchDecorator so the brackets reveal with
// the cursor like all other syntax. See MARKDOWN_SPEC.md, "Tags", and D27.

// Code and HTML are verbatim: no tags inside.
const NO_TAGS = new Set(['FencedCode', 'CodeBlock', 'InlineCode', 'HTMLBlock', 'HTMLTag'])

function inCode(ctx: Context, pos: number): boolean {
  for (let node: SyntaxNode | null = syntaxTree(ctx.state).resolveInner(pos, 1); node; node = node.parent) {
    if (NO_TAGS.has(node.name)) return true
  }
  return false
}

export function decorateTags(ctx: Context, from: number, to: number): void {
  const { doc } = ctx.state
  for (let pos = from; pos <= to; ) {
    const line = doc.lineAt(pos)
    pos = line.to + 1

    for (const match of findTags(line.text)) {
      const start = line.from + match.from
      const end = line.from + match.to
      if (inCode(ctx, start)) continue

      // The hue rides on a CSS custom property; the colour itself is built in
      // global.css from theme tokens, so no colour literal lives here.
      const pill = Decoration.mark({ class: 'cm-tag', attributes: { style: `--tag-hue: ${tagHue(match.tag)}` } })
      ctx.add(`tag:${start}`, pill.range(start + 1, end - 1))
      if (!ctx.revealedAt(start)) {
        ctx.add(`tag-open:${start}`, hidden.range(start, start + 1))
        ctx.add(`tag-close:${end - 1}`, hidden.range(end - 1, end))
      }
    }
  }
}
