import { contextBridge } from 'electron'
import type { ScratchpostAPI } from './api'

// Stubs until each method's task lands. Errors lose their class crossing the
// bridge, so the method name goes in the message.
const notImplemented = (name: string) => () =>
  Promise.reject(new Error(`not implemented: ${name}`))

const api: ScratchpostAPI = {
  readFile: notImplemented('readFile'),
  writeFile: notImplemented('writeFile'),
  createNote: notImplemented('createNote'),
  renameFile: notImplemented('renameFile'),
  listFolder: notImplemented('listFolder'),
  searchFolder: notImplemented('searchFolder'),
  pickFolder: notImplemented('pickFolder'),
  pickFile: notImplemented('pickFile'),
  // Synchronous in the interface, so it throws rather than rejects.
  watchFolder: () => {
    throw new Error('not implemented: watchFolder')
  },
  getSession: notImplemented('getSession'),
  setSession: notImplemented('setSession'),
  openExternal: notImplemented('openExternal')
}

contextBridge.exposeInMainWorld('scratchpost', api)
