import { app, BrowserWindow, screen } from 'electron'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
}

const defaults: WindowState = { width: 900, height: 670, maximized: false }

const statePath = () => join(app.getPath('userData'), 'window-state.json')

// Call after app ready; screen is unavailable before then.
export function loadWindowState(): WindowState {
  try {
    const state: WindowState = { ...defaults, ...JSON.parse(readFileSync(statePath(), 'utf8')) }
    const { x, y } = state
    if (x !== undefined && y !== undefined) {
      // Forget the position if it's off every display, e.g. a monitor was unplugged.
      const onScreen = screen
        .getAllDisplays()
        .some(({ workArea: a }) => x >= a.x && y >= a.y && x < a.x + a.width && y < a.y + a.height)
      if (!onScreen) {
        delete state.x
        delete state.y
      }
    }
    return state
  } catch {
    return defaults
  }
}

export function trackWindowState(win: BrowserWindow): void {
  win.on('close', () => {
    const maximized = win.isMaximized()
    const bounds = maximized ? win.getNormalBounds() : win.getBounds()
    const tmp = statePath() + '.tmp'
    writeFileSync(tmp, JSON.stringify({ ...bounds, maximized }))
    renameSync(tmp, statePath())
  })
}
