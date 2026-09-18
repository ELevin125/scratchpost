import { Decoration } from '@codemirror/view'
import type { SyntaxNode } from '@lezer/common'
import { hidden, type Context } from './decorations'

// Inline live preview: emphasis, strong, strikethrough, inline code and links.
// Styling stays on revealed lines; only the markers reappear.

const styles: Record<string, { mark: Decoration; syntax: string }> = {
  Emphasis: { mark: Decoration.mark({ class: 'cm-em' }), syntax: 'EmphasisMark' },
  StrongEmphasis: { mark: Decoration.mark({ class: 'cm-strong' }), syntax: 'EmphasisMark' },
  Strikethrough: { mark: Decoration.mark({ class: 'cm-strike' }), syntax: 'StrikethroughMark' }
}

const inlineCode = Decoration.mark({ class: 'cm-inline-code' })

function hideMarks(ctx: Context, node: SyntaxNode, name: string): void {
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name !== name || ctx.revealedAt(child.from)) continue
    ctx.add(`${name}:${child.from}`, hidden.range(child.from, child.to))
  }
}

function decorateInlineCode(ctx: Context, node: SyntaxNode): void {
  const open = node.firstChild
  const close = node.lastChild
  if (open?.name !== 'CodeMark' || close?.name !== 'CodeMark' || open.from === close.from) return
  if (open.to < close.from) ctx.add(`inline-code:${node.from}`, inlineCode.range(open.to, close.from))
  hideMarks(ctx, node, 'CodeMark')
}

// Only [label](url). Reference links, [word] and images stay plain text.
function decorateLink(ctx: Context, node: SyntaxNode): void {
  const marks = node.getChildren('LinkMark')
  const url = node.getChild('URL')
  if (!url || marks.length < 4) return

  const [open, close] = marks
  const href = ctx.state.sliceDoc(url.from, url.to)
  if (open.to < close.from) {
    const label = Decoration.mark({ class: 'cm-link', attributes: { 'data-href': href } })
    ctx.add(`link:${node.from}`, label.range(open.to, close.from))
  }
  if (!ctx.revealedAt(open.from)) ctx.add(`link-open:${open.from}`, hidden.range(open.from, open.to))
  if (!ctx.revealedAt(close.from)) ctx.add(`link-rest:${close.from}`, hidden.range(close.from, node.to))
}

// A URL written on its own, with no markdown around it (5.4). GFM autolinking
// finds them; `[label](url)` handles its own URL, so those are skipped.
function decorateAutolink(ctx: Context, node: SyntaxNode): void {
  const parent = node.parent?.name
  if (parent === 'Link' || parent === 'Image') return
  const text = ctx.state.sliceDoc(node.from, node.to)
  const href = /^[a-z][\w+.-]*:/i.test(text) ? text : text.includes('@') ? `mailto:${text}` : `https://${text}`
  const mark = Decoration.mark({ class: 'cm-link', attributes: { 'data-href': href } })
  ctx.add(`autolink:${node.from}`, mark.range(node.from, node.to))
}

export function decorateInline(ctx: Context, node: SyntaxNode): void {
  if (node.name === 'InlineCode') return decorateInlineCode(ctx, node)
  if (node.name === 'Link') return decorateLink(ctx, node)
  if (node.name === 'URL') return decorateAutolink(ctx, node)
  const style = styles[node.name]
  if (!style) return
  ctx.add(`${node.name}:${node.from}`, style.mark.range(node.from, node.to))
  hideMarks(ctx, node, style.syntax)
}
