import type { FileRecord, RenameFileResult } from '@/services/fileSystem'

export interface VaultState {
  rootPath: string
  nativePath?: string
}

export interface VaultChangeEvent {
  rootPath: string
  path?: string
  reason?: string
  at?: number
}

export interface SearchMatch {
  lineNumber?: number
  lineContent: string
}

export interface SearchResult {
  filePath: string
  fileName: string
  matches: SearchMatch[]
}

export interface VaultBridge {
  openDirectory(): Promise<VaultState | null>
  getState(): Promise<VaultState>
  readDirectory(path: string): Promise<FileRecord[]>
  getAllMarkdownFiles(): Promise<FileRecord[]>
  readFile(path: string): Promise<string>
  readAsset(path: string): Promise<string>
  writeFile(path: string, content: string): Promise<void>
  createFile(path: string): Promise<void>
  createDirectory(path: string): Promise<void>
  deletePath(path: string): Promise<void>
  renamePath(oldPath: string, newPath: string): Promise<RenameFileResult>
  onDidChange?(listener: (event: VaultChangeEvent) => void): () => void
}

export interface VaultBackend extends VaultBridge {
  kind: 'indexeddb' | 'electron-fs'
  init(): Promise<void>
  readFileOrEmpty(path: string): Promise<string>
  searchFiles(query: string, limit?: number): Promise<SearchResult[]>
  importFromPicker(): Promise<number>
  onDidChange(listener: (event: VaultChangeEvent) => void): () => void
}

export interface VaultService extends VaultBackend {
  isElectronBridgeAvailable(): boolean
  useIndexedDbWorkspace(): Promise<void>
  refreshFromDisk(): Promise<void>
}
