interface EmptyStateProps {
  onNewNote: () => void
}

// No tabs open. An invitation, not an apology. See DESIGN.md, "Empty states".
export function EmptyState({ onNewNote }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <p className="empty-state-line">Start a note. It saves itself.</p>
      <button className="empty-state-button" onClick={onNewNote}>
        New note
      </button>
    </div>
  )
}
