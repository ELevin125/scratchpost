import type { EditorStats } from '../editor/createEditor'

interface StatusBarProps {
  folderName: string
  stats: EditorStats
}

// Save state lands with autosave (1.5); folder switching (2.4) and the
// palette (2.2) will wire up the folder name and palette button.
export function StatusBar({ folderName, stats }: StatusBarProps) {
  return (
    <div className="status-bar">
      <span className="status-folder">{folderName}</span>
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
