import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { Settings } from '../../preload/api'
import { tagHue } from '../../shared/tags'
import { labelWord } from '../editor/format'
import { seeds } from '../themes'
import { Icon } from './Icon'

export const MIN_FONT_SIZE = 10
export const MAX_FONT_SIZE = 24

type ThemeSettings = Settings['theme']

interface SettingsPanelProps {
  theme: ThemeSettings
  fontSize: number
  cat: boolean
  labels: string[]
  scratchDir: string // the folder in use, custom or default
  customScratch: boolean // false when the default folder is in use
  onTheme: (theme: ThemeSettings) => void
  onFontSize: (size: number) => void
  onCat: (on: boolean) => void
  onLabels: (labels: string[]) => void
  onPickScratch: () => void
  onDefaultScratch: () => void
  onClose: () => void
}

const MODES: { value: ThemeSettings['mode']; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' }
]

const hueStyle = (hue: number) => ({ '--swatch-hue': hue }) as CSSProperties

// Settings (3.4). Every change applies and saves at once; there is no Save
// button, as with notes.
export function SettingsPanel({
  theme,
  fontSize,
  cat,
  labels,
  scratchDir,
  customScratch,
  onTheme,
  onFontSize,
  onCat,
  onLabels,
  onPickScratch,
  onDefaultScratch,
  onClose
}: SettingsPanelProps) {
  const panel = useRef<HTMLDivElement>(null)
  const [newLabel, setNewLabel] = useState('')
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
            <label className="setting-label" htmlFor="setting-cat">
              The cat
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
        </section>

        <section className="settings-section">
          <h3>Labels</h3>
          <div className="setting setting-stack">
            <p className="setting-note">
              Offered first by Insert label (Ctrl+L) and the right-click menu, in every note.
            </p>
            <div className="label-list">
              {labels.map((word) => (
                <span key={word} className="label-chip" style={{ '--tag-hue': tagHue(word) } as CSSProperties}>
                  {word}
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
          </div>
        </section>

        <section className="settings-section">
          <h3>Notes</h3>
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
