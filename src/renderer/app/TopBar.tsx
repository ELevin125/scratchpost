import { useState } from 'react'
import { Icon } from './Icon'

export interface TabView {
  id: string
  name: string
  failed: boolean // a failed save or a change on disk; the pill shows a marker
  pinned: boolean // shows a pin instead of the close button
}

interface TopBarProps {
  tabs: TabView[]
  activeId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  onTabMenu: (id: string, at: { x: number; y: number }) => void
  // The buttons run registry commands; hints carry the label and shortcut.
  onFind: () => void
  onNew: () => void
  findHint: string
  findShortcut: string
  newHint: string
}

// Open notes as pills, the find field and the new-note button (D33). The
// pills are the tabs: same order, drag, middle-click and menu as before.
export function TopBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onMove,
  onTabMenu,
  onFind,
  onNew,
  findHint,
  findShortcut,
  newHint
}: TopBarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <div className="top-bar">
      {tabs.length > 0 && (
        <div className="tabs" role="tablist">
          {tabs.map((tab, index) => {
            const active = tab.id === activeId
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={active}
                className={[
                  'tab',
                  active && 'active',
                  tab.pinned && 'pinned',
                  tab.failed && 'failed',
                  tab.id === draggingId && 'dragging'
                ]
                  .filter(Boolean)
                  .join(' ')}
                title={tab.failed ? 'Needs attention: see above the note' : undefined}
                draggable
                onClick={() => onActivate(tab.id)}
                onContextMenu={(e) => {
                  e.preventDefault()
                  onTabMenu(tab.id, { x: e.clientX, y: e.clientY })
                }}
                // Middle-click closes, except pinned pills; preventing
                // mousedown stops autoscroll.
                onMouseDown={(e) => e.button === 1 && e.preventDefault()}
                onAuxClick={(e) => e.button === 1 && !tab.pinned && onClose(tab.id)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move'
                  setDraggingId(tab.id)
                }}
                onDragOver={(e) => draggingId && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (draggingId && draggingId !== tab.id) onMove(draggingId, index)
                  setDraggingId(null)
                }}
                onDragEnd={() => setDraggingId(null)}
              >
                {tab.pinned && (
                  <span className="tab-pin" title="Pinned">
                    <Icon name="pin" size={13} />
                  </span>
                )}
                <span className="tab-name">{tab.name}</span>
                {!tab.pinned && (
                  <button
                  className="tab-close"
                  aria-label={`Close ${tab.name}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onClose(tab.id)
                  }}
                >
                  <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
      <button className="find-field" title={findHint} onClick={onFind}>
        <Icon name="find" size={16} />
        <span className="find-text">Find a note</span>
        <kbd>{findShortcut}</kbd>
      </button>
      <button className="round-button" title={newHint} aria-label={newHint} onClick={onNew}>
        <Icon name="plus" />
      </button>
    </div>
  )
}
