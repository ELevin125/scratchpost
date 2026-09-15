import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Command } from './state/commands'
import { fuzzyFilter } from './state/fuzzy'
import { formatShortcut } from './state/shortcuts'

interface CommandPaletteProps {
  commands: Command[] // already filtered by `when`
  onRun: (command: Command) => void
  onClose: () => void
}

// Every registered command, with its shortcut beside it, so the palette is
// also how shortcuts are learned. See DESIGN.md principle 2.
export function CommandPalette({ commands, onRun, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const list = useRef<HTMLUListElement>(null)

  const results = useMemo(() => fuzzyFilter(commands, query, (c) => c.label), [commands, query])
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
      onRun(results[index])
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
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          className="overlay-input"
          autoFocus
          spellCheck={false}
          placeholder="Type a command"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setSelected(0)
          }}
          onKeyDown={onKeyDown}
        />
        {results.length > 0 ? (
          <ul className="overlay-list" role="listbox" ref={list}>
            {results.map((command, i) => (
              <li
                key={command.id}
                role="option"
                aria-selected={i === index}
                className={i === index ? 'overlay-item selected' : 'overlay-item'}
                onMouseMove={() => setSelected(i)}
                onClick={() => onRun(command)}
              >
                <span>{command.label}</span>
                {command.shortcut && <kbd className="overlay-shortcut">{formatShortcut(command.shortcut)}</kbd>}
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
