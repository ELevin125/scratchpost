import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { SearchHit } from '../../preload/api'
import { groupHits, MIN_SEARCH_LENGTH } from './state/searchHits'

interface SearchPanelProps {
  folderName: string
  nameOf: (path: string) => string
  search: (query: string) => Promise<SearchHit[]>
  onOpen: (hit: SearchHit, query: string) => void
  onClose: () => void
}

const SEARCH_DELAY_MS = 200

function highlight(text: string, query: string): ReactNode[] {
  const parts: ReactNode[] = []
  const lower = text.toLowerCase()
  const needle = query.toLowerCase()
  let from = 0
  for (let i = lower.indexOf(needle); needle !== '' && i !== -1; i = lower.indexOf(needle, from)) {
    if (i > from) parts.push(text.slice(from, i))
    parts.push(
      <mark key={i} className="search-match">
        {text.slice(i, i + needle.length)}
      </mark>
    )
    from = i + needle.length
  }
  parts.push(text.slice(from))
  return parts
}

// Ctrl+Shift+F: content search across the folder context. An overlay, like
// the palette, so the layout never changes. See D27.
export function SearchPanel({ folderName, nameOf, search, onOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<{ query: string; hits: SearchHit[] } | null>(null)
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLUListElement>(null)
  const trimmed = query.trim()

  useEffect(() => {
    if (trimmed.length < MIN_SEARCH_LENGTH) return
    let stale = false
    const timer = setTimeout(() => {
      search(trimmed).then(
        (hits) => {
          if (stale) return
          setResult({ query: trimmed, hits })
          setSelected(0)
        },
        () => {
          if (!stale) setResult({ query: trimmed, hits: [] })
        }
      )
    }, SEARCH_DELAY_MS)
    return () => {
      stale = true
      clearTimeout(timer)
    }
  }, [trimmed, search])

  // Results for an older query are never shown for the current one.
  const current = result && result.query === trimmed ? result : null
  const groups = useMemo(() => groupHits(current?.hits ?? []), [current])
  const hits = groups.flatMap((group) => group.hits)
  const index = Math.min(selected, Math.max(0, hits.length - 1))

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [index, current])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = hits.length
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault()
      setSelected((index + 1) % count)
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault()
      setSelected((index - 1 + count) % count)
    } else if (event.key === 'Enter' && current && hits[index]) {
      event.preventDefault()
      onOpen(hits[index], current.query)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  let row = -1
  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        className="overlay search"
        role="dialog"
        aria-label="Search in folder"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          className="overlay-input"
          autoFocus
          spellCheck={false}
          placeholder={`Search in ${folderName}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        {current && hits.length === 0 && (
          // No results: the query echoed back, and nothing else.
          <div className="overlay-empty">{current.query}</div>
        )}
        {current && hits.length > 0 && (
          <ul className="overlay-list" ref={list}>
            {groups.map((group) => (
              <li key={group.path} className="search-group">
                <div className="search-file" title={group.path}>
                  {nameOf(group.path)}
                </div>
                <ul className="search-hits" role="listbox">
                  {group.hits.map((hit) => {
                    row++
                    const i = row
                    return (
                      <li
                        key={hit.line}
                        role="option"
                        aria-selected={i === index}
                        className={i === index ? 'overlay-item search-hit selected' : 'overlay-item search-hit'}
                        onMouseMove={() => setSelected(i)}
                        onClick={() => onOpen(hit, current.query)}
                      >
                        <span className="search-line">{hit.line}</span>
                        <span className="search-text">{highlight(hit.text.trim(), current.query)}</span>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
