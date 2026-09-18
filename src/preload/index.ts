import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { OpenRequest, ScratchpostAPI, WatchEvent } from './api'

const api: ScratchpostAPI = {
  readFile: (path) => ipcRenderer.invoke('readFile', path),
  writeFile: (path, content, meta) => ipcRenderer.invoke('writeFile', path, content, meta),
  getScratchDir: () => ipcRenderer.invoke('getScratchDir'),
  createNote: (scratchDir) => ipcRenderer.invoke('createNote', scratchDir),
  createWelcomeNote: (onlyIfEmpty) => ipcRenderer.invoke('createWelcomeNote', onlyIfEmpty),
  renameFile: (from, to) => ipcRenderer.invoke('renameFile', from, to),
  deleteIfEmpty: (path) => ipcRenderer.invoke('deleteIfEmpty', path),
  trashFile: (path) => ipcRenderer.invoke('trashFile', path),
  archiveFile: (path) => ipcRenderer.invoke('archiveFile', path),
  unarchiveFile: (path) => ipcRenderer.invoke('unarchiveFile', path),
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
  renameLabel: (folder, from, to) => ipcRenderer.invoke('renameLabel', folder, from, to),
  historySnapshot: (path, text) => ipcRenderer.invoke('historySnapshot', path, text),
  historyList: (path) => ipcRenderer.invoke('historyList', path),
  historyRead: (path, id) => ipcRenderer.invoke('historyRead', path, id),
  watch: (folder, files) => ipcRenderer.invoke('watch', folder, files),
  onWatchEvent: (cb) => {
    const listener = (_event: Electron.IpcRendererEvent, change: WatchEvent) => cb(change)
    ipcRenderer.on('watchEvent', listener)
    return () => {
      ipcRenderer.removeListener('watchEvent', listener)
    }
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
