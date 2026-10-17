import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { HistoryUsage } from '../../preload/api'
import type { Settings } from '../../preload/api'
import { tagHue, tagKey } from '../../shared/tags'
import { labelWord } from '../editor/format'
import { labelHues, seeds } from '../themes'
import { CAT_NAME, type CatSpot } from './Cat'
import { Icon } from './Icon'
import { dockableCommands, DEFAULT_DOCK, shortcutOf } from './state/commands'
import { formatShortcut } from './state/shortcuts'

export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 24

type ThemeSettings = Settings['theme']

interface SettingsPanelProps {
  theme: ThemeSettings
  fontSize: number
  cat: boolean
  catSpot: CatSpot
  labels: string[]
  autoArchiveDays: number
  noteColumns: number
  dock: readonly string[] // command ids on the dock, in order (7.5)
  scratchDir: string // the folder in use, custom or default
  customScratch: boolean // false when the default folder is in use
  onTheme: (theme: ThemeSettings) => void
  onFontSize: (size: number) => void
  onCat: (on: boolean) => void
  onCatSpot: (spot: CatSpot) => void
  onLabels: (labels: string[]) => void
  labelColours: Record<string, number> // hues chosen for words, lowercased (6.8)
  onLabelColour: (word: string, hue: number | null) => void
  onAutoArchiveDays: (days: number) => void
  onNoteColumns: (columns: number) => void
  onDock: (ids: string[]) => void
  onShortcuts: () => void
  historyUsage: () => Promise<HistoryUsage>
  onClearHistory: () => Promise<void>
  onPickScratch: () => void
  onDefaultScratch: () => void
  onClose: () => void
}

const MODES: { value: ThemeSettings['mode']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`
}

const NOTE_WIDTHS: { columns: number; label: string; title: string }[] = [
  { columns: 80, label: '80', title: '80 characters a line' },
  { columns: 100, label: '100', title: '100 characters a line, the default' },
  { columns: 999, label: 'Full', title: 'As wide as the window' }
]

const AUTO_ARCHIVE: { days: number; label: string; title: string }[] = [
  { days: 0, label: 'Never', title: 'Nothing is archived on its own' },
  { days: 30, label: '30 days', title: 'After a month without changes' },
  { days: 90, label: '90 days', title: 'After three months without changes' },
  { days: 365, label: 'A year', title: 'After a year without changes' }
]

const CAT_SPOTS: { value: CatSpot; label: string; title: string }[] = [
  { value: 'dock', label: 'Dock', title: 'On the dock' },
  { value: 'top', label: 'Top', title: 'On the top edge of the note' },
  { value: 'date', label: 'Date', title: 'On the date (hidden on narrow windows)' },
  { value: 'corner', label: 'Corner', title: "In the note's bottom-right corner" },
  { value: 'tags', label: 'Tags', title: 'On the tags panel' }
]

const hueStyle = (hue: number) => ({ '--swatch-hue': hue }) as CSSProperties

// Settings (3.4). Every change applies and saves at once; there is no Save
// button, as with notes.
export function SettingsPanel({
  theme,
  fontSize,
  cat,
  catSpot,
  labels,
  autoArchiveDays,
  noteColumns,
  dock,
  scratchDir,
  customScratch,
  onTheme,
  onFontSize,
  onCat,
  onCatSpot,
  onLabels,
  labelColours,
  onLabelColour,
  onAutoArchiveDays,
  onNoteColumns,
  onDock,
  onShortcuts,
  historyUsage,
  onClearHistory,
  onPickScratch,
  onDefaultScratch,
  onClose
}: SettingsPanelProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [newLabel, setNewLabel] = useState('')
  const [colouring, setColouring] = useState<string | null>(null) // the label whose colours are showing
  // What the local history is using, and a two-step clear (5.10).
  const [usage, setUsage] = useState<HistoryUsage | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    let live = true
    historyUsage().then(
      (result) => live && setUsage(result),
      () => live && setUsage(null)
    )
    return () => {
      live = false
    }
  }, [historyUsage])
  const chosenHue = (word: string): number | null => labelColours[tagKey(word)] ?? null
  // The dock (7.5): what is on it, in order, and what is left to add.
  const docked = dock.map((id) => dockableCommands.find((c) => c.id === id)).filter((c) => c !== undefined)
  const spare = dockableCommands.filter((command) => !dock.includes(command.id))
  const moveDocked = (from: number, to: number) => {
    const ids = docked.map((c) => c.id)
    const [moved] = ids.splice(from, 1)
    ids.splice(to, 0, moved)
    onDock(ids)
  }
  const isDefaultDock = dock.length === DEFAULT_DOCK.length && dock.every((id, i) => id === DEFAULT_DOCK[i])

  const addLabel = () => {
    const word = labelWord(newLabel)
    if (!word) return
    if (!labels.some((l) => l.toLowerCase() === word.toLowerCase())) onLabels([...labels, word])
    setNewLabel('')
  }

  useEffect(() => {
    panel.current?.focus()
  }, [])

  // On the window, so Escape works wherever focus is (the hue slider keeps it).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <div
        ref={panel}
        className="overlay settings"
        role="dialog"
        aria-label="Settings"
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="settings-head">
          <h2>Settings</h2>
          <button className="icon-button" title="Close (Esc)" aria-label="Close" onClick={onClose}>
            <Icon name="x" />
          </button>
        </div>

        <section className="settings-section">
          <h3>Appearance</h3>

          <div className="setting">
            <span className="setting-label" id="setting-mode">
              Mode
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="setting-mode">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  id={`setting-mode-${mode.value}`}
                  role="radio"
                  aria-checked={theme.mode === mode.value}
                  className={theme.mode === mode.value ? 'on' : undefined}
                  onClick={() => onTheme({ ...theme, mode: mode.value })}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting">
            <span className="setting-label" id="setting-colour">
              Colour
            </span>
            <div className="swatches" role="radiogroup" aria-labelledby="setting-colour">
              {seeds.map((seed) => (
                <button
                  key={seed.hue}
                  id={`setting-seed-${seed.hue}`}
                  role="radio"
                  aria-checked={theme.seed === seed.hue}
                  title={seed.name}
                  aria-label={seed.name}
                  className={theme.seed === seed.hue ? 'swatch-button on' : 'swatch-button'}
                  onClick={() => onTheme({ ...theme, seed: seed.hue })}
                >
                  <span className="swatch" style={hueStyle(seed.hue)} />
                </button>
              ))}
            </div>
          </div>

          <div className="setting">
            <label className="setting-label" htmlFor="setting-hue">
              Any hue
            </label>
            <div className="hue-row">
              <span className="swatch" style={hueStyle(theme.seed)} />
              <input
                id="setting-hue"
                type="range"
                min={0}
                max={359}
                value={theme.seed}
                onChange={(event) => onTheme({ ...theme, seed: Number(event.target.value) })}
              />
              <span className="setting-value">{theme.seed}°</span>
            </div>
          </div>

          <div className="setting">
            <span className="setting-label" id="setting-size">
              Note text
            </span>
            <div className="stepper" aria-labelledby="setting-size">
              <button
                id="setting-size-down"
                className="icon-button"
                aria-label="Smaller"
                disabled={fontSize <= MIN_FONT_SIZE}
                onClick={() => onFontSize(fontSize - 1)}
              >
                <Icon name="minus" size={16} />
              </button>
              <span className="setting-value">{fontSize}px</span>
              <button
                id="setting-size-up"
                className="icon-button"
                aria-label="Larger"
                disabled={fontSize >= MAX_FONT_SIZE}
                onClick={() => onFontSize(fontSize + 1)}
              >
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>

          <div className="setting">
            <span className="setting-label" id="setting-width">
              Text width
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="setting-width">
              {NOTE_WIDTHS.map((option) => (
                <button
                  key={option.columns}
                  id={`setting-width-${option.columns}`}
                  role="radio"
                  aria-checked={noteColumns === option.columns}
                  title={option.title}
                  className={noteColumns === option.columns ? 'on' : undefined}
                  onClick={() => onNoteColumns(option.columns)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="setting">
            <label className="setting-label" htmlFor="setting-cat">
              {CAT_NAME}, the cat
            </label>
            <button
              id="setting-cat"
              role="switch"
              aria-checked={cat}
              className={cat ? 'switch on' : 'switch'}
              onClick={() => onCat(!cat)}
            >
              <span className="switch-knob" />
            </button>
          </div>

          {cat && (
            <div className="setting">
              <span className="setting-label" id="setting-cat-spot">
                {CAT_NAME} sits
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="setting-cat-spot">
                {CAT_SPOTS.map((spot) => (
                  <button
                    key={spot.value}
                    id={`setting-cat-spot-${spot.value}`}
                    role="radio"
                    title={spot.title}
                    aria-checked={catSpot === spot.value}
                    className={catSpot === spot.value ? 'on' : undefined}
                    onClick={() => onCatSpot(spot.value)}
                  >
                    {spot.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>Dock</h3>
          <div className="setting setting-stack">
            <p className="setting-note">
              The row of buttons along the bottom of a note, in order: the top of this list is the left of the dock.
              A button is greyed when its command doesn't apply, so the dock keeps the shape you give it.
            </p>
            {docked.length === 0 ? (
              <p className="setting-note dock-empty">Nothing on the dock.</p>
            ) : (
              <ol className="dock-rows">
                {docked.map((command, i) => {
                  const shortcut = shortcutOf(command)
                  return (
                    <li key={command.id} className="dock-row">
                      <Icon name={command.icon} size={16} />
                      <span className="dock-row-label">{command.label}</span>
                      <kbd className="dock-row-key">{shortcut ? formatShortcut(shortcut) : ''}</kbd>
                      <span className="dock-row-actions">
                        <button
                          className="icon-button"
                          title="Move up"
                          aria-label={`Move ${command.label} up`}
                          disabled={i === 0}
                          onClick={() => moveDocked(i, i - 1)}
                        >
                          <Icon name="chevronUp" size={16} />
                        </button>
                        <button
                          className="icon-button"
                          title="Move down"
                          aria-label={`Move ${command.label} down`}
                          disabled={i === docked.length - 1}
                          onClick={() => moveDocked(i, i + 1)}
                        >
                          <Icon name="chevronDown" size={16} />
                        </button>
                        <button
                          className="icon-button"
                          title="Take off the dock"
                          aria-label={`Take ${command.label} off the dock`}
                          onClick={() => onDock(dock.filter((id) => id !== command.id))}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            {spare.length > 0 && (
              <div className="dock-add">
                {spare.map((command) => (
                  <button
                    key={command.id}
                    id={`setting-dock-add-${command.id}`}
                    className="pill-button"
                    title={`Put ${command.label} on the dock`}
                    onClick={() => onDock([...dock, command.id])}
                  >
                    <Icon name={command.icon} size={16} />
                    {command.label}
                  </button>
                ))}
              </div>
            )}
            {!isDefaultDock && (
              <div className="setting-actions">
                <button id="setting-dock-reset" className="text-button" onClick={() => onDock([...DEFAULT_DOCK])}>
                  Back to the usual dock
                </button>
              </div>
            )}
          </div>
        </section>

        <section className="settings-section">
          <h3>Keyboard</h3>
          <div className="setting">
            <span className="setting-label">Shortcuts</span>
            <button id="setting-shortcuts" className="pill-button" onClick={onShortcuts}>
              <Icon name="command" size={16} />
              Change shortcuts…
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>History</h3>
          <div className="setting">
            <span className="setting-label">On this computer</span>
            <span className="setting-value setting-usage">
              {usage === null
                ? '—'
                : usage.versions === 0
                  ? 'nothing saved yet'
                  : `${formatBytes(usage.bytes)} · ${usage.versions} versions of ${usage.notes} ${
                      usage.notes === 1 ? 'note' : 'notes'
                    }`}
            </span>
          </div>
          <div className="setting">
            <span className="setting-label">Older versions</span>
            <div className="setting-actions">
              {confirmClear ? (
                <>
                  <button
                    id="setting-history-clear-confirm"
                    className="pill-button danger"
                    onClick={() => {
                      setConfirmClear(false)
                      void onClearHistory().then(() => setUsage({ bytes: 0, versions: 0, notes: 0 }))
                    }}
                  >
                    Delete every version
                  </button>
                  <button className="text-button" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  id="setting-history-clear"
                  className="pill-button"
                  disabled={usage !== null && usage.versions === 0}
                  onClick={() => setConfirmClear(true)}
                >
                  <Icon name="history" size={16} />
                  Clear history
                </button>
              )}
            </div>
          </div>
          <p className="setting-note setting-wide">
            Versions are pruned as they age and capped at 200 MB. Clearing them leaves your notes alone.
          </p>
        </section>

        <section className="settings-section">
          <h3>Labels</h3>
          <div className="setting setting-stack">
            <p className="setting-note">
              Offered first by Insert label (Ctrl+L) and the right-click menu, in every note. Click one to choose its
              colour.
            </p>
            <div className="label-list">
              {labels.map((word) => (
                <span key={word} className="label-chip" style={{ '--tag-hue': tagHue(word) } as CSSProperties}>
                  <button
                    className="label-chip-word"
                    title={`Colour of ${word}`}
                    aria-expanded={colouring === word}
                    onClick={() => setColouring(colouring === word ? null : word)}
                  >
                    {word}
                  </button>
                  <button aria-label={`Remove ${word}`} title="Remove" onClick={() => onLabels(labels.filter((l) => l !== word))}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <input
                id="setting-label-new"
                className="label-input"
                placeholder="Add a label"
                autoComplete="off"
                spellCheck={false}
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addLabel()
                  }
                }}
                onBlur={addLabel}
              />
            </div>
            {colouring !== null && labels.includes(colouring) && (
              <div className="label-colours" role="radiogroup" aria-label={`Colour of ${colouring}`}>
                <span className="label-pill" style={{ '--tag-hue': tagHue(colouring) } as CSSProperties}>
                  {colouring}
                </span>
                <div className="swatches">
                  <button
                    role="radio"
                    aria-checked={chosenHue(colouring) === null}
                    title="Automatic, from the word"
                    className={chosenHue(colouring) === null ? 'swatch-button auto on' : 'swatch-button auto'}
                    onClick={() => onLabelColour(colouring, null)}
                  >
                    Auto
                  </button>
                  {labelHues.map((colour) => (
                    <button
                      key={colour.hue}
                      role="radio"
                      aria-checked={chosenHue(colouring) === colour.hue}
                      aria-label={colour.name}
                      title={colour.name}
                      className={chosenHue(colouring) === colour.hue ? 'swatch-button on' : 'swatch-button'}
                      onClick={() => onLabelColour(colouring, colour.hue)}
                    >
                      <span className="swatch" style={hueStyle(colour.hue)} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="settings-section">
          <h3>Notes</h3>
          <div className="setting">
            <span className="setting-label" id="setting-auto-archive">
              Archive old notes
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="setting-auto-archive">
              {AUTO_ARCHIVE.map((option) => (
                <button
                  key={option.days}
                  id={`setting-auto-archive-${option.days}`}
                  role="radio"
                  aria-checked={autoArchiveDays === option.days}
                  title={option.title}
                  className={autoArchiveDays === option.days ? 'on' : undefined}
                  onClick={() => onAutoArchiveDays(option.days)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <p className="setting-note setting-wide">
            At launch, scratch notes you haven't touched in that long move into an <code>archive</code> folder. Open
            and pinned notes stay put.
          </p>

          <div className="setting setting-stack">
            <span className="setting-label">Scratch folder</span>
            <span className="setting-path" title={scratchDir}>
              {scratchDir}
            </span>
            <p className="setting-note">New notes are created here. Moving it doesn't move existing notes.</p>
            <div className="setting-actions">
              <button id="setting-scratch-change" className="pill-button" onClick={onPickScratch}>
                <Icon name="open" size={16} />
                Change…
              </button>
              {customScratch && (
                <button id="setting-scratch-default" className="text-button" onClick={onDefaultScratch}>
                  Use Documents/Scratchpost
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
