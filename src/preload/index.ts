import { contextBridge, ipcRenderer } from 'electron'
import type { ScratchpostAPI } from './api'

// Stubs until each method's task lands. Errors lose their class crossing the
// bridge, so the method name goes in the message.
const notImplemented = (name: string) => () =>
  Promise.reject(new Error(`not implemented: ${name}`))

const api: ScratchpostAPI = {
  readFile: (path) => ipcRenderer.invoke('readFile', path),
  writeFile: (path, content, meta) => ipcRenderer.invoke('writeFile', path, content, meta),
  getScratchDir: () => ipcRenderer.invoke('getScratchDir'),
  createNote: (scratchDir) => ipcRenderer.invoke('createNote', scratchDir),
  renameFile: notImplemented('renameFile'),
  listFolder: notImplemented('listFolder'),
  searchFolder: notImplemented('searchFolder'),
  pickFolder: notImplemented('pickFolder'),
  pickFile: () => ipcRenderer.invoke('pickFile'),
  // Synchronous in the interface, so it throws rather than rejects.
  watchFolder: () => {
    throw new Error('not implemented: watchFolder')
  },
  getSession: () => ipcRenderer.invoke('getSession'),
  setSession: (session) => ipcRenderer.invoke('setSession', session),
  openExternal: notImplemented('openExternal'),
  onBeforeClose: (flush) => {
    const listener = async () => {
      try {
        await flush()
      } finally {
        ipcRenderer.send('closeReady')
      }
    }
    ipcRenderer.on('beforeClose', listener)
    return () => {
      ipcRenderer.removeListener('beforeClose', listener)
    }
  }
}

contextBridge.exposeInMainWorld('scratchpost', api)
