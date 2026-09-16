import { formatShortcut } from './state/shortcuts'

interface EmptyStateProps {
  onNewNote: () => void
}

const KEYS: [string, string][] = [
  ['Ctrl+N', 'new note'],
  ['Ctrl+P', 'find a note'],
  ['Ctrl+O', 'open a file'],
  ['Ctrl+Shift+P', 'every command']
]

// No tabs open. An invitation, not an apology. See DESIGN.md, "Empty states".
export function EmptyState({ onNewNote }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-title">Start a note.</p>
      <p className="empty-state-line">It saves itself.</p>
      <button className="pill-button" onClick={onNewNote}>
        New note
      </button>
      <dl className="empty-state-keys">
        {KEYS.map(([keys, label]) => (
          <div key={keys} style={{ display: 'contents' }}>
            <dt>
              <kbd>{formatShortcut(keys)}</kbd>
            </dt>
            <dd>{label}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
