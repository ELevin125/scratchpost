import type { EditorStats } from '../editor/createEditor'

export interface StatusMessage {
  text: string
  error: boolean
}

interface StatusBarProps {
  folderLabel: string // the end of the folder path, e.g. "Documents/Scratchpost"
  folderPath: string // the full path, as a tooltip
  stats: EditorStats | null // null when no tab is open
  message: StatusMessage | null
  onFolder: () => void
  onPalette: () => void
  paletteHint: string
}

// Left to right: folder, message, spacer, line and column, word count, palette
// button. The message slot is information, never a prompt, and is empty while
// all is well. See DESIGN.md, "Status bar".
export function StatusBar({ folderLabel, folderPath, stats, message, onFolder, onPalette, paletteHint }: StatusBarProps) {
  return (
    <div className="status-bar">
      <button className="status-folder" title={folderPath} onClick={onFolder}>
        {folderLabel}
      </button>
      <span className={message?.error ? 'status-message status-error' : 'status-message'}>
        {message?.text}
      </span>
      <span className="status-spacer" />
      {stats && (
        <>
          <span>
            Ln {stats.line}, Col {stats.column}
          </span>
          <span>
            {stats.words} {stats.words === 1 ? 'word' : 'words'}
          </span>
        </>
      )}
      <button className="status-palette" title={paletteHint} onClick={onPalette}>
        Commands
      </button>
    </div>
  )
}
