import { Picker, type PickerItem } from './Picker'
import { folderName } from './state/folderContext'

interface FolderMenuProps {
  scratchDir: string | null
  recentFolders: string[]
  current: string | null // null when the scratch folder is the context
  onSwitch: (path: string | null) => void
  onOpenFolder: () => void
  onClose: () => void
}

const SCRATCH = 'scratch'
const OPEN = 'open'
const RECENT = 'recent:'

// Opened from the folder name in the status bar or "Switch folder…".
export function FolderMenu({ scratchDir, recentFolders, current, onSwitch, onOpenFolder, onClose }: FolderMenuProps) {
  const items: PickerItem[] = [
    { id: SCRATCH, label: 'Scratch folder', detail: scratchDir ?? undefined, hint: current === null ? 'current' : undefined },
    ...recentFolders.map((path) => ({
      id: RECENT + path,
      label: folderName(path),
      detail: path,
      hint: path === current ? 'current' : undefined
    })),
    { id: OPEN, label: 'Open folder…' }
  ]

  return (
    <Picker
      ariaLabel="Switch folder"
      placeholder="Switch folder"
      items={items}
      onPick={(item) => {
        if (item.id === OPEN) onOpenFolder()
        else if (item.id === SCRATCH) onSwitch(null)
        else onSwitch(item.id.slice(RECENT.length))
      }}
      onClose={onClose}
    />
  )
}
