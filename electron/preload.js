const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aiNativeUpdater', {
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getState: () => ipcRenderer.invoke('update:getState'),
  onStatus: (listener) => {
    const wrapped = (_event, data) => listener(data)
    ipcRenderer.on('update:status', wrapped)
    return () => ipcRenderer.removeListener('update:status', wrapped)
  },
  onProgress: (listener) => {
    const wrapped = (_event, data) => listener(data)
    ipcRenderer.on('update:progress', wrapped)
    return () => ipcRenderer.removeListener('update:progress', wrapped)
  },
})

contextBridge.exposeInMainWorld('aiNativeVault', {
  openDirectory: () => ipcRenderer.invoke('vault:openDirectory'),
  getState: () => ipcRenderer.invoke('vault:getState'),
  readDirectory: (path) => ipcRenderer.invoke('vault:readDirectory', path),
  getAllMarkdownFiles: () => ipcRenderer.invoke('vault:getAllMarkdownFiles'),
  readFile: (path) => ipcRenderer.invoke('vault:readFile', path),
  readAsset: (path) => ipcRenderer.invoke('vault:readAsset', path),
  writeFile: (path, content) => ipcRenderer.invoke('vault:writeFile', path, content),
  createFile: (path) => ipcRenderer.invoke('vault:createFile', path),
  createDirectory: (path) => ipcRenderer.invoke('vault:createDirectory', path),
  deletePath: (path) => ipcRenderer.invoke('vault:deletePath', path),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('vault:renamePath', oldPath, newPath),
  onDidChange: (listener) => {
    const wrapped = (_event, change) => listener(change)
    ipcRenderer.on('vault:changed', wrapped)
    return () => ipcRenderer.removeListener('vault:changed', wrapped)
  },
})
