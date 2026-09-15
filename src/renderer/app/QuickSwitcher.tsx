import { Picker } from './Picker'

export interface SwitcherFile {
  path: string
  label: string // display name
  detail: string // path within the folder context
}

interface QuickSwitcherProps {
  files: SwitcherFile[]
  onOpen: (path: string) => void
  onClose: () => void
}

// Ctrl+P: fuzzy over display name and path, within the folder context.
export function QuickSwitcher({ files, onOpen, onClose }: QuickSwitcherProps) {
  return (
    <Picker
      ariaLabel="Quick switcher"
      placeholder="Go to a note"
      items={files.map((file) => ({ id: file.path, label: file.label, detail: file.detail }))}
      onPick={(item) => onOpen(item.id)}
      onClose={onClose}
    />
  )
}
