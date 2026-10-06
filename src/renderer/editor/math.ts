// Sums in a note (6.7): typing `=` after an arithmetic expression writes the
// answer after it. This is the arithmetic; typing.ts decides when it runs.
// See MARKDOWN_SPEC.md, "Sums".

type Token =
  | { kind: 'number'; value: number; from: number; to: number }
  | { kind: 'op'; op: string; from: number; to: number }
  | { kind: 'junk'; from: number; to: number }

// A plain number, or one with thousands separators: 1200, 1,200, 0.5, .5
const NUMBER = /^(?:\d{1,3}(?:,\d{3})+(?!\d)|\d+)(?:\.\d+)?|^\.\d+/
const OPERATORS: Record<string, string> = { '×': '*', '÷': '/', '−': '-' }
const EXPRESSION_CHARS = /[\d.,+\-*/^%()×÷− \t]/
const DATE = /^\d{4}-\d{1,2}-\d{1,2}$/

function tokenize(text: string, offset: number): Token[] {
  const tokens: Token[] = []
  for (let at = 0; at < text.length; ) {
    const ch = text[at]
    if (ch === ' ' || ch === '\t') {
      at++
      continue
    }
    const number = NUMBER.exec(text.slice(at))?.[0]
    const from = offset + at
    if (number) {
      tokens.push({ kind: 'number', value: Number(number.replace(/,/g, '')), from, to: from + number.length })
      at += number.length
    } else {
      tokens.push('+-*/^%()×÷−'.includes(ch) ? { kind: 'op', op: OPERATORS[ch] ?? ch, from, to: from + 1 } : { kind: 'junk', from, to: from + 1 })
      at++
    }
  }
  return tokens
}

interface Value {
  value: number
  percent: boolean // a bare `10%`, so `200 + 10%` can mean 10% of 200
}

// Recursive descent over the tokens: + and -, then * / and remainder, then a
// leading minus, then ^, then a trailing %. Returns null unless every token is
// used and there was something to work out.
function evaluate(tokens: Token[]): number | null {
  let at = 0
  let operations = 0
  const op = () => {
    const token = tokens[at]
    return token?.kind === 'op' ? token.op : null
  }
  const startsOperand = (token: Token | undefined) =>
    token?.kind === 'number' || (token?.kind === 'op' && (token.op === '(' || token.op === '-'))

  const primary = (): Value => {
    const token = tokens[at]
    if (token?.kind === 'number') {
      at++
      return { value: token.value, percent: false }
    }
    if (op() !== '(') throw new Error('not an expression')
    at++
    const inner = sum()
    if (op() !== ')') throw new Error('unclosed')
    at++
    return { value: inner.value, percent: false }
  }
  const postfix = (): Value => {
    let result = primary()
    // `%` before another operand is a remainder, handled in product().
    while (op() === '%' && !startsOperand(tokens[at + 1])) {
      at++
      result = { value: result.value / 100, percent: true }
    }
    return result
  }
  const power = (): Value => {
    const base = postfix()
    if (op() !== '^') return base
    at++
    operations++
    return { value: base.value ** unary().value, percent: false }
  }
  const unary = (): Value => {
    if (op() !== '-') return power()
    at++
    const operand = unary()
    return { value: -operand.value, percent: operand.percent }
  }
  const product = (): Value => {
    let left = unary()
    for (let o = op(); o === '*' || o === '/' || o === '%'; o = op()) {
      at++
      operations++
      const right = unary().value
      left = { value: o === '*' ? left.value * right : o === '/' ? left.value / right : left.value % right, percent: false }
    }
    return left
  }
  const sum = (): Value => {
    let left = product()
    for (let o = op(); o === '+' || o === '-'; o = op()) {
      at++
      operations++
      const right = product()
      const amount = right.percent ? left.value * right.value : right.value
      left = { value: o === '+' ? left.value + amount : left.value - amount, percent: false }
    }
    return left
  }

  try {
    const result = sum()
    return at === tokens.length && operations > 0 && Number.isFinite(result.value) ? result.value : null
  } catch {
    return null
  }
}

// The answer as text: twelve significant digits, so 0.1 + 0.2 is 0.3, and
// never in exponent form. Null for numbers too large to write out.
export function formatNumber(value: number): string | null {
  if (!Number.isFinite(value) || Math.abs(value) >= 1e15) return null
  const rounded = Number(value.toPrecision(12))
  if (rounded === 0) return '0'
  const text = String(rounded)
  return text.includes('e') ? rounded.toFixed(15).replace(/\.?0+$/, '') : text
}

// The longest arithmetic expression that ends the text, and its value. Words
// stop it, so in "total: 3 * 4" only "3 * 4" counts, and a list marker or a
// number glued to a word ("item2") is left out.
export function expressionAtEnd(text: string): { from: number; value: number } | null {
  const end = text.replace(/[ \t]+$/, '').length
  let start = end
  while (start > 0 && EXPRESSION_CHARS.test(text[start - 1])) start--
  let tokens = tokenize(text.slice(start, end), start)
  // "item2 + 3": the 2 belongs to the word.
  if (start > 0 && /\w/.test(text[start - 1]) && tokens[0]?.kind === 'number' && tokens[0].from === start) {
    tokens = tokens.slice(1)
  }
  for (let i = 0; i < tokens.length; i++) {
    const first = tokens[i]
    const next = tokens[i + 1]
    const opens = first.kind === 'number' || (first.kind === 'op' && first.op === '(')
    // A leading minus counts only when it is attached to what follows and
    // stands apart from what came before: "-3 * 4", not the "- " of a list.
    const negative =
      first.kind === 'op' &&
      first.op === '-' &&
      next !== undefined &&
      next.from === first.to &&
      (first.from === 0 || /[\s(]/.test(text[first.from - 1]))
    if (!opens && !negative) continue
    // Not from the middle of something like 1.2.3, and a date is not a sum.
    if (first.from > 0 && /[\d.,]/.test(text[first.from - 1])) continue
    if (DATE.test(text.slice(first.from, end))) return null
    const value = evaluate(tokens.slice(i))
    if (value !== null) return { from: first.from, value }
  }
  return null
}
