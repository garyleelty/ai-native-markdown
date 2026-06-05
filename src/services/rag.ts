import Dexie, { type Table } from 'dexie'

export interface ChunkRecord {
  id?: number
  filePath: string
  chunkIndex: number
  content: string
  updatedAt: number
}

export interface DocMetaRecord {
  filePath: string
  title: string
  charCount: number
  chunkCount: number
  lastIndexed: number
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

function splitIntoChunks(text: string, chunkSize = 500, overlap = 50): string[] {
  const chunks: string[] = []
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
    chunks.push(chunk.trim())
    if (start >= text.length) break
    if (end >= text.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks.filter(c => c.length > 0)
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

export const ragService = {
  async indexDocument(filePath: string, content: string): Promise<number> {
    const chunks = splitIntoChunks(content)
    await ragDb.transaction('rw', [ragDb.chunks, ragDb.meta], async () => {
      await ragDb.chunks.where('filePath').equals(filePath).delete()

      const now = Date.now()
      const records: ChunkRecord[] = chunks.map((chunk, i) => ({
        filePath,
        chunkIndex: i,
        content: chunk,
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

  async search(query: string, topK = 5, fileFilter?: string): Promise<Array<{ filePath: string; chunkIndex: number; content: string; relevance: number }>> {
    const queryTokens = tokenizeQuery(query)
    const queryText = query.trim()
    if (!queryText || queryTokens.length === 0) return []

    let chunks: ChunkRecord[]
    if (fileFilter) {
      chunks = await ragDb.chunks.where('filePath').equals(fileFilter).toArray()
    } else {
      chunks = await ragDb.chunks.toArray()
    }

    const results = chunks
      .map(chunk => {
        const relevance = scoreChunk(chunk, queryText, queryTokens)

        return {
          filePath: chunk.filePath,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          relevance,
        }
      })
      .filter(r => r.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, topK)

    return results
  },

  async listDocuments(): Promise<DocMetaRecord[]> {
    return ragDb.meta.orderBy('lastIndexed').reverse().toArray()
  },

  async buildContext(query: string, maxTokens = 3000): Promise<string> {
    const results = await this.search(query, 5)
    let context = ''
    let tokenEstimate = 0
    for (const r of results) {
      const text = `[${r.filePath}]: ${r.content}\n\n`
      tokenEstimate += text.length / 2
      if (tokenEstimate > maxTokens) break
      context += text
    }
    return context
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
