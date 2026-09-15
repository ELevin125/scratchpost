import { useState } from 'react'

export interface TabView {
  id: string
  name: string
}

interface TabBarProps {
  tabs: TabView[]
  activeId: string | null
  onActivate: (id: string) => void
  onClose: (id: string) => void
  onMove: (id: string, toIndex: number) => void
}

export function TabBar({ tabs, activeId, onActivate, onClose, onMove }: TabBarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab, index) => {
        const active = tab.id === activeId
        return (
          <div
            key={tab.id}
            role="tab"
            aria-selected={active}
            className={['tab', active && 'active', tab.id === draggingId && 'dragging']
              .filter(Boolean)
              .join(' ')}
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
  )
}
