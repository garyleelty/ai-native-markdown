import Dexie, { type Table } from 'dexie'
import type { KnowledgeGraphData, GraphEdge, GraphNode } from '@/types'
import { normalizeNoteName, parseMarkdownMetadata, type FrontmatterValue } from '@/utils/metadata'

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
  searchableText: string
  updatedAt: number
}

export interface KnowledgeReference {
  filePath: string
  title: string
  excerpt: string
}

class KnowledgeIndexDB extends Dexie {
  records!: Table<KnowledgeIndexRecord>

  constructor() {
    super('ai-markdown-knowledge-index')
    this.version(1).stores({
      records: '++id, &filePath, normalizedTitle, *normalizedAliases, *tags, *normalizedLinks, updatedAt'
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

function isMarkdownPath(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.markdown')
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

export const knowledgeIndex = {
  markStale(): void {
    try {
      localStorage.setItem(STALE_KEY, '1')
    } catch {
    }
    notifyChange()
  },

  clearStale(): void {
    try {
      localStorage.removeItem(STALE_KEY)
    } catch {
    }
  },

  isStale(): boolean {
    try {
      return localStorage.getItem(STALE_KEY) === '1'
    } catch {
      return true
    }
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
      searchableText: metadata.searchableText,
      updatedAt: Date.now(),
    }

    await db.records.put(record)
    if (!options.silent) notifyChange()
  },

  async removeFile(filePath: string, options: IndexOptions = {}): Promise<void> {
    await db.records.where('filePath').equals(filePath).delete()
    if (!options.silent) notifyChange()
  },

  async removeByPrefix(prefix: string, options: IndexOptions = {}): Promise<void> {
    const records = await db.records.filter(record => record.filePath === prefix || record.filePath.startsWith(`${prefix}/`)).toArray()
    await db.records.bulkDelete(records.map(record => record.id!).filter(Boolean))
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
    const records = await db.records.filter(record => record.filePath === oldPrefix || record.filePath.startsWith(`${oldPrefix}/`)).toArray()
    await Promise.all(records.map(record => {
      if (!record.id) return Promise.resolve()
      const nextPath = record.filePath === oldPrefix
        ? newPrefix
        : `${newPrefix}${record.filePath.slice(oldPrefix.length)}`
      return db.records.update(record.id, { filePath: nextPath, updatedAt: Date.now() })
    }))
    if (!options.silent) notifyChange()
  },

  async rebuild(files: Array<{ path: string; content: string }>): Promise<void> {
    await db.records.clear()
    await Promise.all(files.map(file => knowledgeIndex.indexFile(file.path, file.content, { silent: true })))
    this.clearStale()
    notifyChange()
  },

  subscribe(listener: () => void): () => void {
    events.addEventListener('change', listener)
    return () => events.removeEventListener('change', listener)
  },

  async getAll(): Promise<KnowledgeIndexRecord[]> {
    return db.records.toArray()
  },

  async getByPath(filePath: string): Promise<KnowledgeIndexRecord | undefined> {
    return db.records.where('filePath').equals(filePath).first()
  },

  async getBacklinks(filePath: string): Promise<KnowledgeReference[]> {
    const current = await this.getByPath(filePath)
    if (!current) return []
    const names = getRecordNames(current)
    const records = await db.records.toArray()

    return records
      .filter(record => record.filePath !== filePath && record.normalizedLinks.some(link => names.includes(link)))
      .map(record => ({
        filePath: record.filePath,
        title: record.title,
        excerpt: makeExcerpt(record.searchableText, current.title),
      }))
  },

  async getUnlinkedMentions(filePath: string): Promise<KnowledgeReference[]> {
    const current = await this.getByPath(filePath)
    if (!current) return []
    const names = [current.title, ...current.aliases].filter(name => name.trim().length >= 2)
    const normalizedNames = getRecordNames(current)
    const records = await db.records.toArray()

    return records
      .filter(record => record.filePath !== filePath)
      .filter(record => !record.normalizedLinks.some(link => normalizedNames.includes(link)))
      .filter(record => names.some(name => {
        const trimmed = name.trim()
        if (!trimmed) return false
        if (/^[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+$/.test(trimmed)) {
          return trimmed.length >= 3 && record.searchableText.includes(trimmed)
        }
        if (trimmed.length < 3) return false
        return new RegExp(`(^|[^\\p{L}\\p{N}_-])${escapeRegExp(trimmed)}($|[^\\p{L}\\p{N}_-])`, 'iu').test(record.searchableText)
      }))
      .map(record => ({
        filePath: record.filePath,
        title: record.title,
        excerpt: makeExcerpt(record.searchableText, names[0]),
      }))
  },

  async buildGraphData(): Promise<KnowledgeGraphData> {
    const records = await db.records.toArray()
    const byName = new Map<string, KnowledgeIndexRecord>()
    records.forEach(record => {
      byName.set(record.normalizedTitle, record)
      record.normalizedAliases.forEach(alias => byName.set(alias, record))
    })

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

    records.forEach(record => {
      record.normalizedLinks.forEach(link => {
        const target = byName.get(link)
        if (!target || target.filePath === record.filePath) return
        const edgeKey = `${record.filePath}->${target.filePath}`
        if (seenEdges.has(edgeKey)) return
        seenEdges.add(edgeKey)
        edges.push({ source: record.filePath, target: target.filePath, weight: 1 })
        const sourceNode = nodeMap.get(record.filePath)
        const targetNode = nodeMap.get(target.filePath)
        if (sourceNode) sourceNode.linkCount += 1
        if (targetNode) targetNode.linkCount += 1
      })
    })

    nodes.forEach(node => { node.isOrphan = node.linkCount === 0 })

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
