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

  readDirectory: (...args) => fileSystem.readDirectory(...args),
  getAllMarkdownFiles: (...args) => fileSystem.getAllMarkdownFiles(...args),
  readFile: (...args) => fileSystem.readFile(...args),
  readAsset: (...args) => fileSystem.readAsset(...args),
  readFileOrEmpty: (...args) => fileSystem.readFileOrEmpty(...args),
  writeFile: (...args) => fileSystem.writeFile(...args),
  createFile: (...args) => fileSystem.createFile(...args),
  createDirectory: (...args) => fileSystem.createDirectory(...args),
  deletePath: (...args) => fileSystem.deleteFile(...args),
  renamePath: (...args) => fileSystem.renameFile(...args),
  searchFiles: (...args) => fileSystem.searchFiles(...args),
  importFromPicker: (...args) => fileSystem.importFromPicker(...args),
  onDidChange: () => () => {},
}
