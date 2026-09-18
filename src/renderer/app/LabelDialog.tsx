import { useEffect, useRef, useState } from 'react'
import { tagHue } from '../../shared/tags'

export type LabelScope = 'note' | 'folder'

export interface LabelRenameRequest {
  from: string
  to: string
  scope: LabelScope
  inList: boolean // also rename it in the labels kept in Settings
}

interface LabelDialogProps {
  label: string
  folderName: string
  inList: boolean // the label is one of the user's own
  onSubmit: (request: LabelRenameRequest) => void
  onClose: () => void
}

const SCOPES: { value: LabelScope; label: string }[] = [
  { value: 'note', label: 'This note' },
  { value: 'folder', label: 'Every note' }
]

// Renaming a label (5.6): in this note, or in every note in the folder, and in
// your own list of labels when it is one of them.
export function LabelDialog({ label, folderName, inList, onSubmit, onClose }: LabelDialogProps) {
  const [value, setValue] = useState(label)
  const [scope, setScope] = useState<LabelScope>('note')
  const [also, setAlso] = useState(inList)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    input.current?.focus()
    input.current?.select()
  }, [])

  const submit = () => {
    const to = value.trim()
    if (to === '' || to === label) return onClose()
    onSubmit({ from: label, to, scope, inList: inList && also })
  }

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        className="overlay label-dialog"
        role="dialog"
        aria-label={`Rename the label ${label}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="overlay-label">
          Rename{' '}
          <span className="label-pill" style={{ '--tag-hue': tagHue(label) } as React.CSSProperties}>
            {label}
          </span>
        </div>
        <input
          ref={input}
          id="label-rename-input"
          className="overlay-input"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />
        <div className="setting">
          <span className="setting-label" id="label-scope">
            Rename in
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="label-scope">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                id={`label-scope-${option.value}`}
                role="radio"
                aria-checked={scope === option.value}
                title={option.value === 'folder' ? `Every note in ${folderName}` : 'Only the note you are in'}
                className={scope === option.value ? 'on' : undefined}
                onClick={() => setScope(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {inList && (
          <div className="setting">
            <label className="setting-label" htmlFor="label-also-list">
              Also in my labels
            </label>
            <button
              id="label-also-list"
              role="switch"
              aria-checked={also}
              className={also ? 'switch on' : 'switch'}
              onClick={() => setAlso(!also)}
            >
              <span className="switch-knob" />
            </button>
          </div>
        )}
        <div className="setting-actions label-actions">
          <button id="label-rename-go" className="pill-button" onClick={submit}>
            Rename
          </button>
          <button className="text-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
