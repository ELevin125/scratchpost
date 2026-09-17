import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Icon } from './Icon'
import { commands, shortcutOf, shortcutOwner, type Command } from './state/commands'
import { fuzzyFilter } from './state/fuzzy'
import { formatShortcut } from './state/shortcuts'

interface ShortcutsPanelProps {
  keybindings: Record<string, string> // command id to shortcut, '' for none
  onChange: (keybindings: Record<string, string>) => void
  onClose: () => void
}

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta', 'AltGraph', 'CapsLock'])

// A key press as a registry shortcut string, or null while only modifiers are
// held. Digits with Shift use the physical key, like the built-in list keys.
export function shortcutFromEvent(event: Pick<globalThis.KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'metaKey'>): string | null {
  if (MODIFIER_KEYS.has(event.key)) return null
  const parts = [event.ctrlKey && 'Ctrl', event.shiftKey && 'Shift', event.altKey && 'Alt', event.metaKey && 'Meta']
  let key = event.key
  if (event.code.startsWith('Digit') && event.shiftKey) key = event.code
  else if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()
  if (key === '+') return null // the separator can't be a key
  return [...parts.filter(Boolean), key].join('+')
}

// Plain and shifted keys are for typing; only function keys may go without
// Ctrl, Alt or Meta.
const usable = (shortcut: string) => /(^|\+)(Ctrl|Alt|Meta)\+/.test(shortcut) || /(^|\+)F\d{1,2}$/.test(shortcut)

// Rebinding shortcuts (4.12): every command, its current keys, click to record
// new ones. Only changes from the defaults are saved.
export function ShortcutsPanel({ keybindings, onChange, onClose }: ShortcutsPanelProps) {
  const [query, setQuery] = useState('')
  const [recording, setRecording] = useState<string | null>(null)
  const [pending, setPending] = useState<{ id: string; shortcut: string; owner: Command } | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const recorder = useRef<HTMLInputElement>(null)
  const useHere = useRef<HTMLButtonElement>(null)

  const list = useMemo(() => fuzzyFilter([...commands], query, (c) => c.label), [query])

  useEffect(() => {
    if (recording) recorder.current?.focus()
  }, [recording])

  // Enter takes the shortcut, Escape keeps things as they were.
  useEffect(() => {
    useHere.current?.focus()
  }, [pending])

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || recording || pending) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [recording, pending, onClose])

  const assign = (changes: Record<string, string>) => {
    const next = { ...keybindings }
    for (const [id, shortcut] of Object.entries(changes)) {
      const command = commands.find((c) => c.id === id)
      // Back to the default: nothing to store.
      if (command && (command.shortcut ?? '') === shortcut) delete next[id]
      else next[id] = shortcut
    }
    onChange(next)
  }

  const onRecordKey = (event: KeyboardEvent<HTMLInputElement>, id: string) => {
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Escape') {
      setRecording(null)
      setHint(null)
      return
    }
    const shortcut = shortcutFromEvent(event.nativeEvent)
    if (!shortcut) return
    if (!usable(shortcut)) {
      setHint('Use Ctrl or Alt with that key: on its own it types.')
      return
    }
    setRecording(null)
    setHint(null)
    const owner = shortcutOwner(shortcut, id)
    if (owner) setPending({ id, shortcut, owner })
    else assign({ [id]: shortcut })
  }

  const changed = Object.keys(keybindings).length > 0

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        className="overlay settings shortcuts"
        role="dialog"
        aria-label="Keyboard shortcuts"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-head">
          <h2>Keyboard shortcuts</h2>
          <button className="icon-button" title="Close (Esc)" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>
        <input
          id="shortcuts-filter"
          className="overlay-input"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder="Filter commands"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {pending && (
          <div className="shortcut-conflict" role="alert">
            <span>
              {formatShortcut(pending.shortcut)} is used by <b>{pending.owner.label}</b>.
            </span>
            <button
              ref={useHere}
              className="primary"
              onKeyDown={(event) => {
                if (event.key !== 'Escape') return
                event.preventDefault()
                event.stopPropagation()
                setPending(null)
              }}
              onClick={() => {
                assign({ [pending.id]: pending.shortcut, [pending.owner.id]: '' })
                setPending(null)
              }}
            >
              Use it here
            </button>
            <button className="secondary" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        )}
        {hint && <p className="setting-note shortcut-hint">{hint}</p>}
        <ul className="shortcut-list">
          {list.map((command) => {
            const current = shortcutOf(command)
            const custom = keybindings[command.id] !== undefined
            const isRecording = recording === command.id
            return (
              <li key={command.id} className="shortcut-row">
                <span className="shortcut-label">{command.label}</span>
                {isRecording ? (
                  <input
                    ref={recorder}
                    id={`shortcut-record-${command.id}`}
                    className="shortcut-key recording"
                    readOnly
                    value="Press keys… (Esc cancels)"
                    onKeyDown={(event) => onRecordKey(event, command.id)}
                    onBlur={() => setRecording(null)}
                  />
                ) : (
                  <button
                    className={current ? 'shortcut-key' : 'shortcut-key empty'}
                    title="Change"
                    onClick={() => {
                      setPending(null)
                      setRecording(command.id)
                    }}
                  >
                    {current ? formatShortcut(current) : 'Add'}
                  </button>
                )}
                <span className="shortcut-actions">
                  {current && (
                    <button
                      className="icon-button"
                      title="Remove shortcut"
                      aria-label={`Remove shortcut for ${command.label}`}
                      onClick={() => assign({ [command.id]: '' })}
                    >
                      <Icon name="minus" size={14} />
                    </button>
                  )}
                  {custom && (
                    <button
                      className="text-button"
                      title={command.shortcut ? `Default: ${formatShortcut(command.shortcut)}` : 'Default: none'}
                      onClick={() => assign({ [command.id]: command.shortcut ?? '' })}
                    >
                      Reset
                    </button>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
        {changed && (
          <div className="setting-actions shortcut-footer">
            <button id="shortcuts-reset-all" className="text-button" onClick={() => onChange({})}>
              Reset all shortcuts
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
