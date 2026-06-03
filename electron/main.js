const { app, BrowserWindow } = require('electron')
const path = require('path')
require('./menu')

const isDev = !app.isPackaged

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    resizable: true,
    center: true,
    title: 'AI Native Markdown',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDev) {
    win.loadURL('http://localhost:1420')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
