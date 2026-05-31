import Dexie, { type Table } from 'dexie'

export interface FileRecord {
  id?: number
  path: string
  name: string
  content: string
  isDirectory: boolean
  parentPath: string
  createdAt: number
  updatedAt: number
  size: number
}

class FileSystemDB extends Dexie {
  files!: Table<FileRecord>

  constructor() {
    super('ai-markdown-fs')
    this.version(1).stores({
      files: '++id, path, parentPath, name, isDirectory'
    })
  }
}

const db = new FileSystemDB()

export const fileSystem = {
  async init() {
    const count = await db.files.count()
    if (count === 0) {
      const now = Date.now()
      await db.files.bulkAdd([
        { path: '/workspace', name: 'workspace', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 },
        { path: '/workspace/README.md', name: 'README.md', content: '# Welcome to AI Markdown\n\nStart writing here!', isDirectory: false, parentPath: '/workspace', createdAt: now, updatedAt: now, size: 0 },
        { path: '/workspace/notes', name: 'notes', content: '', isDirectory: true, parentPath: '/workspace', createdAt: now, updatedAt: now, size: 0 },
      ])
    }
  },

  async readFile(path: string): Promise<string> {
    const record = await db.files.where('path').equals(path).first()
    return record?.content ?? ''
  },

  async writeFile(path: string, content: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
    const now = Date.now()
    const existing = await db.files.where('path').equals(path).first()
    if (existing) {
      await db.files.update(existing.id!, { content, updatedAt: now, size: content.length })
    } else {
      await db.files.add({ path, name, content, isDirectory: false, parentPath, createdAt: now, updatedAt: now, size: content.length })
    }
  },

  async createFile(path: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
    const now = Date.now()
    const existing = await db.files.where('path').equals(path).first()
    if (existing) throw new Error(`File already exists: ${path}`)
    await db.files.add({ path, name, content: '', isDirectory: false, parentPath, createdAt: now, updatedAt: now, size: 0 })
  },

  async createDirectory(path: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = path.substring(0, path.lastIndexOf('/')) || '/'
    const now = Date.now()
    const existing = await db.files.where('path').equals(path).first()
    if (existing) throw new Error(`Directory already exists: ${path}`)
    await db.files.add({ path, name, content: '', isDirectory: true, parentPath, createdAt: now, updatedAt: now, size: 0 })
  },

  async deleteFile(path: string): Promise<void> {
    await db.transaction('rw', db.files, async () => {
      const record = await db.files.where('path').equals(path).first()
      if (!record) return
      const pathsToDelete: string[] = [path]
      if (record.isDirectory) {
        const queue = [path]
        while (queue.length > 0) {
          const current = queue.shift()!
          const children = await db.files.where('parentPath').equals(current).toArray()
          for (const child of children) {
            pathsToDelete.push(child.path)
            if (child.isDirectory) queue.push(child.path)
          }
        }
      }
      for (const p of pathsToDelete) {
        await db.files.where('path').equals(p).delete()
      }
    })
  },

  async renameFile(oldPath: string, newPath: string): Promise<void> {
    await db.transaction('rw', db.files, async () => {
      const record = await db.files.where('path').equals(oldPath).first()
      if (!record) throw new Error(`File not found: ${oldPath}`)
      const newName = newPath.split('/').pop() || ''
      const newParentPath = newPath.substring(0, newPath.lastIndexOf('/')) || '/'
      await db.files.update(record.id!, { path: newPath, name: newName, parentPath: newParentPath, updatedAt: Date.now() })
      if (record.isDirectory) {
        const queue = [oldPath]
        while (queue.length > 0) {
          const current = queue.shift()!
          const children = await db.files.where('parentPath').equals(current).toArray()
          for (const child of children) {
            const childNewPath = newPath + child.path.substring(oldPath.length)
            const childNewName = childNewPath.split('/').pop() || ''
            const childNewParentPath = childNewPath.substring(0, childNewPath.lastIndexOf('/')) || '/'
            await db.files.update(child.id!, { path: childNewPath, name: childNewName, parentPath: childNewParentPath, updatedAt: Date.now() })
            if (child.isDirectory) queue.push(child.path)
          }
        }
      }
    })
  },

  async readDirectory(path: string): Promise<FileRecord[]> {
    return db.files.where('parentPath').equals(path).toArray()
  },

  async searchFiles(query: string, limit = 20): Promise<Array<{ filePath: string; fileName: string; matches: Array<{ lineNumber: number; lineContent: string }> }>> {
    const queryLower = query.toLowerCase()
    const results: Array<{ filePath: string; fileName: string; matches: Array<{ lineNumber: number; lineContent: string }> }> = []

    await db.files
      .filter(f => !f.isDirectory && (f.name.endsWith('.md') || f.name.endsWith('.markdown')))
      .until(() => results.length >= limit)
      .each(file => {
        const lines = file.content.split('\n')
        const matches: Array<{ lineNumber: number; lineContent: string }> = []
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            matches.push({ lineNumber: i + 1, lineContent: lines[i].trim() })
            if (matches.length >= 5) break
          }
        }
        if (matches.length > 0) {
          results.push({ filePath: file.path, fileName: file.name, matches })
        }
      })

    return results
  },

  async getAllMarkdownFiles(): Promise<FileRecord[]> {
    const files = await db.files.toArray()
    return files.filter(f => !f.isDirectory && (f.name.endsWith('.md') || f.name.endsWith('.markdown')))
  },

  async importFromPicker(): Promise<number> {
    if (!('showDirectoryPicker' in window)) {
      return this.importFromFileInput()
    }
    try {
      const dirHandle = await (window as any).showDirectoryPicker()
      let count = 0
      const processHandle = async (handle: any, parentPath: string) => {
        for await (const [name, entry] of handle.entries()) {
          const path = `${parentPath}/${name}`
          if (entry.kind === 'directory') {
            await this.createDirectory(path).catch(() => {})
            await processHandle(entry, path)
          } else if (name.endsWith('.md') || name.endsWith('.markdown')) {
            const file = await entry.getFile()
            const content = await file.text()
            await this.writeFile(path, content)
            count++
          }
        }
      }
      await processHandle(dirHandle, '/workspace')
      return count
    } catch (e: any) {
      if (e.name === 'AbortError') return 0
      throw e
    }
  },

  async importFromFileInput(): Promise<number> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.multiple = true
      input.accept = '.md,.markdown'
      input.onchange = async () => {
        const files = input.files
        if (!files) { resolve(0); return }
        let count = 0
        for (const file of Array.from(files)) {
          const path = `/workspace/${file.name}`
          const content = await file.text()
          await this.writeFile(path, content)
          count++
        }
        resolve(count)
      }
      input.oncancel = () => resolve(0)
      input.click()
    })
  }
}
