import type { ReactNode } from 'react'

export interface NoteDate {
  month: string // "SEP"
  weekday: string // "WED"
  day: number
}

interface NoteHeaderProps {
  meta: string[] // folder, edited time, word count
  problem: string | null // a failed or slow save
  problemIsError: boolean
  date: NoteDate | null
  onDate?: ReactNode // Bean, when it sits on the date (D42)
}

// Above the note (D33): where it lives, when it changed, how long it is, and
// the note's date set large. Save problems show here, never as a prompt.
export function NoteHeader({ meta, problem, problemIsError, date, onDate }: NoteHeaderProps) {
  return (
    <div className="note-header">
      <div className="note-meta">
        {meta.map((item) => (
          <span key={item}>{item}</span>
        ))}
        {problem && <span className={problemIsError ? 'note-problem error' : 'note-problem'}>{problem}</span>}
      </div>
      {date && (
        <div className="date-block" aria-label={`${date.weekday} ${date.day} ${date.month}`}>
          <span className="date-top">
            {date.month} {date.weekday}
          </span>
          <span className="date-day">{date.day}</span>
          {onDate}
        </div>
      )}
    </div>
  )
}
