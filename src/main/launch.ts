import { app, ipcMain, type BrowserWindow, type WebContents } from 'electron'
import { open, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { OpenRequest } from '../preload/api'

// Opening from outside the app (2.18, D32): paths on the command line, "Open
// with" from a file manager (which is the command line again), a second launch
// while the app is running, and drag and drop onto the window.

// Packaged: [exe, ...args]. Unpackaged (dev): [electron, appPath, ...args].
// Switches are dropped, including any Chromium adds on a second launch.
export function pathsFromArgv(argv: readonly string[], unpackaged: boolean): string[] {
  return argv.slice(unpackaged ? 2 : 1).filter((arg) => arg !== '' && !arg.startsWith('-'))
}

const SNIFF_BYTES = 8192

// A NUL byte in the first 8 KB means binary; such a file never opens as a note.
async function looksBinary(path: string): Promise<boolean> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(SNIFF_BYTES)
    const { bytesRead } = await handle.read(buffer, 0, SNIFF_BYTES, 0)
    return buffer.subarray(0, bytesRead).includes(0)
  } finally {
    await handle.close()
  }
}

// Sorts raw paths into files to open and folders to switch to. Relative paths
// resolve against cwd; file:// URIs are accepted. Missing paths are dropped.
export async function classifyPaths(paths: readonly string[], cwd: string): Promise<OpenRequest> {
  const request: OpenRequest = { files: [], folders: [], skipped: [] }
  for (const raw of paths) {
    let path: string
    try {
      path = resolve(cwd, raw.startsWith('file://') ? fileURLToPath(raw) : raw)
    } catch {
      continue
    }
    try {
      const info = await stat(path)
      if (info.isDirectory()) request.folders.push(path)
      else if (info.isFile()) (await looksBinary(path) ? request.skipped : request.files).push(path)
    } catch {
      // Gone or unreadable: nothing to open.
    }
  }
  return request
}

const isEmpty = (request: OpenRequest) =>
  request.files.length === 0 && request.folders.length === 0 && request.skipped.length === 0

// Requests wait until the renderer has restored its session and subscribed.
export function handleOpenRequests(getWindow: () => BrowserWindow | null): void {
  const pending: OpenRequest[] = []
  let receiver: WebContents | null = null

  const deliver = (request: OpenRequest) => {
    if (isEmpty(request)) return
    if (receiver && !receiver.isDestroyed()) receiver.send('openPaths', request)
    else pending.push(request)
  }

  ipcMain.on('openPathsReady', (event) => {
    receiver = event.sender
    for (const request of pending.splice(0)) receiver.send('openPaths', request)
  })

  app.on('second-instance', (_event, argv, cwd) => {
    const win = getWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
    void classifyPaths(pathsFromArgv(argv, process.defaultApp === true), cwd).then(deliver)
  })

  void classifyPaths(pathsFromArgv(process.argv, process.defaultApp === true), process.cwd()).then(deliver)
}
