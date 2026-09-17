import { app, BrowserWindow, Menu, session } from 'electron'
import { join } from 'node:path'
import { flushBeforeClose, registerIpc } from './ipc'
import { handleOpenRequests } from './launch'
import { loadWindowState, trackWindowState } from './window'
import iconPath from '../../resources/icon.png?asset'

const devUrl = process.env.ELECTRON_RENDERER_URL

// No remote origins, ever. Dev relaxes script-src for Vite's inline React
// refresh preamble and connect-src for the HMR websocket.
const csp = devUrl
  ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ws://localhost:*"
  : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'"

function createWindow(): void {
  const state = loadWindowState()
  const win = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 480,
    // Windows and macOS take the icon from the package; Linux needs it here.
    ...(process.platform === 'linux' ? { icon: iconPath } : {}),
    minHeight: 320,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  trackWindowState(win)
  flushBeforeClose(win)
  // Not 'ready-to-show': it waits for a first paint, and on Wayland a hidden
  // window never paints, so the window would never appear.
  win.webContents.once('did-finish-load', () => {
    if (state.maximized) win.maximize()
    win.show()
  })

  // Dev only: devtools on Ctrl+Shift+I, since there is no application menu to
  // provide it. Never in production.
  if (devUrl) {
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
        win.webContents.toggleDevTools()
        event.preventDefault()
      }
    })
  }

  win.webContents.on('will-navigate', (event, url) => {
    // Dev only: Vite reloads the page after re-optimising dependencies. Blocking
    // that reload left the window stuck on a half-loaded, white page.
    if (devUrl && new URL(url).origin === new URL(devUrl).origin) return
    event.preventDefault()
  })
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// One window, one process: a second launch hands its paths to the first and
// quits. See D32.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  handleOpenRequests(() => BrowserWindow.getAllWindows()[0] ?? null)
  app.whenReady().then(start)
}

function start(): void {
  // No application menu: its accelerators bypassed the command registry. See D29.
  Menu.setApplicationMenu(null)

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })

  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
