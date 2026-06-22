const { autoUpdater } = require('electron-updater')
const { BrowserWindow, dialog, app } = require('electron')
const log = require('electron-log')

// Configure logging
autoUpdater.logger = log
autoUpdater.logger.transports.file.level = 'info'

// Disable auto-download — let the user decide
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true

let updateWindow = null
let updateState = { checking: false, available: false, version: '', releaseNotes: '' }

function sendToRenderer(channel, data) {
  const win = BrowserWindow.getAllWindows()[0]
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, data)
  }
}

function setupAutoUpdater() {
  autoUpdater.on('checking-for-update', () => {
    updateState = { checking: true, available: false, version: '', releaseNotes: '' }
    sendToRenderer('update:status', { status: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    updateState = {
      checking: false,
      available: true,
      version: info.version,
      releaseNotes: info.releaseNotes || '',
    }
    sendToRenderer('update:status', {
      status: 'available',
      version: info.version,
      releaseNotes: info.releaseNotes || '',
    })
  })

  autoUpdater.on('update-not-available', () => {
    updateState = { checking: false, available: false, version: '', releaseNotes: '' }
    sendToRenderer('update:status', { status: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendToRenderer('update:status', {
      status: 'downloaded',
      version: info.version,
    })
    // Prompt user to restart
    dialog.showMessageBox({
      type: 'info',
      title: '更新已就绪',
      message: `版本 ${info.version} 已下载完成`,
      detail: '应用需要重启以完成更新。是否现在重启？',
      buttons: ['稍后再说', '立即重启'],
      defaultId: 1,
      cancelId: 0,
    }).then(({ response }) => {
      if (response === 1) {
        autoUpdater.quitAndInstall()
      }
    })
  })

  autoUpdater.on('error', (err) => {
    log.error('Auto-updater error:', err)
    updateState = { checking: false, available: false, version: '', releaseNotes: '' }
    sendToRenderer('update:status', { status: 'error', error: err.message })
  })

  // IPC handlers
  const { ipcMain } = require('electron')

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      return { ok: true, updateAvailable: result?.updateInfo?.version !== app.getVersion() }
    } catch (err) {
      log.error('Manual update check failed:', err)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate()
      return { ok: true }
    } catch (err) {
      log.error('Update download failed:', err)
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('update:install', () => {
    autoUpdater.quitAndInstall()
  })

  ipcMain.handle('update:getState', () => {
    return updateState
  })

  // Check for updates after a short delay (don't block startup)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('Background update check failed:', err)
    })
  }, 30000) // 30 seconds after launch
}

module.exports = { setupAutoUpdater }
