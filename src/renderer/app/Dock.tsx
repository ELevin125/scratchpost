import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'
import { commandHint } from './state/commands'

export interface DockItem {
  command: string // registry id; the tooltip comes from the registry
  icon: IconName
  pressed?: boolean
}

interface DockProps {
  groups: DockItem[][]
  onRun: (command: string) => void
  children?: ReactNode // the cat perches here
}

// The floating dock (D33): views and tools as icons, grouped, each with the
// command's label and shortcut as its tooltip.
export function Dock({ groups, onRun, children }: DockProps) {
  return (
    <nav className="dock" aria-label="Tools">
      {children}
      {groups.map((group, i) => (
        <div key={i} className="dock-group">
          {group.map((item) => {
            const hint = commandHint(item.command)
            return (
              <button
                key={item.command}
                className={item.pressed ? 'dock-button on' : 'dock-button'}
                title={hint}
                aria-label={hint}
                aria-pressed={item.pressed}
                onClick={() => onRun(item.command)}
              >
                <Icon name={item.icon} />
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
