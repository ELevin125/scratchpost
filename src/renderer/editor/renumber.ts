import { EditorState, type Line, type Text, type Transaction } from '@codemirror/state'
import { leadingWidth, parseListItem, type ListItem } from './lists'

// Numbered lists count up after any edit that touches them: moving,
// duplicating or deleting lines, pasting, Enter. The renumbering joins the
// edit's own transaction, so one undo reverts both. Undo and redo themselves
// are never renumbered. See D22.

function numbered(text: string): ListItem | null {
  const item = parseListItem(text)
  return item && item.number !== null ? item : null
}

const FENCE = /^ {0,3}(```|~~~)/

// Code fences are verbatim; never renumber inside one.
function insideFence(doc: Text, lineNo: number): boolean {
  let open = false
  for (let n = 1; n < lineNo; n++) {
    if (FENCE.test(doc.line(n).text)) open = !open
  }
  return open
}

// The numbered items of the list containing line n, in order. A list is
// items at one indent with one delimiter. Blank lines and deeper lines
// (children, continuations) don't end it; anything else does.
function listLines(doc: Text, n: number): number[] | null {
  const anchor = numbered(doc.line(n).text)
  if (!anchor) return null
  const indent = anchor.indent.length

  const step = (i: number): 'item' | 'skip' | 'stop' => {
    const text = doc.line(i).text
    if (text.trim() === '') return 'skip'
    const item = parseListItem(text)
    if (item && item.indent.length === indent) {
      return item.number !== null && item.delimiter === anchor.delimiter ? 'item' : 'stop'
    }
    return (item ? item.indent.length : leadingWidth(text)) > indent ? 'skip' : 'stop'
  }

  const lines = [n]
  for (let i = n - 1; i >= 1; i--) {
    const s = step(i)
    if (s === 'stop') break
    if (s === 'item') lines.unshift(i)
  }
  for (let i = n + 1; i <= doc.lines; i++) {
    const s = step(i)
    if (s === 'stop') break
    if (s === 'item') lines.push(i)
  }
  return lines
}

const touches = (tr: Transaction, line: Line) => {
  let hit = false
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    if (fromB <= line.to && toB >= line.from) hit = true
  })
  return hit
}

// Where the list starts. Typing on the first item sets it; any other edit
// keeps the number the list started at before the edit, so moving the first
// item down doesn't shift the whole list.
function startNumber(tr: Transaction, first: Line): number {
  const item = numbered(first.text)!
  const typed = tr.isUserEvent('input.type') || tr.isUserEvent('delete.backward') || tr.isUserEvent('delete.forward')
  if (typed && touches(tr, first)) return item.number!

  const oldDoc = tr.startState.doc
  const oldLines = listLines(oldDoc, oldDoc.lineAt(tr.changes.invertedDesc.mapPos(first.from)).number)
  const oldFirst = oldLines ? numbered(oldDoc.line(oldLines[0]).text) : null
  const sameList =
    oldFirst !== null && oldFirst.indent.length === item.indent.length && oldFirst.delimiter === item.delimiter
  return sameList ? oldFirst.number! : item.number!
}

export const renumberLists = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged || tr.isUserEvent('undo') || tr.isUserEvent('redo')) return tr

  const doc = tr.newDoc
  const candidates = new Set<number>()
  tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
    const first = doc.lineAt(fromB).number
    const last = doc.lineAt(toB).number
    for (let n = Math.max(1, first - 1); n <= Math.min(doc.lines, last + 1); n++) candidates.add(n)
  })

  const changes: { from: number; to: number; insert: string }[] = []
  const handled = new Set<number>()
  for (const n of candidates) {
    if (handled.has(n)) continue
    const lines = listLines(doc, n)
    if (!lines || insideFence(doc, lines[0])) continue
    for (const l of lines) handled.add(l)

    let expected = startNumber(tr, doc.line(lines[0]))
    for (const l of lines) {
      const line = doc.line(l)
      const item = parseListItem(line.text)!
      if (item.number !== expected) {
        const from = line.from + item.indent.length
        changes.push({ from, to: from + item.numberText.length, insert: String(expected) })
      }
      expected++
    }
  }

  if (changes.length === 0) return tr
  changes.sort((a, b) => a.from - b.from)
  return [tr, { changes, sequential: true }]
})
