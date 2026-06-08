import { fileSystem } from '@/services/fileSystem'
import type { VaultBackend, VaultState } from './types'

export const indexedDbVault: VaultBackend = {
  kind: 'indexeddb',

  async init(): Promise<void> {
    await fileSystem.init()
  },

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
  readAsset: fileSystem.readAsset.bind(fileSystem),
  readFileOrEmpty: fileSystem.readFileOrEmpty.bind(fileSystem),
  writeFile: fileSystem.writeFile.bind(fileSystem),
  createFile: fileSystem.createFile.bind(fileSystem),
  createDirectory: fileSystem.createDirectory.bind(fileSystem),
  deletePath: fileSystem.deleteFile.bind(fileSystem),
  renamePath: fileSystem.renameFile.bind(fileSystem),
  searchFiles: fileSystem.searchFiles.bind(fileSystem),
  importFromPicker: fileSystem.importFromPicker.bind(fileSystem),
  onDidChange: () => () => {},
}
