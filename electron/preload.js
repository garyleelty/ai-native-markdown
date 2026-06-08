const { contextBridge, ipcRenderer } = require('electron')

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
