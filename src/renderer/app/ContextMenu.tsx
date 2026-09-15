import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface MenuItem {
  label: string
  hint?: string // shortcut, from the registry
  run: () => void
}

export interface MenuState {
  x: number
  y: number
  items: MenuItem[]
}

interface ContextMenuProps extends MenuState {
  onClose: () => void
}

// Right-click menu for tabs and tree rows. Drawn by the app, not the OS, so it
// matches the square hairlined look. See D29.
export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menu = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: x, top: y })
  const [selected, setSelected] = useState(0)

  // Keep the whole menu on screen, and take focus for the keyboard.
  useLayoutEffect(() => {
    const el = menu.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    setPosition({
      left: Math.max(0, Math.min(x, window.innerWidth - width)),
      top: Math.max(0, Math.min(y, window.innerHeight - height))
    })
    el.focus()
  }, [x, y])

  useEffect(() => {
    window.addEventListener('blur', onClose)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('blur', onClose)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const choose = (item: MenuItem) => {
    onClose()
    item.run()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = items.length
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected((selected + 1) % count)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected((selected - 1 + count) % count)
    } else if (event.key === 'Enter' && items[selected]) {
      event.preventDefault()
      choose(items[selected])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div
      className="menu-backdrop"
      onMouseDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <div
        ref={menu}
        className="menu"
        role="menu"
        tabIndex={-1}
        style={{ left: position.left, top: position.top }}
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        {items.map((item, i) => (
          <button
            key={item.label}
            role="menuitem"
            tabIndex={-1}
            className={i === selected ? 'menu-item selected' : 'menu-item'}
            onMouseMove={() => setSelected(i)}
            onClick={() => choose(item)}
          >
            <span>{item.label}</span>
            {item.hint && <kbd className="overlay-shortcut">{item.hint}</kbd>}
          </button>
        ))}
      </div>
    </div>
  )
}
