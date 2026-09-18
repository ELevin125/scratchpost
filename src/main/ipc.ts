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
import { isExternalUrl } from './external'
import { HistoryStore } from './fs/history'
import { renameLabelInFolder } from './fs/labels'
import { listFolder } from './fs/list'
import { archiveNote, createNote, deleteIfEmpty, isNoteFile, renameNote, unarchiveNote } from './fs/note'
import { readTextFile } from './fs/read'
import { searchFolder } from './fs/search'
import { indexTags } from './fs/tags'
import { createWelcomeNote } from './fs/welcome'
import { PathWatcher } from './fs/watch'
import { writeTextFile } from './fs/write'
import { classifyPaths } from './launch'
import { loadSession, saveSession } from './session'
import { loadSettings, saveSettings } from './settings'
import welcomeText from './welcome.md?raw'

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
}

// The settings' scratch folder, or ~/Documents/Scratchpost. Created if missing.
async function getScratchDir(): Promise<string> {
  const dir = (await loadSettings()).scratchDir ?? join(app.getPath('documents'), 'Scratchpost')
  await mkdir(dir, { recursive: true })
  return dir
}

async function pickPath(event: IpcMainInvokeEvent, options: OpenDialogOptions): Promise<string | null> {
  const win = BrowserWindow.fromWebContents(event.sender)
  const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
  return result.canceled ? null : (result.filePaths[0] ?? null)
}

// Every handler lives here. Channel names match ScratchpostAPI method names.
export function registerIpc(): void {
  const history = new HistoryStore(join(app.getPath('userData'), 'history'))
  setTimeout(() => void history.pruneAll().catch(() => {}), 10_000)

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

  ipcMain.handle('createWelcomeNote', async (_event, onlyIfEmpty: unknown) =>
    createWelcomeNote(await getScratchDir(), onlyIfEmpty === true, welcomeText)
  )

  ipcMain.handle('renameFile', async (_event, from: unknown, to: unknown) => {
    assertString(from, 'from')
    assertString(to, 'to')
    await renameNote(from, to)
    await history.move(from, to).catch(() => {})
  })

  // The scratch folder comes from main, never the renderer, so this can only
  // ever delete inside it.
  ipcMain.handle('deleteIfEmpty', async (_event, path: unknown) => {
    assertString(path, 'path')
    return deleteIfEmpty(path, await getScratchDir())
  })

  ipcMain.handle('trashFile', async (_event, path: unknown) => {
    assertString(path, 'path')
    if (!(await isNoteFile(path))) throw new Error('only .md and .txt files can be deleted')
    await shell.trashItem(path)
  })

  ipcMain.handle('archiveFile', async (_event, path: unknown) => {
    assertString(path, 'path')
    if (!(await isNoteFile(path))) throw new Error('only .md and .txt files can be archived')
    const to = await archiveNote(path)
    await history.move(path, to).catch(() => {})
    return to
  })

  ipcMain.handle('unarchiveFile', async (_event, path: unknown) => {
    assertString(path, 'path')
    if (!(await isNoteFile(path))) throw new Error('only .md and .txt files can be moved')
    const to = await unarchiveNote(path)
    await history.move(path, to).catch(() => {})
    return to
  })

  ipcMain.handle('historySnapshot', async (_event, path: unknown, text: unknown) => {
    assertString(path, 'path')
    assertString(text, 'text')
    await history.snapshot(path, text)
  })

  ipcMain.handle('historyList', (_event, path: unknown) => {
    assertString(path, 'path')
    return history.list(path)
  })

  ipcMain.handle('historyRead', (_event, path: unknown, id: unknown) => {
    assertString(path, 'path')
    assertString(id, 'id')
    return history.read(path, id)
  })

  // Labels are plain text inside notes, so this is a folder-wide rewrite; see
  // D44. The renderer flushes its own edits first.
  ipcMain.handle('renameLabel', (_event, folder: unknown, from: unknown, to: unknown) => {
    assertString(folder, 'folder')
    assertString(from, 'from')
    assertString(to, 'to')
    return renameLabelInFolder(folder, from, to)
  })

  ipcMain.handle('showInFolder', (_event, path: unknown) => {
    assertString(path, 'path')
    shell.showItemInFolder(path)
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

  // Dropped files arrive as absolute paths from the preload's pathForFile.
  ipcMain.handle('resolvePaths', (_event, paths: unknown) => {
    if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) {
      throw new TypeError('paths must be an array of strings')
    }
    return classifyPaths(paths, app.getPath('home'))
  })

  // One watcher pair per window, closed with it.
  const watchers = new Map<number, PathWatcher>()
  ipcMain.handle('watch', (event, folder: unknown, files: unknown) => {
    if (folder !== null) assertString(folder, 'folder')
    if (!Array.isArray(files) || !files.every((f) => typeof f === 'string')) {
      throw new TypeError('files must be an array of strings')
    }
    const sender = event.sender
    let watcher = watchers.get(sender.id)
    if (!watcher) {
      const id = sender.id
      const created = new PathWatcher((change) => {
        if (!sender.isDestroyed()) sender.send('watchEvent', change)
      })
      watchers.set(id, created)
      sender.once('destroyed', () => {
        created.close()
        watchers.delete(id)
      })
      watcher = created
    }
    watcher.set(folder, files)
  })

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
