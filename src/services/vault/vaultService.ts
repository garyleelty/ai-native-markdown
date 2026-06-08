import { ragService } from '@/services/rag'
import { versionHistory } from '@/services/versionHistory'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { updateWikiLinksForRename } from '@/utils/wikiLinks'
import { isMarkdownPath } from '@/utils/pathHelpers'
import { electronVault } from './electronVault'
import { indexedDbVault } from './indexedDbVault'
import type { FileRecord, RenameFileResult } from '@/services/fileSystem'
import type { SearchResult, VaultBackend, VaultChangeEvent, VaultService, VaultState } from './types'

let activeBackendKind: VaultBackend['kind'] = 'indexeddb'
let electronKnowledgeQueue: Promise<void> = Promise.resolve()
const vaultChangeListeners = new Set<(event: VaultChangeEvent) => void>()
let unsubscribeElectronChanges: (() => void) | null = null


function isElectronBridgeAvailable(): boolean {
  return typeof window !== 'undefined' && Boolean(window.aiNativeVault)
}

function activeBackend(): VaultBackend {
  return activeBackendKind === 'electron-fs' && isElectronBridgeAvailable()
    ? electronVault
    : indexedDbVault
}

function ensureElectronChangeSubscription(): void {
  if (unsubscribeElectronChanges || !isElectronBridgeAvailable() || vaultChangeListeners.size === 0) return
  unsubscribeElectronChanges = electronVault.onDidChange((event) => {
    for (const listener of vaultChangeListeners) listener(event)
  })
}

function releaseElectronChangeSubscriptionIfIdle(): void {
  if (vaultChangeListeners.size > 0 || !unsubscribeElectronChanges) return
  unsubscribeElectronChanges()
  unsubscribeElectronChanges = null
}

function getSourcePathBeforeRename(path: string, oldPath: string, newPath: string, isDirectory: boolean): string {
  if (path === newPath) return oldPath
  if (isDirectory && path.startsWith(`${newPath}/`)) {
    return `${oldPath}${path.slice(newPath.length)}`
  }
  return path
}

async function rebuildElectronKnowledgeIndex(): Promise<void> {
  if (activeBackendKind !== 'electron-fs') return
  await queueElectronKnowledgeUpdate(async () => {
    const files = await electronVault.getAllMarkdownFiles()
    await knowledgeIndex.rebuild(files.map(file => ({ path: file.path, content: file.content })))
  })
}

function queueElectronKnowledgeUpdate(task: () => Promise<void>): Promise<void> {
  const run = electronKnowledgeQueue.catch(() => {}).then(task)
  electronKnowledgeQueue = run.catch(() => {})
  return run
}

async function updateElectronWikiLinksForRename(
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
  markdownPathsBeforeRename: string[]
): Promise<string[]> {
  const files = await electronVault.getAllMarkdownFiles()
  const updatedPaths: string[] = []

  for (const file of files) {
    const updatedContent = updateWikiLinksForRename(file.content, {
      sourcePath: file.path,
      sourcePathBeforeRename: getSourcePathBeforeRename(file.path, oldPath, newPath, isDirectory),
      oldPath,
      newPath,
      isDirectory,
      markdownPathsBeforeRename,
    })
    if (updatedContent === file.content) continue
    await electronVault.writeFile(file.path, updatedContent)
    updatedPaths.push(file.path)
  }

  return updatedPaths
}

async function useElectronBackendIfOpen(): Promise<boolean> {
  if (!isElectronBridgeAvailable()) return false
  const state = await electronVault.getState()
  if (!state.rootPath) return false
  activeBackendKind = 'electron-fs'
  ensureElectronChangeSubscription()
  await rebuildElectronKnowledgeIndex()
  return true
}

export const vaultService: VaultService = {
  get kind() {
    return activeBackend().kind
  },

  isElectronBridgeAvailable,

  async init(): Promise<void> {
    await indexedDbVault.init()
    try {
      await useElectronBackendIfOpen()
      ensureElectronChangeSubscription()
    } catch {
      activeBackendKind = 'indexeddb'
    }
  },

  async useIndexedDbWorkspace(): Promise<void> {
    activeBackendKind = 'indexeddb'
    await indexedDbVault.init()
  },

  async refreshFromDisk(): Promise<void> {
    if (activeBackendKind === 'electron-fs' && isElectronBridgeAvailable()) {
      await rebuildElectronKnowledgeIndex()
    }
  },

  onDidChange(listener: (event: VaultChangeEvent) => void): () => void {
    vaultChangeListeners.add(listener)
    ensureElectronChangeSubscription()
    return () => {
      vaultChangeListeners.delete(listener)
      releaseElectronChangeSubscriptionIfIdle()
    }
  },

  async openDirectory(): Promise<VaultState | null> {
    if (!isElectronBridgeAvailable()) return indexedDbVault.openDirectory()
    const state = await electronVault.openDirectory()
    if (!state?.rootPath) return null
    activeBackendKind = 'electron-fs'
    ensureElectronChangeSubscription()
    await rebuildElectronKnowledgeIndex()
    return state
  },

  async importFromPicker(): Promise<number> {
    if (!isElectronBridgeAvailable()) return indexedDbVault.importFromPicker()
    const state = await this.openDirectory()
    if (!state?.rootPath) return 0
    return (await electronVault.getAllMarkdownFiles()).length
  },

  getState(): Promise<VaultState> {
    return activeBackend().getState()
  },

  readDirectory(path: string): Promise<FileRecord[]> {
    return activeBackend().readDirectory(path)
  },

  getAllMarkdownFiles(): Promise<FileRecord[]> {
    return activeBackend().getAllMarkdownFiles()
  },

  readFile(path: string): Promise<string> {
    return activeBackend().readFile(path)
  },

  readAsset(path: string): Promise<string> {
    return activeBackend().readAsset(path)
  },

  readFileOrEmpty(path: string): Promise<string> {
    return activeBackend().readFileOrEmpty(path)
  },

  async writeFile(path: string, content: string): Promise<void> {
    const backend = activeBackend()
    await backend.writeFile(path, content)
    if (backend.kind === 'electron-fs' && isMarkdownPath(path)) {
      await queueElectronKnowledgeUpdate(() => knowledgeIndex.indexFile(path, content))
    }
  },

  async createFile(path: string): Promise<void> {
    const backend = activeBackend()
    await backend.createFile(path)
    if (backend.kind === 'electron-fs' && isMarkdownPath(path)) {
      await queueElectronKnowledgeUpdate(() => knowledgeIndex.indexFile(path, ''))
    }
  },

  createDirectory(path: string): Promise<void> {
    return activeBackend().createDirectory(path)
  },

  async deletePath(path: string): Promise<void> {
    const backend = activeBackend()
    await backend.deletePath(path)
    if (backend.kind === 'electron-fs') {
      await Promise.all([
        queueElectronKnowledgeUpdate(() => knowledgeIndex.removeByPrefix(path)),
        versionHistory.clearByPrefix(path),
        ragService.deleteByPrefix(path),
      ])
    }
  },

  async renamePath(oldPath: string, newPath: string): Promise<RenameFileResult> {
    const backend = activeBackend()
    if (backend.kind !== 'electron-fs') return backend.renamePath(oldPath, newPath)

    const markdownPathsBeforeRename = (await electronVault.getAllMarkdownFiles()).map(file => file.path)
    const result = await electronVault.renamePath(oldPath, newPath)
    const rootRename = result.renamedPaths[0] ?? { oldPath, newPath, isDirectory: false }
    const updatedLinkPaths = await updateElectronWikiLinksForRename(
      oldPath,
      newPath,
      rootRename.isDirectory,
      markdownPathsBeforeRename
    )

    await rebuildElectronKnowledgeIndex()
    const historyRename = rootRename.isDirectory
      ? () => versionHistory.renameByPrefix(oldPath, newPath)
      : () => versionHistory.renameFile(oldPath, newPath)
    const ragRename = rootRename.isDirectory
      ? () => ragService.renameByPrefix(oldPath, newPath)
      : () => ragService.renameDocument(oldPath, newPath)
    await Promise.all([historyRename(), ragRename()])

    return {
      renamedPaths: result.renamedPaths,
      updatedLinkPaths,
    }
  },

  searchFiles(query: string, limit?: number): Promise<SearchResult[]> {
    return activeBackend().searchFiles(query, limit)
  },
}
