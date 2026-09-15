import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions } from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileMeta } from '../preload/api'
import { createNote } from './fs/note'
import { readTextFile } from './fs/read'
import { writeTextFile } from './fs/write'

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
}

// Configurable in settings (3.4); until then always the default.
async function getScratchDir(): Promise<string> {
  const dir = join(app.getPath('documents'), 'Scratchpost')
  await mkdir(dir, { recursive: true })
  return dir
}

// Every handler lives here. Channel names match ScratchpostAPI method names.
export function registerIpc(): void {
  ipcMain.handle('readFile', (_event, path: unknown) => {
    assertString(path, 'path')
    return readTextFile(path)
  })

  ipcMain.handle('writeFile', (_event, path: unknown, content: unknown, meta: FileMeta) => {
    assertString(path, 'path')
    assertString(content, 'content')
    return writeTextFile(path, content, meta)
  })

  ipcMain.handle('getScratchDir', () => getScratchDir())

  ipcMain.handle('createNote', (_event, scratchDir: unknown) => {
    assertString(scratchDir, 'scratchDir')
    return createNote(scratchDir)
  })

  ipcMain.handle('pickFile', async (event) => {
    const options: OpenDialogOptions = {
      // Start where closed notes live; any folder is still one click away.
      defaultPath: await getScratchDir(),
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['md', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    }
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
}

// Holds the window open until the renderer has flushed pending saves. Covers
// both closing the window and quitting. Gives up after 2s so a stuck renderer
// can never make the window unclosable.
export function flushBeforeClose(win: BrowserWindow): void {
  let ready = false
  let waiting = false

  win.on('close', (event) => {
    if (ready) return
    event.preventDefault()
    if (waiting) return
    waiting = true

    const finish = () => {
      clearTimeout(timer)
      ipcMain.removeListener('closeReady', onReady)
      ready = true
      win.close()
    }
    const onReady = (e: Electron.IpcMainEvent) => {
      if (e.sender === win.webContents) finish()
    }
    const timer = setTimeout(finish, 2000)
    ipcMain.on('closeReady', onReady)
    win.webContents.send('beforeClose')
  })
}
