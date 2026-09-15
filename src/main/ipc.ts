import { ipcMain } from 'electron'
import type { FileMeta } from '../preload/api'
import { readTextFile } from './fs/read'
import { writeTextFile } from './fs/write'

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`)
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
}
