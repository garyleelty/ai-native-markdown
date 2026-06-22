import type { SearchResult, VaultBackend, VaultBridge, VaultState } from './types'

function bridge(): VaultBridge {
  if (!window.aiNativeVault) throw new Error('Electron vault bridge is unavailable')
  return window.aiNativeVault
}

export const electronVault: VaultBackend = {
  kind: 'electron-fs',

  async init(): Promise<void> {
    await bridge().getState()
  },

  openDirectory: () => bridge().openDirectory(),
  getState: () => bridge().getState(),
  readDirectory: (path) => bridge().readDirectory(path),
  getAllMarkdownFiles: () => bridge().getAllMarkdownFiles(),
  readFile: (path) => bridge().readFile(path),
  readAsset: (path) => bridge().readAsset(path),

  async readFileOrEmpty(path: string): Promise<string> {
    try {
      return await bridge().readFile(path)
    } catch (e) {
      console.error(`Failed to read file: ${path}`, e)
      return ''
    }
  },

  writeFile: (path, content) => bridge().writeFile(path, content),
  createFile: (path) => bridge().createFile(path),
  createDirectory: (path) => bridge().createDirectory(path),
  deletePath: (path) => bridge().deletePath(path),
  renamePath: (oldPath, newPath) => bridge().renamePath(oldPath, newPath),

  async searchFiles(query: string, limit = 20): Promise<SearchResult[]> {
    const queryLower = query.toLowerCase()
    const files = await bridge().getAllMarkdownFiles()
    const results: SearchResult[] = []

    for (const file of files) {
      const lines = file.content.split('\n')
      const matches: SearchResult['matches'] = []
      for (let i = 0; i < lines.length; i += 1) {
        if (lines[i].toLowerCase().includes(queryLower)) {
          matches.push({ lineNumber: i + 1, lineContent: lines[i].trim() })
          if (matches.length >= 5) break
        }
      }
      if (matches.length > 0) {
        results.push({ filePath: file.path, fileName: file.name, matches })
        if (results.length >= limit) break
      }
    }

    return results
  },

  async importFromPicker(): Promise<number> {
    const state: VaultState | null = await bridge().openDirectory()
    return state?.rootPath ? 1 : 0
  },

  onDidChange(listener) {
    return bridge().onDidChange?.(listener) ?? (() => {})
  },
}
