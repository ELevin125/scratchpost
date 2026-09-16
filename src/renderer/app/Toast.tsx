import { useEffect } from 'react'

interface ToastProps {
  text: string
  onDismiss: () => void
}

const TOAST_MS = 8000

// A notice that isn't about saving: a file that couldn't open, a note moved to
// the trash, a copied path. Floats above the dock and goes away by itself.
export function Toast({ text, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [text, onDismiss])

  return (
    <button className="toast" role="status" title="Dismiss" onClick={onDismiss}>
      {text}
    </button>
  )
}
