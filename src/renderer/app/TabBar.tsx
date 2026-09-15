export interface TabView {
  id: string
  name: string
}

interface TabBarProps {
  tabs: TabView[]
  activeId: string | null
}

// Presentational only; open/close/reorder arrive with the tab model in 1.4.
export function TabBar({ tabs, activeId }: TabBarProps) {
  return (
    <div className="tab-bar" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <div key={tab.id} role="tab" aria-selected={active} className={active ? 'tab active' : 'tab'}>
            <span className="tab-name">{tab.name}</span>
            <button className="tab-close" aria-label={`Close ${tab.name}`}>
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
