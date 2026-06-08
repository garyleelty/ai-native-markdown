const { dialog, ipcMain } = require('electron')
const fsSync = require('fs')
const fs = require('fs/promises')
const path = require('path')

const markdownExtensions = new Set(['.md', '.markdown'])
const assetMimeTypes = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.svg', 'image/svg+xml'],
  ['.bmp', 'image/bmp'],
  ['.avif', 'image/avif'],
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.ogg', 'audio/ogg'],
  ['.m4a', 'audio/mp4'],
  ['.flac', 'audio/flac'],
  ['.mp4', 'video/mp4'],
  ['.webm', 'video/webm'],
  ['.mov', 'video/quicktime'],
  ['.pdf', 'application/pdf'],
])
const WATCH_DEBOUNCE_MS = 120
let vaultRoot = ''
let handlersRegistered = false
let dialogOwnerWindow = null
let vaultWatcher = null
let watchDebounceTimer = null
let pendingWatchEvent = null

function ensureVaultRoot() {
  if (!vaultRoot) throw new Error('Vault is not open')
}

function isMarkdownName(name) {
  return markdownExtensions.has(path.extname(name).toLowerCase())
}

function mimeTypeForPath(filePath) {
  return assetMimeTypes.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream'
}

function toVaultPath(nativePath) {
  ensureVaultRoot()
  const relative = path.relative(vaultRoot, nativePath)
  if (!relative) return '/workspace'
  return `/workspace/${relative.split(path.sep).join('/')}`
}

function toNativePath(vaultPath) {
  ensureVaultRoot()
  const normalized = String(vaultPath || '').replace(/\\/g, '/')
  const relative = normalized.replace(/^\/workspace\/?/, '')
  const nativePath = path.resolve(vaultRoot, relative)
  if (nativePath !== vaultRoot && !nativePath.startsWith(`${vaultRoot}${path.sep}`)) {
    throw new Error('Path escapes the active vault')
  }
  return nativePath
}

function closeVaultWatcher() {
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer)
    watchDebounceTimer = null
  }
  pendingWatchEvent = null
  if (vaultWatcher) {
    vaultWatcher.close()
    vaultWatcher = null
  }
}

function currentOwnerWindow() {
  return dialogOwnerWindow && !dialogOwnerWindow.isDestroyed()
    ? dialogOwnerWindow
    : null
}

function safeVaultPathForNativePath(nativePath) {
  if (!vaultRoot) return '/workspace'
  const resolvedPath = path.resolve(nativePath)
  if (resolvedPath !== vaultRoot && !resolvedPath.startsWith(`${vaultRoot}${path.sep}`)) {
    return '/workspace'
  }
  return toVaultPath(resolvedPath)
}

function emitVaultChange(change) {
  const ownerWindow = currentOwnerWindow()
  if (!ownerWindow || !vaultRoot) return
  ownerWindow.webContents.send('vault:changed', {
    rootPath: '/workspace',
    path: change.path || '/workspace',
    reason: change.reason || 'change',
    at: Date.now(),
  })
}

function queueVaultChange(reason, nativePath) {
  if (!vaultRoot) return
  pendingWatchEvent = {
    path: safeVaultPathForNativePath(nativePath || vaultRoot),
    reason,
  }
  if (watchDebounceTimer) clearTimeout(watchDebounceTimer)
  watchDebounceTimer = setTimeout(() => {
    const change = pendingWatchEvent || { path: '/workspace', reason: 'change' }
    pendingWatchEvent = null
    watchDebounceTimer = null
    emitVaultChange(change)
  }, WATCH_DEBOUNCE_MS)
}

function isIgnoredWatchFilename(filename) {
  if (!filename) return false
  return String(filename)
    .split(/[\\/]/)
    .some(part => part.startsWith('.'))
}

function watchVaultRoot(options) {
  return fsSync.watch(vaultRoot, options, (eventType, filename) => {
    if (isIgnoredWatchFilename(filename)) return
    const nativePath = filename ? path.resolve(vaultRoot, String(filename)) : vaultRoot
    queueVaultChange(eventType || 'change', nativePath)
  })
}

function startVaultWatcher() {
  closeVaultWatcher()
  if (!vaultRoot) return
  try {
    vaultWatcher = watchVaultRoot({ recursive: true })
  } catch {
    vaultWatcher = watchVaultRoot({})
  }
  vaultWatcher.on('error', () => {
    closeVaultWatcher()
  })
}

async function statToRecord(nativePath, includeContent = false) {
  const stat = await fs.stat(nativePath)
  const isDirectory = stat.isDirectory()
  const name = path.basename(nativePath)
  const record = {
    path: toVaultPath(nativePath),
    name,
    content: '',
    isDirectory,
    parentPath: nativePath === vaultRoot ? '/' : toVaultPath(path.dirname(nativePath)),
    createdAt: stat.birthtimeMs,
    updatedAt: stat.mtimeMs,
    size: stat.size,
  }
  if (includeContent && !isDirectory) {
    record.content = await fs.readFile(nativePath, 'utf8')
  }
  return record
}

async function readDirectory(vaultPath) {
  const nativePath = vaultPath === '/' ? vaultRoot : toNativePath(vaultPath)
  const entries = await fs.readdir(nativePath, { withFileTypes: true })
  const records = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (!entry.isDirectory() && !isMarkdownName(entry.name)) continue
    records.push(await statToRecord(path.join(nativePath, entry.name)))
  }
  return records
}

async function collectMarkdownFiles(nativeDir, records = []) {
  const entries = await fs.readdir(nativeDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = path.join(nativeDir, entry.name)
    if (entry.isDirectory()) {
      await collectMarkdownFiles(entryPath, records)
    } else if (isMarkdownName(entry.name)) {
      records.push(await statToRecord(entryPath, true))
    }
  }
  return records
}

async function collectPathTree(nativePath, records = []) {
  const record = await statToRecord(nativePath)
  records.push(record)
  if (!record.isDirectory) return records
  const entries = await fs.readdir(nativePath, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    await collectPathTree(path.join(nativePath, entry.name), records)
  }
  return records
}

function mapRenamedPath(oldPath, oldRoot, newRoot) {
  if (oldPath === oldRoot) return newRoot
  return `${newRoot}${oldPath.slice(oldRoot.length)}`
}

function registerVaultHandlers(browserWindow) {
  dialogOwnerWindow = browserWindow
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.handle('vault:openDirectory', async () => {
    const options = {
      properties: ['openDirectory'],
      title: 'Open Markdown Vault',
    }
    const ownerWindow = dialogOwnerWindow && !dialogOwnerWindow.isDestroyed()
      ? dialogOwnerWindow
      : undefined
    const result = ownerWindow
      ? await dialog.showOpenDialog(ownerWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    vaultRoot = path.resolve(result.filePaths[0])
    startVaultWatcher()
    return { rootPath: '/workspace', nativePath: vaultRoot }
  })

  ipcMain.handle('vault:getState', async () => ({
    rootPath: vaultRoot ? '/workspace' : '',
    nativePath: vaultRoot,
  }))

  ipcMain.handle('vault:readDirectory', async (_event, vaultPath) => readDirectory(vaultPath))
  ipcMain.handle('vault:getAllMarkdownFiles', async () => {
    ensureVaultRoot()
    return collectMarkdownFiles(vaultRoot)
  })
  ipcMain.handle('vault:readFile', async (_event, vaultPath) => fs.readFile(toNativePath(vaultPath), 'utf8'))
  ipcMain.handle('vault:readAsset', async (_event, vaultPath) => {
    const nativePath = toNativePath(vaultPath)
    const stat = await fs.stat(nativePath)
    if (stat.isDirectory()) throw new Error('Path is a directory')
    const content = await fs.readFile(nativePath)
    return `data:${mimeTypeForPath(nativePath)};base64,${content.toString('base64')}`
  })
  ipcMain.handle('vault:writeFile', async (_event, vaultPath, content) => {
    const nativePath = toNativePath(vaultPath)
    await fs.mkdir(path.dirname(nativePath), { recursive: true })
    await fs.writeFile(nativePath, content, 'utf8')
  })
  ipcMain.handle('vault:createFile', async (_event, vaultPath) => {
    const nativePath = toNativePath(vaultPath)
    await fs.writeFile(nativePath, '', { flag: 'wx' })
  })
  ipcMain.handle('vault:createDirectory', async (_event, vaultPath) => {
    const nativePath = toNativePath(vaultPath)
    await fs.mkdir(nativePath, { recursive: false })
  })
  ipcMain.handle('vault:deletePath', async (_event, vaultPath) => {
    const nativePath = toNativePath(vaultPath)
    await fs.rm(nativePath, { recursive: true, force: true })
  })
  ipcMain.handle('vault:renamePath', async (_event, oldPath, newPath) => {
    const oldNativePath = toNativePath(oldPath)
    const newNativePath = toNativePath(newPath)
    const recordsBeforeRename = await collectPathTree(oldNativePath)
    await fs.rename(oldNativePath, newNativePath)
    return {
      renamedPaths: recordsBeforeRename.map(record => ({
        oldPath: record.path,
        newPath: mapRenamedPath(record.path, oldPath, newPath),
        isDirectory: record.isDirectory,
      })),
      updatedLinkPaths: [],
    }
  })
}

module.exports = { registerVaultHandlers }
