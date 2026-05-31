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
    start = end - overlap
    if (start >= text.length) break
  }
  return chunks.filter(c => c.length > 0)
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

      const title = filePath.split('/').pop()?.replace(/\.md$/i, '') || filePath
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
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 1)

    let chunks: ChunkRecord[]
    if (fileFilter) {
      chunks = await ragDb.chunks.where('filePath').equals(fileFilter).toArray()
    } else {
      chunks = await ragDb.chunks.toArray()
    }

    const results = chunks
      .map(chunk => {
        const contentLower = chunk.content.toLowerCase()
        const relevance = queryWords.reduce((sum, word) => {
          return sum + (contentLower.includes(word) ? 1 : 0)
        }, 0) / Math.max(queryWords.length, 1)

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
  }
}
