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
  // The buttons run registry commands; hints carry the label and shortcut.
  treeOpen: boolean
  onToggleTree: () => void
  onNew: () => void
  onOpen: () => void
  treeHint: string
  newHint: string
  openHint: string
}

export function TabBar({
  tabs,
  activeId,
  onActivate,
  onClose,
  onMove,
  treeOpen,
  onToggleTree,
  onNew,
  onOpen,
  treeHint,
  newHint,
  openHint
}: TabBarProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)

  return (
    <div className="tab-bar">
      <button
        className={treeOpen ? 'tab-action tree-toggle open' : 'tab-action tree-toggle'}
        title={treeHint}
        aria-label={treeHint}
        aria-pressed={treeOpen}
        onClick={onToggleTree}
      >
        ≡
      </button>
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
        <button className="tab-action" title={newHint} aria-label={newHint} onClick={onNew}>
          +
        </button>
        <button className="tab-action" title={openHint} onClick={onOpen}>
          Open
        </button>
      </div>
    </div>
  )
}
