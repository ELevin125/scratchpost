import { useEffect, useMemo, useRef, useState } from 'react'
import type { HistoryEntry } from '../../preload/api'
import { Icon } from './Icon'

interface HistoryPanelProps {
  name: string
  current: string // the note's text now
  list: () => Promise<HistoryEntry[]>
  read: (id: string) => Promise<string>
  onRestore: (text: string) => void
  onCopy: (text: string) => void
  onClose: () => void
}

// Marks each line of a version that isn't in the current text. Lines are
// matched as a multiset, which is enough to spot what a version would change.
export function changedLines(version: string, current: string): boolean[] {
  const counts = new Map<string, number>()
  for (const line of current.split('\n')) counts.set(line, (counts.get(line) ?? 0) + 1)
  return version.split('\n').map((line) => {
    const left = counts.get(line) ?? 0
    if (left === 0) return true
    counts.set(line, left - 1)
    return false
  })
}

const dayLabel = (time: number) => {
  const date = new Date(time)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

const timeLabel = (time: number) => new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

// Local version history (3.6, D38): versions grouped by day, a read-only
// preview with the lines that differ from the note now, restore and copy.
export function HistoryPanel({ name, current, list, read, onRestore, onCopy, onClose }: HistoryPanelProps) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [selected, setSelected] = useState(0)
  const [preview, setPreview] = useState<{ id: string; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    list().then(setEntries, () => setEntries([]))
  }, [list])

  const entry = entries?.[selected] ?? null
  useEffect(() => {
    if (!entry) return
    let live = true
    read(entry.id).then(
      (text) => {
        if (!live) return
        setPreview({ id: entry.id, text })
        setError(null)
      },
      () => {
        if (live) setError("couldn't read this version")
      }
    )
    return () => {
      live = false
    }
  }, [entry, read])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const step = event.key === 'ArrowDown' ? 1 : -1
        setSelected((i) => Math.max(0, Math.min((entries?.length ?? 1) - 1, i + step)))
      } else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [entries, onClose])

  useEffect(() => {
    panel.current?.querySelector('.history-item.selected')?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const shown = preview && preview.id === entry?.id ? preview.text : null
  const marks = useMemo(() => (shown === null ? [] : changedLines(shown, current)), [shown, current])
  const same = shown === current
  const changedCount = marks.filter(Boolean).length

  const groups: { label: string; items: { entry: HistoryEntry; index: number }[] }[] = []
  entries?.forEach((e, index) => {
    const label = dayLabel(e.time)
    if (groups.at(-1)?.label !== label) groups.push({ label, items: [] })
    groups.at(-1)!.items.push({ entry: e, index })
  })

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        ref={panel}
        className="overlay history"
        role="dialog"
        aria-label={`History of ${name}`}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-head">
          <h2>History</h2>
          <span className="history-name">{name}</span>
          <button className="icon-button" title="Close (Esc)" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        {entries !== null && entries.length === 0 ? (
          <p className="overlay-empty">
            No versions yet. They're saved on this computer as you write, at most every five minutes.
          </p>
        ) : (
          <div className="history-body">
            <ol className="history-list" aria-label="Versions">
              {groups.map((group) => (
                <li key={group.label}>
                  <h3>{group.label}</h3>
                  <ol>
                    {group.items.map(({ entry: e, index }) => {
                      const older = entries![index + 1]
                      const delta = older ? e.lines - older.lines : 0
                      return (
                        <li
                          key={e.id}
                          id={`history-${e.id}`}
                          className={index === selected ? 'history-item selected' : 'history-item'}
                          aria-selected={index === selected}
                          onClick={() => setSelected(index)}
                        >
                          <span className="history-time">{timeLabel(e.time)}</span>
                          <span className="history-meta">
                            {plural(e.words, 'word')}
                            {delta !== 0 && ` · ${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${Math.abs(delta) === 1 ? 'line' : 'lines'}`}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </li>
              ))}
            </ol>
            <div className="history-preview">
              <div className="history-summary">
                {error ??
                  (shown === null
                    ? ' '
                    : same
                      ? 'Same as the note now'
                      : changedCount === 0
                        ? 'Only removes lines from the note now'
                        : `${plural(changedCount, 'line')} differ from the note now`)}
              </div>
              <pre className="history-text" aria-label="Version text">
                {shown?.split('\n').map((line, i) => (
                  <span key={i} className={marks[i] ? 'changed' : undefined}>
                    {line || ' '}
                  </span>
                ))}
              </pre>
              <div className="setting-actions">
                <button
                  id="history-restore"
                  className="pill-button"
                  disabled={shown === null || same}
                  onClick={() => shown !== null && onRestore(shown)}
                >
                  <Icon name="history" size={16} />
                  Restore this version
                </button>
                <button
                  id="history-copy"
                  className="text-button"
                  disabled={shown === null}
                  onClick={() => shown !== null && onCopy(shown)}
                >
                  Copy text
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
