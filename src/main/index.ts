import { app, BrowserWindow, session } from 'electron'
import { join } from 'node:path'
import { loadWindowState, trackWindowState } from './window'

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
    minHeight: 320,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  trackWindowState(win)
  // Not 'ready-to-show': it waits for a first paint, and on Wayland a hidden
  // window never paints, so the window would never appear.
  win.webContents.once('did-finish-load', () => {
    if (state.maximized) win.maximize()
    win.show()
  })

  win.webContents.on('will-navigate', (event) => event.preventDefault())
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (devUrl) {
    win.loadURL(devUrl)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] }
    })
  })

  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
