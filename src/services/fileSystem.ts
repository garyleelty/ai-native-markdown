import Dexie, { type Table } from 'dexie'
import { knowledgeIndex } from './knowledgeIndex'
import { ragService } from './rag'
import { versionHistory } from './versionHistory'
import { updateWikiLinksForRename } from '@/utils/wikiLinks'
import { isMarkdownPath, mimeTypeForPath } from '@/utils/pathHelpers'

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

export interface RenameFileResult {
  renamedPaths: Array<{ oldPath: string; newPath: string; isDirectory: boolean }>
  updatedLinkPaths: string[]
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

const DEMO_README_CONTENT = [
  '# AI Markdown 示例工作区',
  '',
  '这是一套本地优先的知识工作流样稿：把资料采集、结构化写作、实时预览、知识连接和 AI 协作放在同一个 Markdown 工作台里。',
  '',
  '## 今日工作流',
  '',
  '- [x] 将 Markdown、PDF、图片或语音快速放入本地工作区',
  '- [x] 用实时预览检查 Mermaid、KaTeX、任务列表和 Wiki Link',
  '- [x] 在右侧 AI 面板基于当前文档生成摘要、改写或续写',
  '- [x] 通过知识图谱发现笔记之间的关系',
  '- [ ] 导出成 Markdown 或 HTML 交付给团队',
  '',
  '## 知识连接',
  '',
  '这篇笔记连接到 [[notes/Research Map|研究地图]]。在预览中点击链接可以跳转，也可以在知识图谱里查看关系。',
  '',
  '## 工作流图',
  '',
  '```mermaid',
  'flowchart LR',
  '  A[采集资料] --> B[整理笔记]',
  '  B --> C[实时预览]',
  '  C --> D[知识图谱]',
  '  D --> E[AI 协作]',
  '  E --> F[导出交付]',
  '```',
  '',
  '## 数学与结构化内容',
  '',
  '行内公式：$E = mc^2$',
  '',
  '块级公式：',
  '',
  '$$',
  '\\int_0^1 x^2 dx = \\frac{1}{3}',
  '$$',
  '',
  '## 下一步',
  '',
  '1. 用 `[[` 创建或跳转到关联笔记。',
  '2. 拖入 Markdown、PDF 或图片，测试导入、OCR 与预览流程。',
  '3. 打开 AI 面板，让模型基于当前文档生成摘要、改写或续写。',
].join('\n')

const DEMO_RESEARCH_MAP_CONTENT = [
  '# 研究地图',
  '',
  '这是一篇被 README 连接的示例笔记，用来展示 Wiki Link、反向关系和知识图谱。',
  '',
  '## 当前主题',
  '',
  '- 本地优先工作区',
  '- AI 辅助写作',
  '- 多模态资料入口',
  '- Markdown 知识图谱',
  '',
  '## 可继续扩展',
  '',
  '- 把 PDF 摘要拆成原子笔记',
  '- 将语音输入整理成会议纪要',
  '- 用知识图谱检查孤立笔记',
  '',
  '返回 [[README|README]]。',
].join('\n')

async function assertPathAvailable(path: string, oldPath?: string): Promise<void> {
  const existing = await db.files.where('path').equals(path).first()
  if (existing && existing.path !== oldPath) {
    throw new Error(`路径已存在: ${path}`)
  }
}

function getParentPath(path: string): string {
  return path.substring(0, path.lastIndexOf('/')) || '/'
}

async function assertParentDirectoryExists(parentPath: string): Promise<void> {
  if (parentPath === '/') return
  const parent = await db.files.where('path').equals(parentPath).first()
  if (!parent) {
    throw new Error(`父文件夹不存在: ${parentPath}`)
  }
  if (!parent.isDirectory) {
    throw new Error(`父路径不是文件夹: ${parentPath}`)
  }
}

async function syncKnowledgeIndex(operation: () => Promise<void>): Promise<void> {
  try {
    await operation()
  } catch (error) {
    console.warn('Knowledge index sync failed; it will be rebuilt later.', error)
    knowledgeIndex.markStale()
  }
}

async function syncSecondaryStore(name: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation()
  } catch (error) {
    console.warn(`${name} sync failed; file operation was kept.`, error)
  }
}

function isMarkdownFile(record: FileRecord): boolean {
  return !record.isDirectory && isMarkdownPath(record.path)
}

function contentToDataUrl(path: string, content: string): string {
  if (content.startsWith('data:')) return content
  return `data:${mimeTypeForPath(path)};base64,${content}`
}

function getSourcePathBeforeRename(path: string, oldPath: string, newPath: string, isDirectory: boolean): string {
  if (path === newPath) return oldPath
  if (isDirectory && path.startsWith(`${newPath}/`)) {
    return `${oldPath}${path.slice(newPath.length)}`
  }
  return path
}

async function updateSavedWikiLinksForRename(
  oldPath: string,
  newPath: string,
  isDirectory: boolean,
  markdownPathsBeforeRename: string[]
): Promise<string[]> {
  const filesToUpdate: Array<{ id: number; path: string; content: string }> = []

  await db.files.filter(isMarkdownFile).each(file => {
    const updatedContent = updateWikiLinksForRename(file.content, {
      sourcePath: file.path,
      sourcePathBeforeRename: getSourcePathBeforeRename(file.path, oldPath, newPath, isDirectory),
      oldPath,
      newPath,
      isDirectory,
      markdownPathsBeforeRename,
    })
    if (updatedContent !== file.content) {
      filesToUpdate.push({ id: file.id!, path: file.path, content: updatedContent })
    }
  })

  const updatedPaths: string[] = []
  for (const { id, path, content } of filesToUpdate) {
    await db.files.update(id, {
      content,
      updatedAt: Date.now(),
      size: content.length,
    })
    updatedPaths.push(path)
  }

  return updatedPaths
}

// 临时导出 db 用于测试
export const _testDb = db;

export const fileSystem = {
  async init() {
    await db.transaction('rw', db.files, async () => {
      const count = await db.files.count()
      const now = Date.now()
      const workspace = await db.files.where('path').equals('/workspace').first()
      if (!workspace) {
        await db.files.add({ path: '/workspace', name: 'workspace', content: '', isDirectory: true, parentPath: '/', createdAt: now, updatedAt: now, size: 0 })
      } else if (!workspace.isDirectory) {
        await db.files.update(workspace.id!, { content: '', isDirectory: true, parentPath: '/', updatedAt: now, size: 0 })
      }
      if (count === 0) {
        await db.files.bulkAdd([
          { path: '/workspace/README.md', name: 'README.md', content: DEMO_README_CONTENT, isDirectory: false, parentPath: '/workspace', createdAt: now, updatedAt: now, size: DEMO_README_CONTENT.length },
          { path: '/workspace/notes', name: 'notes', content: '', isDirectory: true, parentPath: '/workspace', createdAt: now, updatedAt: now, size: 0 },
          { path: '/workspace/notes/Research Map.md', name: 'Research Map.md', content: DEMO_RESEARCH_MAP_CONTENT, isDirectory: false, parentPath: '/workspace/notes', createdAt: now, updatedAt: now, size: DEMO_RESEARCH_MAP_CONTENT.length },
        ])
        // 索引新创建的示例文件
        await knowledgeIndex.indexFile('/workspace/README.md', DEMO_README_CONTENT, { silent: true })
        await knowledgeIndex.indexFile('/workspace/notes/Research Map.md', DEMO_RESEARCH_MAP_CONTENT, { silent: true })
      }
    })
  },

  async readFile(path: string): Promise<string> {
    const record = await db.files.where('path').equals(path).first()
    if (!record) {
      throw new Error(`文件不存在: ${path}`)
    }
    if (record.isDirectory) {
      throw new Error(`路径是文件夹，不能作为文件读取: ${path}`)
    }
    return record.content
  },

  async readFileOrEmpty(path: string): Promise<string> {
    try {
      return await this.readFile(path)
    } catch {
      return ''
    }
  },

  async readAsset(path: string): Promise<string> {
    return contentToDataUrl(path, await this.readFile(path))
  },

  async writeFile(path: string, content: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = getParentPath(path)
    const now = Date.now()
    const existing = await db.files.where('path').equals(path).first()
    await assertParentDirectoryExists(parentPath)
    if (existing) {
      if (existing.isDirectory) {
        throw new Error(`路径是文件夹，不能作为文件写入: ${path}`)
      }
      await db.files.update(existing.id!, { content, updatedAt: now, size: content.length })
    } else {
      await db.files.add({ path, name, content, isDirectory: false, parentPath, createdAt: now, updatedAt: now, size: content.length })
    }
    await syncKnowledgeIndex(() => (
      isMarkdownPath(path)
        ? knowledgeIndex.indexFile(path, content)
        : knowledgeIndex.removeByPrefix(path)
    ))
  },

  async createFile(path: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = getParentPath(path)
    const now = Date.now()
    await assertParentDirectoryExists(parentPath)
    await assertPathAvailable(path)
    await db.files.add({ path, name, content: '', isDirectory: false, parentPath, createdAt: now, updatedAt: now, size: 0 })
    if (isMarkdownPath(path)) {
      await syncKnowledgeIndex(() => knowledgeIndex.indexFile(path, ''))
    }
  },

  async createDirectory(path: string): Promise<void> {
    const name = path.split('/').pop() || ''
    const parentPath = getParentPath(path)
    const now = Date.now()
    await assertParentDirectoryExists(parentPath)
    await assertPathAvailable(path)
    await db.files.add({ path, name, content: '', isDirectory: true, parentPath, createdAt: now, updatedAt: now, size: 0 })
  },

  async deleteFile(path: string): Promise<void> {
    const removedPaths: string[] = []
    const maxFilesToDelete = 10000
    await db.transaction('rw', db.files, async () => {
      const record = await db.files.where('path').equals(path).first()
      if (!record) return
      const pathsToDelete: string[] = [path]
      if (record.isDirectory) {
        const queue = [path]
        while (queue.length > 0 && pathsToDelete.length < maxFilesToDelete) {
          const current = queue.shift()!
          const children: FileRecord[] = []
          await db.files.where('parentPath').equals(current).each(child => {
            if (pathsToDelete.length + children.length >= maxFilesToDelete) return false
            children.push(child)
          })
          for (const child of children) {
            pathsToDelete.push(child.path)
            if (child.isDirectory) queue.push(child.path)
          }
        }
      }
      for (const p of pathsToDelete) {
        await db.files.where('path').equals(p).delete()
        removedPaths.push(p)
      }
    })
    if (removedPaths.length === 0) return
    await Promise.all([
      syncKnowledgeIndex(() => knowledgeIndex.removeByPrefix(path)),
      syncSecondaryStore('Version history', () => versionHistory.clearByPrefix(path)),
      syncSecondaryStore('RAG index', () => ragService.deleteByPrefix(path)),
    ])
  },

  async renameFile(oldPath: string, newPath: string): Promise<RenameFileResult> {
    const renamedPaths: Array<{ oldPath: string; newPath: string; content: string; isDirectory: boolean }> = []
    const markdownPathsBeforeRename: string[] = []
    const maxFilesToRename = 10000
    await db.files.filter(isMarkdownFile).each(file => {
      markdownPathsBeforeRename.push(file.path)
    })
    await db.transaction('rw', db.files, async () => {
      const record = await db.files.where('path').equals(oldPath).first()
      if (!record) throw new Error(`File not found: ${oldPath}`)
      if (oldPath === newPath) return
      if (record.isDirectory && newPath.startsWith(`${oldPath}/`)) {
        throw new Error('不能将文件夹移动到自身内部')
      }
      const newName = newPath.split('/').pop() || ''
      const newParentPath = getParentPath(newPath)
      await assertParentDirectoryExists(newParentPath)
      await assertPathAvailable(newPath, oldPath)

      if (record.isDirectory) {
        const descendants: FileRecord[] = []
        await db.files
          .filter(file => file.path.startsWith(`${oldPath}/`))
          .until(() => descendants.length >= maxFilesToRename)
          .each(file => {
            descendants.push(file)
          })
        for (const child of descendants) {
          const childNewPath = newPath + child.path.substring(oldPath.length)
          await assertPathAvailable(childNewPath, child.path)
        }
      }

      await db.files.update(record.id!, { path: newPath, name: newName, parentPath: newParentPath, updatedAt: Date.now() })
      renamedPaths.push({ oldPath, newPath, content: record.content, isDirectory: record.isDirectory })
      if (record.isDirectory) {
        const queue = [oldPath]
        while (queue.length > 0 && renamedPaths.length < maxFilesToRename) {
          const current = queue.shift()!
          const children: FileRecord[] = []
          await db.files.where('parentPath').equals(current).each(child => {
            if (renamedPaths.length + children.length >= maxFilesToRename) return false
            children.push(child)
          })
          for (const child of children) {
            const childNewPath = newPath + child.path.substring(oldPath.length)
            const childNewName = childNewPath.split('/').pop() || ''
            const childNewParentPath = childNewPath.substring(0, childNewPath.lastIndexOf('/')) || '/'
            await db.files.update(child.id!, { path: childNewPath, name: childNewName, parentPath: childNewParentPath, updatedAt: Date.now() })
            renamedPaths.push({ oldPath: child.path, newPath: childNewPath, content: child.content, isDirectory: child.isDirectory })
            if (child.isDirectory) queue.push(child.path)
          }
        }
      }
    })
    if (renamedPaths.length === 0) return { renamedPaths: [], updatedLinkPaths: [] }
    const rootRename = renamedPaths[0]
    const updatedLinkPaths = await updateSavedWikiLinksForRename(
      oldPath,
      newPath,
      rootRename.isDirectory,
      markdownPathsBeforeRename
    )
    await syncKnowledgeIndex(async () => {
      const updatedRecords = (await Promise.all(
        updatedLinkPaths.map(path => db.files.where('path').equals(path).first())
      )).filter((file): file is FileRecord => Boolean(file))
      const updatedContentByPath = new Map(updatedRecords.map(file => [file.path, file.content]))
      const renamedMarkdownPaths = new Set(renamedPaths.filter(item => !item.isDirectory && isMarkdownPath(item.newPath)).map(item => item.newPath))
      const removedMarkdownPaths = renamedPaths.filter(item => !item.isDirectory && isMarkdownPath(item.oldPath) && !isMarkdownPath(item.newPath))

      await Promise.all(renamedPaths
        .filter(item => !item.isDirectory && isMarkdownPath(item.newPath))
        .map(item => knowledgeIndex.renameFile(
          item.oldPath,
          item.newPath,
          updatedContentByPath.get(item.newPath) ?? item.content,
          { silent: true }
        )))
      await Promise.all(removedMarkdownPaths.map(item => knowledgeIndex.removeByPrefix(item.oldPath, { silent: true })))
      await Promise.all(updatedRecords
        .filter(item => !renamedMarkdownPaths.has(item.path))
        .map(item => knowledgeIndex.indexFile(item.path, item.content, { silent: true })))
      if (renamedMarkdownPaths.size > 0 || removedMarkdownPaths.length > 0 || updatedRecords.length > 0) knowledgeIndex.notifyChanged()
    })
    const historyRename = rootRename.isDirectory
      ? () => versionHistory.renameByPrefix(oldPath, newPath)
      : () => versionHistory.renameFile(oldPath, newPath)
    const ragRename = rootRename.isDirectory
      ? () => ragService.renameByPrefix(oldPath, newPath)
      : () => ragService.renameDocument(oldPath, newPath)
    await Promise.all([
      syncSecondaryStore('Version history', historyRename),
      syncSecondaryStore('RAG index', ragRename),
    ])
    return {
      renamedPaths: renamedPaths.map(item => ({ oldPath: item.oldPath, newPath: item.newPath, isDirectory: item.isDirectory })),
      updatedLinkPaths,
    }
  },

  async readDirectory(path: string): Promise<FileRecord[]> {
    if (path !== '/') {
      const record = await db.files.where('path').equals(path).first()
      if (!record) {
        throw new Error(`文件夹不存在: ${path}`)
      }
      if (!record.isDirectory) {
        throw new Error(`路径不是文件夹: ${path}`)
      }
    }
    const files: FileRecord[] = []
    const maxFilesPerDirectory = 1000
    await db.files.where('parentPath').equals(path)
      .until(() => files.length >= maxFilesPerDirectory)
      .each(file => {
        files.push(file)
      })
    return files
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
    const files: FileRecord[] = []
    await db.files.filter(isMarkdownFile).each(file => {
      files.push(file)
    })
    return files
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
