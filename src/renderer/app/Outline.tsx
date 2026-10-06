import type { Heading } from '../editor/outline'
import { Icon } from './Icon'

interface OutlineProps {
  headings: Heading[]
  current: number // index of the heading the cursor is under, -1 for none
  onJump: (heading: Heading) => void
}

// The open note's headings, in the left column between the notes and the tags
// (6.4). Clicking one jumps to it. Hidden for a note without headings.
export function Outline({ headings, current, onJump }: OutlineProps) {
  if (headings.length === 0) return null
  // Indented from the shallowest level in the note, so a note that starts at
  // `##` doesn't waste the first step.
  const top = Math.min(...headings.map((heading) => heading.level))
  return (
    <section className="panel outline-panel" aria-label="Headings">
      <div className="panel-title">
        <Icon name="outline" size={14} />
        <span>Headings</span>
        <span className="panel-count">{headings.length}</span>
      </div>
      <ul className="rows">
        {headings.map((heading, i) => (
          <li key={`${heading.line}:${heading.text}`}>
            <button
              className={i === current ? 'row active' : 'row'}
              style={{ paddingLeft: `calc(10px + ${(heading.level - top) * 12}px)` }}
              title={heading.text}
              aria-current={i === current ? 'location' : undefined}
              onClick={() => onJump(heading)}
            >
              <span className="row-name">{heading.text}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
