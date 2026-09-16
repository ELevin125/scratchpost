import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { fuzzyFilter } from './state/fuzzy'

export interface PickerItem {
  id: string
  label: string
  detail?: string // muted, and matched along with the label
  hint?: string // right-aligned, e.g. a shortcut
  swatch?: number // a hue, shown as a dot before the label
}

interface PickerProps {
  items: PickerItem[]
  placeholder: string
  ariaLabel: string
  onPick: (item: PickerItem) => void
  onClose: () => void
}

// Rendering thousands of rows per keystroke is wasted work; the best matches
// are at the top anyway.
const MAX_SHOWN = 100

// The shared overlay behind the command palette, quick switcher and folder
// menu: fuzzy filter, arrow keys, Enter, Escape.
export function Picker({ items, placeholder, ariaLabel, onPick, onClose }: PickerProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const results = useMemo(
    () =>
      fuzzyFilter(items, query, (item) => (item.detail ? `${item.label} ${item.detail}` : item.label)).slice(
        0,
        MAX_SHOWN
      ),
    [items, query]
  )
  const index = Math.min(selected, Math.max(0, results.length - 1))

  useEffect(() => {
    list.current?.children[index]?.scrollIntoView({ block: 'nearest' })
  }, [index])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = results.length
    if (event.key === 'ArrowDown' && count > 0) {
      event.preventDefault()
      setSelected((index + 1) % count)
    } else if (event.key === 'ArrowUp' && count > 0) {
      event.preventDefault()
      setSelected((index - 1 + count) % count)
    } else if (event.key === 'Enter' && results[index]) {
      event.preventDefault()
      onPick(results[index])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        className="overlay"
        role="dialog"
        aria-label={ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          className="overlay-input"
          autoFocus
          spellCheck={false}
          autoComplete="off"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
        />
        {results.length > 0 ? (
          <ul className="overlay-list" role="listbox" ref={list}>
            {results.map((item, i) => (
              <li
                key={item.id}
                role="option"
                aria-selected={i === index}
                className={i === index ? 'overlay-item selected' : 'overlay-item'}
                onMouseMove={() => setSelected(i)}
                onClick={() => onPick(item)}
              >
                <span className="overlay-text">
                  {item.swatch !== undefined && (
                    <span className="swatch" style={{ '--swatch-hue': item.swatch } as CSSProperties} />
                  )}
                  <span className="overlay-label-text">{item.label}</span>
                  {item.detail && <span className="overlay-detail">{item.detail}</span>}
                </span>
                {item.hint && <kbd className="overlay-shortcut">{item.hint}</kbd>}
              </li>
            ))}
          </ul>
        ) : (
          // No results: the query echoed back, and nothing else.
          <div className="overlay-empty">{query}</div>
        )}
      </div>
    </div>
  )
}
