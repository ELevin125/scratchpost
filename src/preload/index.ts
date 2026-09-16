import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { OpenRequest, ScratchpostAPI } from './api'

const api: ScratchpostAPI = {
  readFile: (path) => ipcRenderer.invoke('readFile', path),
  writeFile: (path, content, meta) => ipcRenderer.invoke('writeFile', path, content, meta),
  getScratchDir: () => ipcRenderer.invoke('getScratchDir'),
  createNote: (scratchDir) => ipcRenderer.invoke('createNote', scratchDir),
  createWelcomeNote: (onlyIfEmpty) => ipcRenderer.invoke('createWelcomeNote', onlyIfEmpty),
  renameFile: (from, to) => ipcRenderer.invoke('renameFile', from, to),
  deleteIfEmpty: (path) => ipcRenderer.invoke('deleteIfEmpty', path),
  trashFile: (path) => ipcRenderer.invoke('trashFile', path),
  showInFolder: (path) => ipcRenderer.invoke('showInFolder', path),
  listFolder: (path) => ipcRenderer.invoke('listFolder', path),
  searchFolder: (path, query) => ipcRenderer.invoke('searchFolder', path, query),
  listTags: (path) => ipcRenderer.invoke('listTags', path),
  pickFolder: () => ipcRenderer.invoke('pickFolder'),
  pickFile: () => ipcRenderer.invoke('pickFile'),
  pathForFile: (file) => webUtils.getPathForFile(file),
  resolvePaths: (paths) => ipcRenderer.invoke('resolvePaths', paths),
  onOpenPaths: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, request: OpenRequest) => cb(request)
    ipcRenderer.on('openPaths', listener)
    ipcRenderer.send('openPathsReady')
    return () => {
      ipcRenderer.removeListener('openPaths', listener)
    }
  },
  // Lands with external change watching in 3.1. Synchronous in the interface,
  // so it throws rather than rejects.
  watchFolder: () => {
    throw new Error('not implemented: watchFolder')
  },
  getSession: () => ipcRenderer.invoke('getSession'),
  setSession: (session) => ipcRenderer.invoke('setSession', session),
  getSettings: () => ipcRenderer.invoke('getSettings'),
  setSettings: (settings) => ipcRenderer.invoke('setSettings', settings),
  openExternal: (url) => ipcRenderer.invoke('openExternal', url),
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
