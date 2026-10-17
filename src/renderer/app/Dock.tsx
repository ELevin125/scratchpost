import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { commandHint } from './state/commands'

export interface DockItem {
  command: string // registry id; the tooltip comes from the registry
  icon: IconName
  pressed?: boolean
  disabled?: boolean // the command doesn't apply right now
}

interface DockProps {
  items: DockItem[]
  onRun: (command: string) => void
  children?: ReactNode // the cat perches here
}

// The floating dock (D33, D53): the commands chosen in Settings as icons, each
// with the command's label and shortcut as its tooltip. A command that doesn't
// apply right now is greyed rather than dropped, so the dock the author
// arranged stays put.
export function Dock({ items, onRun, children }: DockProps) {
  // An empty dock is a choice; a bare pill with nothing in it is not. Bean
  // keeps it alive when the dock is where Bean sits.
  if (items.length === 0 && !children) return null
  return (
    <nav className="dock" aria-label="Tools">
      {children}
      <div className="dock-group">
        {items.map((item) => {
          const hint = commandHint(item.command)
          return (
            <button
              key={item.command}
              className={item.pressed ? 'dock-button on' : 'dock-button'}
              title={hint}
              aria-label={hint}
              aria-pressed={item.pressed}
              disabled={item.disabled}
              onClick={() => onRun(item.command)}
            >
              <Icon name={item.icon} />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
