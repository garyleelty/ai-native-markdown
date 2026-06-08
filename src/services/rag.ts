import Dexie, { type Table } from 'dexie'
import type { KnowledgeIndexRecord } from '@/services/knowledgeIndex'

export interface ChunkRecord {
  id?: number
  filePath: string
  chunkIndex: number
  content: string
  lineStart?: number
  lineEnd?: number
  updatedAt: number
}

export interface DocMetaRecord {
  filePath: string
  title: string
  charCount: number
  chunkCount: number
  lastIndexed: number
}

export interface RAGSearchResult {
  filePath: string
  chunkIndex: number
  content: string
  lineStart?: number
  lineEnd?: number
  relevance: number
}

export interface RAGContextSource {
  id: string
  filePath: string
  chunkIndex: number
  lineStart?: number
  lineEnd?: number
  excerpt?: string
  relevance: number
}

export interface RAGContextResult {
  context: string
  sources: RAGContextSource[]
}

export interface RAGContextOptions {
  includeGraphContext?: boolean
  graphNeighborLimit?: number
  graphRecords?: KnowledgeIndexRecord[]
}

interface SearchCandidateOptions {
  candidateLimit: number
  desiredFileCount?: number
  perFileCandidateLimit?: number
  maxScannedMatches?: number
}

interface KnowledgeGraphContextIndex {
  records: KnowledgeIndexRecord[]
  recordsByPath: Map<string, KnowledgeIndexRecord>
  recordsByName: Map<string, KnowledgeIndexRecord>
}

interface ChunkSlice {
  content: string
  lineStart: number
  lineEnd: number
}

class RAGDatabase extends Dexie {
  chunks!: Table<ChunkRecord>
  meta!: Table<DocMetaRecord>

  constructor() {
    super('ai-markdown-rag')
    this.version(1).stores({
      chunks: '++id, filePath, chunkIndex, [filePath+chunkIndex]',
      meta: 'filePath'
    })
    this.version(2).stores({
      chunks: '++id, filePath, chunkIndex, [filePath+chunkIndex]',
      meta: 'filePath,lastIndexed'
    })
  }
}

const ragDb = new RAGDatabase()

function buildLineStartOffsets(text: string): number[] {
  const offsets = [0]
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') offsets.push(index + 1)
  }
  return offsets
}

function lineNumberAtOffset(lineStarts: number[], offset: number): number {
  const safeOffset = Math.max(0, offset)
  let low = 0
  let high = lineStarts.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    if (lineStarts[middle] <= safeOffset) low = middle + 1
    else high = middle - 1
  }
  return Math.max(1, high + 1)
}

function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): ChunkSlice[] {
  const chunks: ChunkSlice[] = []
  const lineStarts = buildLineStartOffsets(text)
  let start = 0
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length)
    let chunk = text.substring(start, end)
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('。')
      const lastNewline = chunk.lastIndexOf('\n')
      const cutAt = Math.max(lastPeriod, lastNewline)
      if (cutAt > chunk.length * 0.3) {
        chunk = chunk.substring(0, cutAt + 1)
        end = start + cutAt + 1
      }
    }
    const content = chunk.trim()
    if (content.length > 0) {
      const leadingWhitespace = chunk.match(/^\s*/)?.[0].length ?? 0
      const trailingWhitespace = chunk.match(/\s*$/)?.[0].length ?? 0
      const contentStartOffset = start + leadingWhitespace
      const contentEndOffset = Math.max(contentStartOffset, end - trailingWhitespace - 1)
      chunks.push({
        content,
        lineStart: lineNumberAtOffset(lineStarts, contentStartOffset),
        lineEnd: lineNumberAtOffset(lineStarts, contentEndOffset),
      })
    }
    if (start >= text.length) break
    if (end >= text.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

function titleFromPath(filePath: string): string {
  return filePath.split('/').pop()?.replace(/\.md$/i, '') || filePath
}

function pathMatchesPrefix(filePath: string, prefix: string): boolean {
  return filePath === prefix || filePath.startsWith(`${prefix}/`)
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.toLowerCase()
  const latinTokens = normalized.match(/[\p{L}\p{N}_-]{2,}/gu) || []
  const cjkTokens = (normalized.match(/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]{2,}/gu) || [])
    .flatMap(token => {
      const grams = []
      for (let i = 0; i < token.length - 1; i += 1) {
        grams.push(token.slice(i, i + 2))
      }
      return [token, ...grams]
    })
  return uniqueValues([...latinTokens, ...cjkTokens])
}

function countOccurrences(text: string, token: string): number {
  if (!token) return 0
  let count = 0
  let index = text.indexOf(token)
  while (index !== -1) {
    count += 1
    index = text.indexOf(token, index + token.length)
  }
  return count
}

function scoreChunk(chunk: ChunkRecord, query: string, tokens: string[]): number {
  const content = chunk.content.toLowerCase()
  const title = titleFromPath(chunk.filePath).toLowerCase()
  const path = chunk.filePath.toLowerCase()
  const phrase = query.trim().toLowerCase()
  let score = 0

  if (phrase.length > 1) {
    if (title.includes(phrase)) score += 4
    if (path.includes(phrase)) score += 2
    if (content.includes(phrase)) score += 3
  }

  for (const token of tokens) {
    const contentHits = countOccurrences(content, token)
    if (contentHits > 0) score += Math.min(contentHits, 6)
    if (title.includes(token)) score += 3
    if (path.includes(token)) score += 1
  }

  if (score > 0 && chunk.chunkIndex === 0) score += 0.15
  return score
}

function chunkMatchesQuery(chunk: ChunkRecord, query: string, tokens: string[]): boolean {
  const content = chunk.content.toLowerCase()
  const title = titleFromPath(chunk.filePath).toLowerCase()
  const path = chunk.filePath.toLowerCase()

  return content.includes(query) || title.includes(query) || path.includes(query) ||
    tokens.some(token => content.includes(token) || title.includes(token) || path.includes(token))
}

async function collectSearchCandidates(
  queryText: string,
  queryTokens: string[],
  fileFilter: string | undefined,
  options: SearchCandidateOptions,
): Promise<ChunkRecord[]> {
  if (fileFilter) {
    return ragDb.chunks.where('filePath').equals(fileFilter).toArray()
  }

  const chunks: ChunkRecord[] = []
  const fileCounts = new Map<string, number>()
  const matchedFiles = new Set<string>()
  const lowerQuery = queryText.toLowerCase()
  const candidateLimit = Math.max(1, options.candidateLimit)
  const desiredFileCount = Math.max(1, options.desiredFileCount ?? 1)
  const perFileCandidateLimit = options.perFileCandidateLimit ?? Number.POSITIVE_INFINITY
  const maxScannedMatches = options.maxScannedMatches ?? candidateLimit
  let scannedMatches = 0

  await ragDb.chunks
    .filter(chunk => chunkMatchesQuery(chunk, lowerQuery, queryTokens))
    .until(() => (
      scannedMatches >= maxScannedMatches ||
      (chunks.length >= candidateLimit && matchedFiles.size >= desiredFileCount)
    ))
    .each(chunk => {
      scannedMatches += 1
      matchedFiles.add(chunk.filePath)

      const fileCount = fileCounts.get(chunk.filePath) ?? 0
      if (fileCount >= perFileCandidateLimit) return

      fileCounts.set(chunk.filePath, fileCount + 1)
      chunks.push(chunk)
    })

  return chunks
}

function rankChunks(chunks: ChunkRecord[], queryText: string, queryTokens: string[]): RAGSearchResult[] {
  return chunks
    .map(chunk => {
      const relevance = scoreChunk(chunk, queryText, queryTokens)

      return {
        filePath: chunk.filePath,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        relevance,
      }
    })
    .filter(r => r.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
}

function diversifyResults(results: RAGSearchResult[], topK: number, maxPerFile: number): RAGSearchResult[] {
  const limit = Math.max(1, topK)
  const perFileLimit = Math.max(1, maxPerFile)
  const selected: RAGSearchResult[] = []
  const deferred: RAGSearchResult[] = []
  const selectedCounts = new Map<string, number>()

  for (const result of results) {
    const count = selectedCounts.get(result.filePath) ?? 0
    if (count < perFileLimit) {
      selected.push(result)
      selectedCounts.set(result.filePath, count + 1)
      if (selected.length >= limit) return selected
    } else {
      deferred.push(result)
    }
  }

  for (const result of deferred) {
    if (selected.length >= limit) break
    selected.push(result)
  }

  return selected
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function truncateText(text: string, maxLength: number): string {
  const normalized = normalizeWhitespace(text)
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength).trim()}...`
}

function formatLineRange(lineStart?: number, lineEnd?: number): string {
  if (!lineStart || lineStart <= 0) return ''
  if (!lineEnd || lineEnd <= lineStart) return `L${lineStart}`
  return `L${lineStart}-L${lineEnd}`
}

function buildKnowledgeGraphContextIndex(records: KnowledgeIndexRecord[]): KnowledgeGraphContextIndex {
  const recordsByPath = new Map(records.map(record => [record.filePath, record]))
  const recordsByName = new Map<string, KnowledgeIndexRecord>()
  for (const record of records) {
    recordsByName.set(record.normalizedTitle, record)
    for (const alias of record.normalizedAliases) {
      recordsByName.set(alias, record)
    }
  }
  return { records, recordsByPath, recordsByName }
}

function formatGraphRecord(record: KnowledgeIndexRecord): string {
  const excerpt = truncateText(record.searchableText, 120)
  return excerpt ? `${record.title} (${record.filePath}) — ${excerpt}` : `${record.title} (${record.filePath})`
}

function buildSourceGraphContext(
  filePath: string,
  index: KnowledgeGraphContextIndex | null,
  neighborLimit: number,
): string {
  if (!index) return ''

  const record = index.recordsByPath.get(filePath)
  if (!record) return ''

  const names = new Set([record.normalizedTitle, ...record.normalizedAliases])
  const outgoingRecords = uniqueValues(record.normalizedLinks)
    .map(link => index.recordsByName.get(link))
    .filter((target): target is KnowledgeIndexRecord => target !== undefined)
    .filter(target => target.filePath !== record.filePath)
    .filter((target, targetIndex, records) => records.findIndex(record => record.filePath === target.filePath) === targetIndex)
    .slice(0, neighborLimit)

  const backlinks = index.records
    .filter(candidate => candidate.filePath !== record.filePath)
    .filter(candidate => candidate.normalizedLinks.some(link => names.has(link)))
    .slice(0, neighborLimit)

  const lines = [
    `- 标题: ${record.title}`,
  ]
  if (record.tags.length > 0) {
    lines.push(`- 标签: ${record.tags.map(tag => `#${tag}`).join(', ')}`)
  }
  if (outgoingRecords.length > 0) {
    lines.push(`- 出链: ${outgoingRecords.map(formatGraphRecord).join(' | ')}`)
  }
  if (backlinks.length > 0) {
    lines.push(`- 反链: ${backlinks.map(formatGraphRecord).join(' | ')}`)
  }

  if (lines.length === 1) return ''
  return `相关知识图谱：\n${lines.join('\n')}\n`
}

export const ragService = {
  async indexDocument(filePath: string, content: string): Promise<number> {
    const chunks = splitIntoChunks(content)
    await ragDb.transaction('rw', [ragDb.chunks, ragDb.meta], async () => {
      await ragDb.chunks.where('filePath').equals(filePath).delete()

      const now = Date.now()
      const records: ChunkRecord[] = chunks.map((chunk, i) => ({
        filePath,
        chunkIndex: i,
        content: chunk.content,
        lineStart: chunk.lineStart,
        lineEnd: chunk.lineEnd,
        updatedAt: now,
      }))
      await ragDb.chunks.bulkAdd(records)

      const title = titleFromPath(filePath)
      await ragDb.meta.put({
        filePath,
        title,
        charCount: content.length,
        chunkCount: chunks.length,
        lastIndexed: now,
      })
    })

    return chunks.length
  },

  async search(query: string, topK = 5, fileFilter?: string): Promise<RAGSearchResult[]> {
    const queryTokens = tokenizeQuery(query)
    const queryText = query.trim()
    if (topK <= 0 || !queryText || queryTokens.length === 0) return []

    const chunks = await collectSearchCandidates(queryText, queryTokens, fileFilter, {
      candidateLimit: Math.max(topK * 10, topK),
    })

    return rankChunks(chunks, queryText, queryTokens)
      .slice(0, topK)
  },

  async searchDiversified(query: string, topK = 5, maxPerFile = 1, fileFilter?: string): Promise<RAGSearchResult[]> {
    const queryTokens = tokenizeQuery(query)
    const queryText = query.trim()
    if (topK <= 0 || !queryText || queryTokens.length === 0) return []

    const perFileCandidateLimit = Math.max(maxPerFile * 3, 3)
    const candidateLimit = Math.max(topK * perFileCandidateLimit * 2, topK * 8, 40)
    const chunks = await collectSearchCandidates(queryText, queryTokens, fileFilter, {
      candidateLimit,
      desiredFileCount: topK,
      perFileCandidateLimit,
      maxScannedMatches: Math.max(candidateLimit * 8, 240),
    })

    return diversifyResults(rankChunks(chunks, queryText, queryTokens), topK, maxPerFile)
  },

  async listDocuments(): Promise<DocMetaRecord[]> {
    return ragDb.meta.orderBy('lastIndexed').reverse().toArray()
  },

  async buildContextWithSources(query: string, maxTokens = 3000, options: RAGContextOptions = {}): Promise<RAGContextResult> {
    const results = await this.searchDiversified(query, 5, 1)
    let context = ''
    let tokenEstimate = 0
    const sources: RAGContextSource[] = []
    const graphContextIndex = options.includeGraphContext && options.graphRecords
      ? buildKnowledgeGraphContextIndex(options.graphRecords)
      : null
    const graphNeighborLimit = Math.max(1, options.graphNeighborLimit ?? 3)
    for (const r of results) {
      const source: RAGContextSource = {
        id: `S${sources.length + 1}`,
        filePath: r.filePath,
        chunkIndex: r.chunkIndex,
        lineStart: r.lineStart,
        lineEnd: r.lineEnd,
        excerpt: truncateText(r.content, 220),
        relevance: r.relevance,
      }
      const graphContext = buildSourceGraphContext(r.filePath, graphContextIndex, graphNeighborLimit)
      const lineRange = formatLineRange(r.lineStart, r.lineEnd)
      const lineText = lineRange ? ` lines ${lineRange}` : ''
      const text = `[${source.id}] [${r.filePath}#chunk-${r.chunkIndex + 1}]${lineText} relevance ${r.relevance.toFixed(2)}\n${graphContext}${r.content}\n\n`
      const nextTokenEstimate = tokenEstimate + text.length / 2
      if (nextTokenEstimate > maxTokens) break
      tokenEstimate = nextTokenEstimate
      context += text
      sources.push(source)
    }
    return { context, sources }
  },

  async buildContext(query: string, maxTokens = 3000): Promise<string> {
    return (await this.buildContextWithSources(query, maxTokens)).context
  },

  async deleteDocument(filePath: string): Promise<void> {
    await ragDb.chunks.where('filePath').equals(filePath).delete()
    await ragDb.meta.where('filePath').equals(filePath).delete()
  },

  async deleteByPrefix(prefix: string): Promise<void> {
    await ragDb.transaction('rw', [ragDb.chunks, ragDb.meta], async () => {
      const chunks = await ragDb.chunks.filter(chunk => pathMatchesPrefix(chunk.filePath, prefix)).toArray()
      await ragDb.chunks.bulkDelete(chunks.map(chunk => chunk.id!).filter(Boolean))
      const metas = await ragDb.meta.filter(meta => pathMatchesPrefix(meta.filePath, prefix)).toArray()
      await ragDb.meta.bulkDelete(metas.map(meta => meta.filePath))
    })
  },

  async renameDocument(oldPath: string, newPath: string): Promise<void> {
    await ragDb.transaction('rw', [ragDb.chunks, ragDb.meta], async () => {
      const chunks = await ragDb.chunks.where('filePath').equals(oldPath).toArray()
      await Promise.all(chunks.map(chunk => {
        if (!chunk.id) return Promise.resolve()
        return ragDb.chunks.update(chunk.id, { filePath: newPath, updatedAt: Date.now() })
      }))

      const meta = await ragDb.meta.where('filePath').equals(oldPath).first()
      if (meta) {
        await ragDb.meta.delete(oldPath)
        await ragDb.meta.put({
          ...meta,
          filePath: newPath,
          title: titleFromPath(newPath),
          lastIndexed: Date.now(),
        })
      }
    })
  },

  async renameByPrefix(oldPrefix: string, newPrefix: string): Promise<void> {
    await ragDb.transaction('rw', [ragDb.chunks, ragDb.meta], async () => {
      const now = Date.now()
      const chunks = await ragDb.chunks.filter(chunk => pathMatchesPrefix(chunk.filePath, oldPrefix)).toArray()
      await Promise.all(chunks.map(chunk => {
        if (!chunk.id) return Promise.resolve()
        const nextPath = chunk.filePath === oldPrefix
          ? newPrefix
          : `${newPrefix}${chunk.filePath.slice(oldPrefix.length)}`
        return ragDb.chunks.update(chunk.id, { filePath: nextPath, updatedAt: now })
      }))

      const metas = await ragDb.meta.filter(meta => pathMatchesPrefix(meta.filePath, oldPrefix)).toArray()
      await ragDb.meta.bulkDelete(metas.map(meta => meta.filePath))
      await ragDb.meta.bulkPut(metas.map(meta => {
        const nextPath = meta.filePath === oldPrefix
          ? newPrefix
          : `${newPrefix}${meta.filePath.slice(oldPrefix.length)}`
        return {
          ...meta,
          filePath: nextPath,
          title: titleFromPath(nextPath),
          lastIndexed: now,
        }
      }))
    })
  }
}
