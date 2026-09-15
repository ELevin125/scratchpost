import type { EditorStats } from '../editor/createEditor'

export interface StatusMessage {
  text: string
  error: boolean
}

interface StatusBarProps {
  folderName: string
  stats: EditorStats
  message: StatusMessage | null
  onFolder: () => void
  onPalette: () => void
  folderHint: string
  paletteHint: string
}

// Left to right: folder name, message, spacer, line and column, word count,
// palette button. The message slot is information, never a prompt, and is
// empty while all is well. See DESIGN.md, "Status bar".
export function StatusBar({ folderName, stats, message, onFolder, onPalette, folderHint, paletteHint }: StatusBarProps) {
  return (
    <div className="status-bar">
      <button className="status-folder" title={folderHint} onClick={onFolder}>
        {folderName}
      </button>
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
      <button className="status-palette" title={paletteHint} onClick={onPalette}>
        Commands
      </button>
    </div>
  )
}
