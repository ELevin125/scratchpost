import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  type IpcMainInvokeEvent,
  type OpenDialogOptions
} from 'electron'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { FileMeta } from '../preload/api'
import { listFolder } from './fs/list'
import { createNote, deleteIfEmpty, renameNote } from './fs/note'
import { readTextFile } from './fs/read'
import { searchFolder } from './fs/search'
import { indexTags } from './fs/tags'
import { writeTextFile } from './fs/write'
import { loadSession, saveSession } from './session'
import { loadSettings, saveSettings } from './settings'

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
}

// Configurable in settings (3.4); until then always the default.
async function getScratchDir(): Promise<string> {
  const dir = join(app.getPath('documents'), 'Scratchpost')
  await mkdir(dir, { recursive: true })
  return dir
}

async function pickPath(event: IpcMainInvokeEvent, options: OpenDialogOptions): Promise<string | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

// Links in notes are untrusted text. Only web and mail links reach the OS;
// file:, javascript: and custom schemes never do.
export function isExternalUrl(url: string): boolean {
  try {
    return EXTERNAL_PROTOCOLS.has(new URL(url).protocol)
  } catch {
    return false
  }
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

  ipcMain.handle('renameFile', (_event, from: unknown, to: unknown) => {
    assertString(from, 'from')
    assertString(to, 'to')
    return renameNote(from, to)
  })

  // The scratch folder comes from main, never the renderer, so this can only
  // ever delete inside it.
  ipcMain.handle('deleteIfEmpty', async (_event, path: unknown) => {
    assertString(path, 'path')
    return deleteIfEmpty(path, await getScratchDir())
  })

  ipcMain.handle('listFolder', (_event, path: unknown) => {
    assertString(path, 'path')
    return listFolder(path)
  })

  ipcMain.handle('searchFolder', (_event, path: unknown, query: unknown) => {
    assertString(path, 'path')
    assertString(query, 'query')
    return searchFolder(path, query)
  })

  ipcMain.handle('listTags', (_event, path: unknown) => {
    assertString(path, 'path')
    return indexTags(path)
  })

  ipcMain.handle('pickFile', async (event) =>
    pickPath(event, {
      // Start where closed notes live; any folder is still one click away.
      defaultPath: await getScratchDir(),
      properties: ['openFile'],
      filters: [
        { name: 'Text', extensions: ['md', 'txt'] },
        { name: 'All files', extensions: ['*'] }
      ]
    })
  )

  ipcMain.handle('pickFolder', (event) => pickPath(event, { properties: ['openDirectory'] }))

  ipcMain.handle('getSession', () => loadSession())

  ipcMain.handle('setSession', (_event, session: unknown) => saveSession(session))

  ipcMain.handle('getSettings', () => loadSettings())

  ipcMain.handle('setSettings', (_event, settings: unknown) => saveSettings(settings))

  ipcMain.handle('openExternal', (_event, url: unknown) => {
    assertString(url, 'url')
    if (!isExternalUrl(url)) throw new Error(`not an http, https or mailto link: ${url}`)
    return shell.openExternal(url)
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
