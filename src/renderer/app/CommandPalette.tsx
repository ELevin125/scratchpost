import { Picker } from './Picker'
import type { Command } from './state/commands'
import { formatShortcut } from './state/shortcuts'

interface CommandPaletteProps {
  commands: Command[] // already filtered by `when`
  onRun: (command: Command) => void
  onClose: () => void
}

// Every registered command, with its shortcut beside it, so the palette is
// also how shortcuts are learned. See DESIGN.md principle 2. The palette
// doesn't list itself; its shortcut is on the status bar button.
export function CommandPalette({ commands: all, onRun, onClose }: CommandPaletteProps) {
  const commands = all.filter((command) => command.id !== 'palette.open')
  return (
    <Picker
      ariaLabel="Command palette"
      placeholder="Type a command"
      items={commands.map((command) => ({
        id: command.id,
        label: command.label,
        hint: command.shortcut ? formatShortcut(command.shortcut) : undefined
      }))}
      onPick={(item) => {
        const command = commands.find((c) => c.id === item.id)
        if (command) onRun(command)
      }}
      onClose={onClose}
    />
  )
}
