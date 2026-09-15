import type { EditorStats } from '../editor/createEditor'

export interface StatusMessage {
  text: string
  error: boolean
}

interface StatusBarProps {
  folderName: string
  stats: EditorStats
  message: StatusMessage | null
}

// The message slot is information, never a prompt, and is empty while all is
// well. See DESIGN.md principle 3. Folder switching (2.4) and the palette (2.2)
// will wire up the folder name and palette button.
export function StatusBar({ folderName, stats, message }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span className="status-folder">{folderName}</span>
      <span className={message?.error ? 'status-message status-error' : 'status-message'}>
        {message?.text}
      </span>
      <span className="status-spacer" />
      <span>
        Ln {stats.line}, Col {stats.column}
      </span>
      <span>
        {stats.words} {stats.words === 1 ? 'word' : 'words'}
      </span>
      <button className="status-palette" disabled title="Command palette">
        Commands
      </button>
    </div>
  )
}
