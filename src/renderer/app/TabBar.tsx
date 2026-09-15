import { useState } from 'react'

export interface TabView {
  id: string
  name: string
  failed: boolean // last save failed; the tab shows a marker
}

interface TabBarProps {
  tabs: TabView[]
  activeId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, toIndex: number) => void
  onNew: () => void
  onOpen: () => void
}

// Ctrl+N / Ctrl+O arrive with the command registry (2.1); until then the
// buttons are the only way in, so no key is bound outside the registry.
export function TabBar({ tabs, activeId, onActivate, onClose, onMove, onNew, onOpen }: TabBarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <div className="tab-bar">
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
                tab.failed && 'failed',
                tab.id === draggingId && 'dragging'
              ]
                .filter(Boolean)
                .join(' ')}
              title={tab.failed ? 'Last save failed' : undefined}
              draggable
              onClick={() => onActivate(tab.id)}
              // Middle-click closes; preventing mousedown stops autoscroll.
              onMouseDown={(e) => e.button === 1 && e.preventDefault()}
              onAuxClick={(e) => e.button === 1 && onClose(tab.id)}
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
              <span className="tab-name">{tab.name}</span>
              <button
                className="tab-close"
                aria-label={`Close ${tab.name}`}
                onClick={(e) => {
                  e.stopPropagation()
                  onClose(tab.id)
                }}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
      <div className="tab-actions">
        <button className="tab-action" title="New note" aria-label="New note" onClick={onNew}>
          +
        </button>
        <button className="tab-action" title="Open file" onClick={onOpen}>
          Open
        </button>
      </div>
    </div>
  )
}
