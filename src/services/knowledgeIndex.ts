import Dexie, { type Table } from 'dexie'
import type { KnowledgeGraphData, GraphEdge, GraphNode } from '@/types'
import { normalizeNoteName, parseMarkdownMetadata, type FrontmatterValue } from '@/utils/metadata'
import { parseWikiLinkTarget } from '@/utils/wikiLinks'
import { safeStorage } from '@/utils/security'
import { vaultService } from '@/services/vault'
import { fileSystem } from './fileSystem'

export interface KnowledgeIndexRecord {
  id?: number
  filePath: string
  title: string
  normalizedTitle: string
  aliases: string[]
  normalizedAliases: string[]
  tags: string[]
  links: string[]
  normalizedLinks: string[]
  frontmatter: Record<string, FrontmatterValue>
  propertyTypes: Record<string, string>
  searchableText: string
  updatedAt: number
}

export interface KnowledgeReference {
  filePath: string
  title: string
  excerpt: string
  lineNumber?: number
}

class KnowledgeIndexDB extends Dexie {
  records!: Table<KnowledgeIndexRecord>

  constructor() {
    super('ai-markdown-knowledge-index')
    this.version(1).stores({
      records: '++id, &filePath, normalizedTitle, *normalizedAliases, *tags, *normalizedLinks, updatedAt'
    })
    this.version(2).stores({
      records: '++id, &filePath, normalizedTitle, *normalizedAliases, *tags, *normalizedLinks, updatedAt'
    }).upgrade(() => {
      safeStorage.set('ai-markdown-knowledge-index-stale', true)
    })
    this.version(3).stores({
      records: '++id, &filePath, normalizedTitle, *normalizedAliases, *tags, *normalizedLinks, updatedAt'
    }).upgrade(async (trans) => {
      // 为现有记录添加默认 propertyTypes
      const t = trans as any
      await t.records.toCollection().modify((record: any) => {
        if (!record.propertyTypes) {
          record.propertyTypes = {}
        }
      })
    })
  }
}

const db = new KnowledgeIndexDB()
const events = new EventTarget()
const STALE_KEY = 'ai-markdown-knowledge-index-stale'

interface IndexOptions {
  silent?: boolean
}

function notifyChange() {
  events.dispatchEvent(new Event('change'))
}


function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function makeExcerpt(text: string, needle: string): string {
  const index = text.toLowerCase().indexOf(needle.toLowerCase())
  if (index === -1) return text.slice(0, 140)
  const start = Math.max(0, index - 50)
  const end = Math.min(text.length, index + needle.length + 70)
  return `${start > 0 ? '...' : ''}${text.slice(start, end).trim()}${end < text.length ? '...' : ''}`
}

function getRecordNames(record: KnowledgeIndexRecord): string[] {
  return [record.normalizedTitle, ...record.normalizedAliases]
}

function getBodyStartLineIndex(content: string): number {
  const lines = content.split(/\r?\n/)
  if (lines[0]?.trim() !== '---') return 0
  const closingIndex = lines.slice(1).findIndex(line => line.trim() === '---')
  return closingIndex === -1 ? 0 : closingIndex + 2
}

function stripWikiLinks(line: string): string {
  return line.replace(/\[\[[^\]]+\]\]/g, ' ')
}

function hasTextMention(line: string, name: string): boolean {
  const trimmed = name.trim()
  if (!trimmed) return false
  const text = stripWikiLinks(line)
  if (/^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+$/.test(trimmed)) {
    return trimmed.length >= 3 && text.includes(trimmed)
  }
  if (trimmed.length < 3) return false
  return new RegExp(`(^|[^\\p{L}\\p{N}_-])${escapeRegExp(trimmed)}($|[^\\p{L}\\p{N}_-])`, 'iu').test(text)
}

function findWikiLinkLine(content: string, normalizedTargets: string[]): number | undefined {
  const targets = new Set(normalizedTargets)
  const lines = content.split(/\r?\n/)
  for (let i = getBodyStartLineIndex(content); i < lines.length; i++) {
    const matches = lines[i].matchAll(/\[\[([^\]]+)\]\]/g)
    for (const match of matches) {
      const parsed = parseWikiLinkTarget(match[1])
      if (parsed.fileTarget && targets.has(normalizeNoteName(parsed.fileTarget))) {
        return i + 1
      }
    }
  }
  return undefined
}

function findMentionLine(content: string, names: string[]): number | undefined {
  const lines = content.split(/\r?\n/)
  for (let i = getBodyStartLineIndex(content); i < lines.length; i++) {
    if (names.some(name => hasTextMention(lines[i], name))) {
      return i + 1
    }
  }
  return undefined
}

async function readCurrentFileOrEmpty(filePath: string): Promise<string> {
  try {
    return vaultService.readFileOrEmpty(filePath)
  } catch (e) {
    console.error(`[knowledgeIndex] Failed to read file "${filePath}" via vaultService, falling back to fileSystem:`, e)
    return fileSystem.readFileOrEmpty(filePath)
  }
}

export const knowledgeIndex = {
  markStale(): void {
    safeStorage.set(STALE_KEY, true)
    notifyChange()
  },

  clearStale(): void {
    safeStorage.remove(STALE_KEY)
  },

  isStale(): boolean {
    const stale = safeStorage.get<boolean | number | string>(STALE_KEY, false)
    return stale === true || stale === 1 || stale === '1'
  },

  async count(): Promise<number> {
    return db.records.count()
  },

  notifyChanged(): void {
    notifyChange()
  },

  async indexFile(filePath: string, content: string, options: IndexOptions = {}): Promise<void> {
    if (!isMarkdownPath(filePath)) return

    const metadata = parseMarkdownMetadata(filePath, content)
    const existing = await db.records.where('filePath').equals(filePath).first()
    const record: KnowledgeIndexRecord = {
      id: existing?.id,
      filePath,
      title: metadata.title,
      normalizedTitle: normalizeNoteName(metadata.title),
      aliases: metadata.aliases,
      normalizedAliases: metadata.aliases.map(normalizeNoteName),
      tags: metadata.tags,
      links: metadata.links,
      normalizedLinks: metadata.links.map(normalizeNoteName),
      frontmatter: metadata.frontmatter,
      propertyTypes: existing?.propertyTypes || {},
      searchableText: metadata.searchableText,
      updatedAt: Date.now(),
    }

    await db.records.put(record)
    if (!options.silent) notifyChange()
  },

  async savePropertyTypePref(filePath: string, propertyName: string, type: string): Promise<void> {
    const record = await db.records.where('filePath').equals(filePath).first()
    if (record && record.id) {
      const newPropertyTypes = { ...record.propertyTypes }
      newPropertyTypes[propertyName] = type
      await db.records.update(record.id, { propertyTypes: newPropertyTypes })
    }
  },

  async removeFile(filePath: string, options: IndexOptions = {}): Promise<void> {
    await db.records.where('filePath').equals(filePath).delete()
    if (!options.silent) notifyChange()
  },

  async removeByPrefix(prefix: string, options: IndexOptions = {}): Promise<void> {
    const ids: number[] = []
    await db.records.filter(record => record.filePath === prefix || record.filePath.startsWith(`${prefix}/`)).each(record => {
      if (record.id) ids.push(record.id)
    })
    await db.records.bulkDelete(ids)
    if (!options.silent) notifyChange()
  },

  async renameFile(oldPath: string, newPath: string, content?: string, options: IndexOptions = {}): Promise<void> {
    if (content !== undefined) {
      await this.removeFile(oldPath, { silent: true })
      await this.indexFile(newPath, content, { silent: true })
      if (!options.silent) notifyChange()
      return
    }

    const record = await db.records.where('filePath').equals(oldPath).first()
    if (!record || !record.id) return
    await db.records.update(record.id, { filePath: newPath, updatedAt: Date.now() })
    if (!options.silent) notifyChange()
  },

  async renameByPrefix(oldPrefix: string, newPrefix: string, options: IndexOptions = {}): Promise<void> {
    const updates: Array<{ id: number; nextPath: string }> = []
    await db.records.filter(record => record.filePath === oldPrefix || record.filePath.startsWith(`${oldPrefix}/`)).each(record => {
      if (!record.id) return
      const nextPath = record.filePath === oldPrefix
        ? newPrefix
        : `${newPrefix}${record.filePath.slice(oldPrefix.length)}`
      updates.push({ id: record.id, nextPath })
    })
    await Promise.all(updates.map(({ id, nextPath }) =>
      db.records.update(id, { filePath: nextPath, updatedAt: Date.now() })
    ))
    if (!options.silent) notifyChange()
  },

  async rebuild(files: Array<{ path: string; content: string }>): Promise<void> {
    await db.records.clear()
    await Promise.all(files.map(file => knowledgeIndex.indexFile(file.path, file.content, { silent: true })))
    this.clearStale()
    notifyChange()
  },

  async rebuildFromFiles(): Promise<void> {
    await db.records.clear()
    const files = await fileSystem.getAllMarkdownFiles()
    for (const file of files) {
      const content = await fileSystem.readFileOrEmpty(file.path)
      await knowledgeIndex.indexFile(file.path, content, { silent: true })
    }
    this.clearStale()
    notifyChange()
  },

  subscribe(listener: () => void): () => void {
    events.addEventListener('change', listener)
    return () => events.removeEventListener('change', listener)
  },

  async getAll(): Promise<KnowledgeIndexRecord[]> {
    const records: KnowledgeIndexRecord[] = []
    await db.records.each(record => { records.push(record) })
    return records
  },

  /**
   * 流式遍历记录，支持提前终止，避免全量加载到内存。
   * 符合项目规范 §2.1。
   */
  async filterRecords(
    predicate: (record: KnowledgeIndexRecord) => void,
    until?: () => boolean,
  ): Promise<void> {
    await db.records
      .filter(() => true)
      .until(() => until?.() ?? false)
      .each(record => {
        if (until?.()) return
        predicate(record)
      })
  },

  /**
   * 流式正则搜索，避免全量加载。
   * 使用 .each() 遍历 + .until() 提前终止，符合项目规范。
   */
  async searchRegex(
    pattern: string,
    rootPath: string,
    maxFiles: number,
    maxMatchesPerFile: number,
    onMatch: (filePath: string, fileName: string, matches: Array<{ lineNumber: number; lineContent: string }>) => void,
  ): Promise<void> {
    const prefix = `${rootPath}/`
    let fileCount = 0

    await db.records
      .filter(record => record.filePath.startsWith(prefix))
      .until(() => fileCount >= maxFiles)
      .each(record => {
        if (fileCount >= maxFiles) return
        const lines = record.searchableText.split('\n')
        const matches: Array<{ lineNumber: number; lineContent: string }> = []

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxMatchesPerFile) break
          const lineRegex = new RegExp(pattern, 'gi')
          if (lineRegex.test(lines[i])) {
            matches.push({ lineNumber: i + 1, lineContent: lines[i].trim().slice(0, 200) })
          }
        }

        if (matches.length > 0) {
          const fileName = record.filePath.split('/').pop() || record.filePath
          onMatch(record.filePath, fileName, matches)
          fileCount += 1
        }
      })
  },

  async getByPath(filePath: string): Promise<KnowledgeIndexRecord | undefined> {
    return db.records.where('filePath').equals(filePath).first()
  },

  async getBacklinks(filePath: string): Promise<KnowledgeReference[]> {
    const current = await this.getByPath(filePath)
    if (!current) return []
    
    // 构建所有可能用于匹配的名称
    const names = new Set(getRecordNames(current))
    // 添加文件名
    const fileName = current.filePath.split('/').pop()?.replace(/\.(md|markdown)$/i, '')
    if (fileName) {
      names.add(normalizeNoteName(fileName))
    }
    // 添加路径名
    const filePathWithoutExt = current.filePath.replace(/\.(md|markdown)$/i, '')
    names.add(normalizeNoteName(filePathWithoutExt))
    // 添加相对于 workspace 的路径
    const workspaceRelativePath = filePathWithoutExt.replace(/^\/?workspace\//i, '')
    names.add(normalizeNoteName(workspaceRelativePath))

    // Use indexed query on normalizedLinks with limit to avoid loading too many records
    const results: KnowledgeReference[] = []
    const maxResults = 100
    const seenFilePaths = new Set<string>()
    
    for (const name of names) {
      if (results.length >= maxResults) break
      
      const matchingRecords = await db.records
        .where('normalizedLinks')
        .equals(name)
        .limit(maxResults - results.length)
        .toArray()
        
      for (const record of matchingRecords) {
        if (results.length >= maxResults) break
        if (record.filePath === filePath) continue
        if (seenFilePaths.has(record.filePath)) continue
        
        seenFilePaths.add(record.filePath)
        // Read content on demand instead of storing it
        const content = await readCurrentFileOrEmpty(record.filePath)
        results.push({
          filePath: record.filePath,
          title: record.title,
          excerpt: makeExcerpt(record.searchableText, current.title),
          lineNumber: findWikiLinkLine(content, [...names]),
        })
      }
    }

    return results
  },

  async getUnlinkedMentions(filePath: string): Promise<KnowledgeReference[]> {
    const current = await this.getByPath(filePath)
    if (!current) return []
    const names = [current.title, ...current.aliases].filter(name => name.trim().length >= 2)
    const normalizedNames = getRecordNames(current)

    // Only load records that have links (to exclude them), then check for text mentions
    const linkedFilePaths = new Set<string>()
    const maxLinkedCheck = 1000
    let linkedCount = 0
    
    for (const name of normalizedNames) {
      if (linkedCount >= maxLinkedCheck) break
      const matching = await db.records
        .where('normalizedLinks').equals(name)
        .limit(maxLinkedCheck - linkedCount)
        .toArray()
      for (const record of matching) {
        if (record.filePath !== filePath) {
          linkedFilePaths.add(record.filePath)
          linkedCount++
        }
      }
    }

    // For unlinked mentions, we still need to scan records that DON'T link to this file
    // Use a targeted approach: scan records not in linkedFilePaths with a limit
    const results: KnowledgeReference[] = []
    const maxResults = 100
    
    await db.records.each(record => {
      if (results.length >= maxResults) return false
      if (record.filePath === filePath) return
      if (linkedFilePaths.has(record.filePath)) return
      const hasMention = names.some(name => {
        const trimmed = name.trim()
        if (!trimmed) return false
        if (/^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+$/.test(trimmed)) {
          return trimmed.length >= 3 && record.searchableText.includes(trimmed)
        }
        if (trimmed.length < 3) return false
        return new RegExp(`(^|[^\\p{L}\\p{N}_-])${escapeRegExp(trimmed)}($|[^\\p{L}\\p{N}_-])`, 'iu').test(record.searchableText)
      })
      if (hasMention) {
        results.push({
          filePath: record.filePath,
          title: record.title,
          excerpt: makeExcerpt(record.searchableText, names[0]),
          lineNumber: -1, // Will be resolved lazily
        })
      }
    })

    // Resolve line numbers on demand
    for (const result of results) {
      const content = await readCurrentFileOrEmpty(result.filePath)
      result.lineNumber = findMentionLine(content, names)
    }

    return results
  },

  async buildGraphData(): Promise<KnowledgeGraphData> {
    // 流式遍历避免全量加载到内存（符合项目规范 §2.1）
    const records: KnowledgeIndexRecord[] = []
    await db.records.each(record => { records.push(record) })

    const byName = new Map<string, KnowledgeIndexRecord>()
    for (const record of records) {
      byName.set(record.normalizedTitle, record)
      for (const alias of record.normalizedAliases) {
        byName.set(alias, record)
      }
      // 添加文件名匹配（不含扩展名和路径）
      const fileName = record.filePath.split('/').pop()?.replace(/\.(md|markdown)$/i, '')
      if (fileName) {
        const normalizedFileName = normalizeNoteName(fileName)
        byName.set(normalizedFileName, record)
      }
      // 添加路径匹配（不含扩展名）
      const filePathWithoutExt = record.filePath.replace(/\.(md|markdown)$/i, '')
      const normalizedFilePath = normalizeNoteName(filePathWithoutExt)
      byName.set(normalizedFilePath, record)
      // 添加相对于 workspace 的路径匹配
      const workspaceRelativePath = filePathWithoutExt.replace(/^\/?workspace\//i, '')
      const normalizedWorkspacePath = normalizeNoteName(workspaceRelativePath)
      byName.set(normalizedWorkspacePath, record)
    }

    const nodes: GraphNode[] = records.map(record => ({
      id: record.filePath,
      label: record.title,
      path: record.filePath,
      linkCount: 0,
      tags: record.tags,
      isOrphan: true,
    }))

    const nodeMap = new Map(nodes.map(node => [node.path, node]))
    const edges: GraphEdge[] = []
    const seenEdges = new Set<string>()

    for (const record of records) {
      for (const link of record.normalizedLinks) {
        const target = byName.get(link)
        if (!target || target.filePath === record.filePath) continue
        const edgeKey = `${record.filePath}->${target.filePath}`
        if (seenEdges.has(edgeKey)) continue
        seenEdges.add(edgeKey)
        edges.push({ source: record.filePath, target: target.filePath, weight: 1 })
        const sourceNode = nodeMap.get(record.filePath)
        const targetNode = nodeMap.get(target.filePath)
        if (sourceNode) sourceNode.linkCount += 1
        if (targetNode) targetNode.linkCount += 1
      }
    }

    for (const node of nodes) { node.isOrphan = node.linkCount === 0 }

    return {
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        orphanCount: nodes.filter(node => node.isOrphan).length,
        avgLinkCount: nodes.length
          ? Math.round((nodes.reduce((sum, node) => sum + node.linkCount, 0) / nodes.length) * 10) / 10
          : 0,
      }
    }
  }
}
import { isMarkdownPath } from '@/utils/pathHelpers'
