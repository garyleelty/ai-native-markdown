# True Filesystem Vault Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a real filesystem Vault backend through Electron while keeping the existing IndexedDB workspace as browser/demo fallback.

**Architecture:** Introduce a `vaultService` facade with the same operational surface as the current `fileSystem` service, then back it with either IndexedDB or Electron IPC. Electron owns native filesystem access through main-process handlers and a preload bridge; Vue components call the facade and remain backend-agnostic.

**Tech Stack:** Electron `ipcMain`/`contextBridge`, Node `fs/promises`, Vue 3, TypeScript, Dexie fallback, Playwright E2E.

---

## Scope

This plan covers only the real filesystem Vault foundation. It does not implement cloud sync, plugin marketplace, Canvas, semantic RAG, or AI Agent workflows.

## File Structure

- Create: `electron/vaultHandlers.js` — native filesystem handlers, path confinement, directory walking, and search.
- Create: `electron/preload.js` — safe renderer bridge exposed as `window.aiNativeVault`.
- Modify: `electron/main.js` — register preload and vault IPC handlers.
- Create: `src/services/vault/types.ts` — shared frontend vault types.
- Create: `src/services/vault/indexedDbVault.ts` — wrapper around the existing IndexedDB `fileSystem`.
- Create: `src/services/vault/electronVault.ts` — frontend adapter for `window.aiNativeVault`.
- Create: `src/services/vault/vaultService.ts` — backend selection and public facade.
- Create: `src/services/vault/index.ts` — exports.
- Modify: `src/App.vue` — use `vaultService` for app-level file reads/writes and markdown path refresh.
- Modify: `src/components/sidebar/FileExplorer.vue` — use `vaultService` for tree operations and open-folder flow.
- Modify: `src/composables/useFileOperations.ts` — use `vaultService`.
- Modify: `src/services/knowledgeIndex.ts` — read backlink/mention content through `vaultService`.
- Modify: `src/services/embedResolver.ts` — resolve embedded files through `vaultService`.
- Create: `e2e/true-filesystem-vault.spec.ts` — browser-safe mock tests for the Electron bridge facade.
- Modify: `docs/current-architecture.md` — document the new backend model.
- Modify: `README.md` — update local-first and development notes.

## Task 1: Add Electron Vault IPC Handlers

**Files:**
- Create: `electron/vaultHandlers.js`
- Modify: `electron/main.js`

- [ ] **Step 1: Create native handler module**

Create `electron/vaultHandlers.js`:

```js
const { dialog, ipcMain } = require('electron')
const fs = require('fs/promises')
const path = require('path')

const markdownExtensions = new Set(['.md', '.markdown'])
let vaultRoot = ''

function toVaultPath(nativePath) {
  if (!vaultRoot) return '/'
  const relative = path.relative(vaultRoot, nativePath)
  if (!relative) return '/workspace'
  return `/workspace/${relative.split(path.sep).join('/')}`
}

function toNativePath(vaultPath) {
  if (!vaultRoot) throw new Error('Vault is not open')
  const normalized = String(vaultPath || '').replace(/\\/g, '/')
  const relative = normalized.replace(/^\/workspace\/?/, '')
  const nativePath = path.resolve(vaultRoot, relative)
  if (nativePath !== vaultRoot && !nativePath.startsWith(`${vaultRoot}${path.sep}`)) {
    throw new Error('Path escapes the active vault')
  }
  return nativePath
}

async function statToRecord(nativePath) {
  const stat = await fs.stat(nativePath)
  const isDirectory = stat.isDirectory()
  const name = path.basename(nativePath)
  return {
    path: toVaultPath(nativePath),
    name,
    content: '',
    isDirectory,
    parentPath: nativePath === vaultRoot ? '/' : toVaultPath(path.dirname(nativePath)),
    createdAt: stat.birthtimeMs,
    updatedAt: stat.mtimeMs,
    size: stat.size,
  }
}

async function readDirectory(vaultPath) {
  const nativePath = vaultPath === '/' ? vaultRoot : toNativePath(vaultPath)
  const entries = await fs.readdir(nativePath, { withFileTypes: true })
  const records = []
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = path.join(nativePath, entry.name)
    if (!entry.isDirectory() && !markdownExtensions.has(path.extname(entry.name).toLowerCase())) continue
    records.push(await statToRecord(entryPath))
  }
  return records
}

async function walkMarkdown(nativeDir, records = []) {
  const entries = await fs.readdir(nativeDir, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const entryPath = path.join(nativeDir, entry.name)
    if (entry.isDirectory()) {
      await walkMarkdown(entryPath, records)
    } else if (markdownExtensions.has(path.extname(entry.name).toLowerCase())) {
      const record = await statToRecord(entryPath)
      record.content = await fs.readFile(entryPath, 'utf8')
      records.push(record)
    }
  }
  return records
}

function registerVaultHandlers(browserWindow) {
  ipcMain.handle('vault:openDirectory', async () => {
    const result = await dialog.showOpenDialog(browserWindow, {
      properties: ['openDirectory'],
      title: 'Open Markdown Vault',
    })
    if (result.canceled || result.filePaths.length === 0) return null
    vaultRoot = path.resolve(result.filePaths[0])
    return { rootPath: '/workspace', nativePath: vaultRoot }
  })

  ipcMain.handle('vault:getState', async () => ({
    rootPath: vaultRoot ? '/workspace' : '',
    nativePath: vaultRoot,
  }))

  ipcMain.handle('vault:readDirectory', async (_event, vaultPath) => readDirectory(vaultPath))
  ipcMain.handle('vault:getAllMarkdownFiles', async () => walkMarkdown(vaultRoot))
  ipcMain.handle('vault:readFile', async (_event, vaultPath) => fs.readFile(toNativePath(vaultPath), 'utf8'))
  ipcMain.handle('vault:writeFile', async (_event, vaultPath, content) => fs.writeFile(toNativePath(vaultPath), content, 'utf8'))
  ipcMain.handle('vault:createFile', async (_event, vaultPath) => fs.writeFile(toNativePath(vaultPath), '', { flag: 'wx' }))
  ipcMain.handle('vault:createDirectory', async (_event, vaultPath) => fs.mkdir(toNativePath(vaultPath), { recursive: false }))
  ipcMain.handle('vault:deletePath', async (_event, vaultPath) => fs.rm(toNativePath(vaultPath), { recursive: true, force: true }))
  ipcMain.handle('vault:renamePath', async (_event, oldPath, newPath) => {
    await fs.rename(toNativePath(oldPath), toNativePath(newPath))
    return { renamedPaths: [{ oldPath, newPath, isDirectory: false }], updatedLinkPaths: [] }
  })
}

module.exports = { registerVaultHandlers }
```

- [ ] **Step 2: Register preload and handlers**

Modify `electron/main.js`:

```js
const { app, BrowserWindow } = require('electron')
const path = require('path')
const { registerVaultHandlers } = require('./vaultHandlers')
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
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  registerVaultHandlers(win)
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (isDev) {
    win.loadURL('http://localhost:1420')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}
```

- [ ] **Step 3: Run Electron smoke build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add electron/main.js electron/vaultHandlers.js
git commit -m "feat: add Electron filesystem vault handlers"
```

## Task 2: Add Preload Bridge and Frontend Types

**Files:**
- Create: `electron/preload.js`
- Create: `src/services/vault/types.ts`
- Modify: `env.d.ts`

- [ ] **Step 1: Add preload bridge**

Create `electron/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('aiNativeVault', {
  openDirectory: () => ipcRenderer.invoke('vault:openDirectory'),
  getState: () => ipcRenderer.invoke('vault:getState'),
  readDirectory: (path) => ipcRenderer.invoke('vault:readDirectory', path),
  getAllMarkdownFiles: () => ipcRenderer.invoke('vault:getAllMarkdownFiles'),
  readFile: (path) => ipcRenderer.invoke('vault:readFile', path),
  writeFile: (path, content) => ipcRenderer.invoke('vault:writeFile', path, content),
  createFile: (path) => ipcRenderer.invoke('vault:createFile', path),
  createDirectory: (path) => ipcRenderer.invoke('vault:createDirectory', path),
  deletePath: (path) => ipcRenderer.invoke('vault:deletePath', path),
  renamePath: (oldPath, newPath) => ipcRenderer.invoke('vault:renamePath', oldPath, newPath),
})
```

- [ ] **Step 2: Add frontend vault types**

Create `src/services/vault/types.ts`:

```ts
import type { FileRecord, RenameFileResult } from '@/services/fileSystem'

export interface VaultState {
  rootPath: string
  nativePath?: string
}

export interface VaultBridge {
  openDirectory(): Promise<VaultState | null>
  getState(): Promise<VaultState>
  readDirectory(path: string): Promise<FileRecord[]>
  getAllMarkdownFiles(): Promise<FileRecord[]>
  readFile(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string): Promise<void>
  createDirectory(path: string): Promise<void>
  deletePath(path: string): Promise<void>
  renamePath(oldPath: string, newPath: string): Promise<RenameFileResult>
}

export interface VaultBackend extends VaultBridge {
  kind: 'indexeddb' | 'electron-fs'
  readFileOrEmpty(path: string): Promise<string>
  searchFiles(query: string, limit?: number): Promise<Array<{ filePath: string; fileName: string; matches: Array<{ lineNumber: number; lineContent: string }> }>>
  importFromPicker(): Promise<number>
}
```

- [ ] **Step 3: Declare window bridge**

Append to `env.d.ts`:

```ts
import type { VaultBridge } from './src/services/vault/types'

declare global {
  interface Window {
    aiNativeVault?: VaultBridge
  }
}

export {}
```

- [ ] **Step 4: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add electron/preload.js env.d.ts src/services/vault/types.ts
git commit -m "feat: expose filesystem vault bridge"
```

## Task 3: Add Frontend Vault Facade

**Files:**
- Create: `src/services/vault/indexedDbVault.ts`
- Create: `src/services/vault/electronVault.ts`
- Create: `src/services/vault/vaultService.ts`
- Create: `src/services/vault/index.ts`

- [ ] **Step 1: Add IndexedDB fallback backend**

Create `src/services/vault/indexedDbVault.ts`:

```ts
import { fileSystem } from '@/services/fileSystem'
import type { VaultBackend, VaultState } from './types'

export const indexedDbVault: VaultBackend = {
  kind: 'indexeddb',
  async openDirectory(): Promise<VaultState | null> {
    const count = await fileSystem.importFromPicker()
    return count >= 0 ? { rootPath: '/workspace' } : null
  },
  async getState(): Promise<VaultState> {
    return { rootPath: '/workspace' }
  },
  readDirectory: fileSystem.readDirectory.bind(fileSystem),
  getAllMarkdownFiles: fileSystem.getAllMarkdownFiles.bind(fileSystem),
  readFile: fileSystem.readFile.bind(fileSystem),
  readFileOrEmpty: fileSystem.readFileOrEmpty.bind(fileSystem),
  writeFile: fileSystem.writeFile.bind(fileSystem),
  createFile: fileSystem.createFile.bind(fileSystem),
  createDirectory: fileSystem.createDirectory.bind(fileSystem),
  deletePath: fileSystem.deleteFile.bind(fileSystem),
  renamePath: fileSystem.renameFile.bind(fileSystem),
  searchFiles: fileSystem.searchFiles.bind(fileSystem),
  importFromPicker: fileSystem.importFromPicker.bind(fileSystem),
}
```

- [ ] **Step 2: Add Electron backend**

Create `src/services/vault/electronVault.ts`:

```ts
import type { VaultBackend, VaultState } from './types'

function bridge() {
  if (!window.aiNativeVault) throw new Error('Electron vault bridge is unavailable')
  return window.aiNativeVault
}

export const electronVault: VaultBackend = {
  kind: 'electron-fs',
  openDirectory: () => bridge().openDirectory(),
  getState: () => bridge().getState(),
  readDirectory: (path) => bridge().readDirectory(path),
  getAllMarkdownFiles: () => bridge().getAllMarkdownFiles(),
  readFile: (path) => bridge().readFile(path),
  async readFileOrEmpty(path: string): Promise<string> {
    try {
      return await bridge().readFile(path)
    } catch {
      return ''
    }
  },
  writeFile: (path, content) => bridge().writeFile(path, content),
  createFile: (path) => bridge().createFile(path),
  createDirectory: (path) => bridge().createDirectory(path),
  deletePath: (path) => bridge().deletePath(path),
  renamePath: (oldPath, newPath) => bridge().renamePath(oldPath, newPath),
  async searchFiles(query: string, limit = 20) {
    const queryLower = query.toLowerCase()
    const files = await bridge().getAllMarkdownFiles()
    const results = []
    for (const file of files) {
      const lines = file.content.split('\n')
      const matches = []
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          matches.push({ lineNumber: i + 1, lineContent: lines[i].trim() })
          if (matches.length >= 5) break
        }
      }
      if (matches.length > 0) results.push({ filePath: file.path, fileName: file.name, matches })
      if (results.length >= limit) break
    }
    return results
  },
  async importFromPicker(): Promise<number> {
    const state: VaultState | null = await bridge().openDirectory()
    return state?.rootPath ? 1 : 0
  },
}
```

- [ ] **Step 3: Add backend selector**

Create `src/services/vault/vaultService.ts`:

```ts
import { indexedDbVault } from './indexedDbVault'
import { electronVault } from './electronVault'
import type { VaultBackend } from './types'

function selectBackend(): VaultBackend {
  return typeof window !== 'undefined' && window.aiNativeVault ? electronVault : indexedDbVault
}

export const vaultService: VaultBackend = new Proxy(indexedDbVault, {
  get(_target, property: keyof VaultBackend) {
    const backend = selectBackend()
    return backend[property]
  },
}) as VaultBackend
```

- [ ] **Step 4: Add exports**

Create `src/services/vault/index.ts`:

```ts
export { vaultService } from './vaultService'
export type { VaultBackend, VaultBridge, VaultState } from './types'
```

- [ ] **Step 5: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add src/services/vault
git commit -m "feat: add vault service facade"
```

## Task 4: Migrate App File Operations to Vault Service

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/sidebar/FileExplorer.vue`
- Modify: `src/composables/useFileOperations.ts`

- [ ] **Step 1: Replace direct file system imports**

In each file, replace:

```ts
import { fileSystem } from '@/services/fileSystem'
```

or relative variants with:

```ts
import { vaultService } from '@/services/vault'
```

- [ ] **Step 2: Replace operation calls**

Use these mechanical replacements:

```txt
fileSystem.readFile -> vaultService.readFile
fileSystem.readFileOrEmpty -> vaultService.readFileOrEmpty
fileSystem.writeFile -> vaultService.writeFile
fileSystem.createFile -> vaultService.createFile
fileSystem.createDirectory -> vaultService.createDirectory
fileSystem.deleteFile -> vaultService.deletePath
fileSystem.renameFile -> vaultService.renamePath
fileSystem.readDirectory -> vaultService.readDirectory
fileSystem.getAllMarkdownFiles -> vaultService.getAllMarkdownFiles
fileSystem.searchFiles -> vaultService.searchFiles
fileSystem.importFromPicker -> vaultService.importFromPicker
```

- [ ] **Step 3: Run targeted E2E**

Run:

```bash
npx playwright test e2e/file-and-editor.spec.ts e2e/sidebar.spec.ts
```

Expected: all selected tests pass with IndexedDB fallback.

- [ ] **Step 4: Commit**

```bash
git add src/App.vue src/components/sidebar/FileExplorer.vue src/composables/useFileOperations.ts
git commit -m "refactor: route app file operations through vault service"
```

## Task 5: Migrate Knowledge and Embed Reads

**Files:**
- Modify: `src/services/knowledgeIndex.ts`
- Modify: `src/services/embedResolver.ts`

- [ ] **Step 1: Update imports**

Replace:

```ts
import { fileSystem } from './fileSystem'
```

with:

```ts
import { vaultService } from '@/services/vault'
```

- [ ] **Step 2: Replace content reads**

Use:

```txt
fileSystem.readFileOrEmpty -> vaultService.readFileOrEmpty
fileSystem.readFile -> vaultService.readFile
```

- [ ] **Step 3: Run knowledge tests**

Run:

```bash
npx playwright test e2e/knowledge-export-history.spec.ts e2e/preview-security.spec.ts
```

Expected: all selected tests pass with IndexedDB fallback.

- [ ] **Step 4: Commit**

```bash
git add src/services/knowledgeIndex.ts src/services/embedResolver.ts
git commit -m "refactor: read knowledge content through vault service"
```

## Task 6: Add E2E Coverage for Electron Bridge Fallback

**Files:**
- Create: `e2e/true-filesystem-vault.spec.ts`

- [ ] **Step 1: Add mock bridge tests**

Create `e2e/true-filesystem-vault.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

test('vault service uses Electron bridge when available', async ({ page }) => {
  await page.addInitScript(() => {
    const files = new Map<string, string>([
      ['/workspace/README.md', '# Real Vault\n\nfrom bridge'],
    ])
    window.aiNativeVault = {
      openDirectory: async () => ({ rootPath: '/workspace', nativePath: '/tmp/mock-vault' }),
      getState: async () => ({ rootPath: '/workspace', nativePath: '/tmp/mock-vault' }),
      readDirectory: async () => [
        { path: '/workspace/README.md', name: 'README.md', content: '', isDirectory: false, parentPath: '/workspace', createdAt: 1, updatedAt: 1, size: 24 },
      ],
      getAllMarkdownFiles: async () => [
        { path: '/workspace/README.md', name: 'README.md', content: files.get('/workspace/README.md') || '', isDirectory: false, parentPath: '/workspace', createdAt: 1, updatedAt: 1, size: 24 },
      ],
      readFile: async (path) => files.get(path) || '',
      writeFile: async (path, content) => { files.set(path, content) },
      createFile: async (path) => { files.set(path, '') },
      createDirectory: async () => undefined,
      deletePath: async (path) => { files.delete(path) },
      renamePath: async (oldPath, newPath) => {
        const content = files.get(oldPath) || ''
        files.delete(oldPath)
        files.set(newPath, content)
        return { renamedPaths: [{ oldPath, newPath, isDirectory: false }], updatedLinkPaths: [] }
      },
    }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.app-container')).toBeVisible()

  const result = await page.evaluate(async () => {
    const { vaultService } = await import('/src/services/vault/index.ts')
    await vaultService.openDirectory()
    const files = await vaultService.readDirectory('/workspace')
    const content = await vaultService.readFile('/workspace/README.md')
    return { kind: vaultService.kind, files, content }
  })

  expect(result.kind).toBe('electron-fs')
  expect(result.files[0].path).toBe('/workspace/README.md')
  expect(result.content).toContain('Real Vault')
})
```

- [ ] **Step 2: Run the new test**

Run:

```bash
npx playwright test e2e/true-filesystem-vault.spec.ts
```

Expected: the new test passes.

- [ ] **Step 3: Run full suite**

Run:

```bash
npm run typecheck
npm run build
npx playwright test
```

Expected: all gates pass.

- [ ] **Step 4: Commit**

```bash
git add e2e/true-filesystem-vault.spec.ts
git commit -m "test: cover filesystem vault bridge facade"
```

## Task 7: Update Documentation

**Files:**
- Modify: `docs/current-architecture.md`
- Modify: `README.md`

- [ ] **Step 1: Update architecture persistence section**

In `docs/current-architecture.md`, replace the persistence model summary with:

```md
The current persistence model has two backends:

- Electron filesystem Vault for desktop users.
- IndexedDB virtual workspace for browser/demo fallback.

The frontend calls `vaultService`; it does not directly decide which backend is active.
```

- [ ] **Step 2: Update README local-first section**

In `README.md`, update the local-first bullets to state:

```md
- 本地优先：桌面端支持真实文件系统 Vault；浏览器/演示环境保留 IndexedDB 虚拟工作区。
- 文件主权：真实 Vault 中的 Markdown 文件可被 Finder、Git、外部同步工具和其他编辑器直接访问。
```

- [ ] **Step 3: Run documentation sanity check**

Run:

```bash
rg -n "Tauri|src-tauri|真实文件系统 Vault|IndexedDB 虚拟工作区" README.md docs/current-architecture.md PROJECT_DOCS.md
```

Expected: current docs describe Electron and filesystem Vault; `PROJECT_DOCS.md` may still contain Tauri only under its historical warning.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/current-architecture.md
git commit -m "docs: document filesystem vault architecture"
```

## Self-Review

- Spec coverage: This plan covers the audit's first recommended priority, true filesystem Vault and file ownership.
- Deferred subsystems: AI Agent, semantic RAG, block embed completion, Properties/Bases, plugin API, sync, Canvas, and mobile remain separate plans.
- Type consistency: The frontend facade uses `VaultBridge`, `VaultBackend`, `VaultState`, `FileRecord`, and `RenameFileResult` consistently.
- Test coverage: The plan preserves existing IndexedDB tests and adds a mocked Electron bridge E2E test.
