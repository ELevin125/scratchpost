import { useEffect, useRef, useState } from 'react'

interface RenameDialogProps {
  name: string // current filename, extension included
  onSubmit: (name: string) => void
  onClose: () => void
}

// F2 or the rename command: the only way a file is ever renamed.
export function RenameDialog({ name, onSubmit, onClose }: RenameDialogProps) {
  const [value, setValue] = useState(name)
  const input = useRef<HTMLInputElement>(null)

  // Select the name without its extension, the usual file-manager behaviour.
  useEffect(() => {
    const el = input.current
    if (!el) return
    el.focus()
    const dot = name.lastIndexOf('.')
    el.setSelectionRange(0, dot > 0 ? dot : name.length)
  }, [name])

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        className="overlay"
        role="dialog"
        aria-label="Rename file"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="overlay-label">Rename</div>
        <input
          ref={input}
          className="overlay-input"
          spellCheck={false}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && value.trim() !== '') {
              event.preventDefault()
              onSubmit(value.trim())
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />
      </div>
    </div>
  )
}
