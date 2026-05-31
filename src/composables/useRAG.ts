import { ref } from 'vue'
import { ragService } from '@/services/rag'

export interface ChunkMatch {
  file_path: string
  chunk_index: number
  content: string
  relevance: number
}

export interface IndexedDocument {
  file_path: string
  title: string
  char_count: number
  chunk_count: number
  last_indexed: number
}

export function useRAG() {
  const isIndexing = ref(false)
  const indexedDocuments = ref<IndexedDocument[]>([])
  const searchResults = ref<ChunkMatch[]>([])

  const indexDocument = async (filePath: string, content: string) => {
    isIndexing.value = true
    try {
      await ragService.indexDocument(filePath, content)
      await listDocuments()
    } finally {
      isIndexing.value = false
    }
  }

  const search = async (query: string, topK = 5, fileFilter?: string) => {
    const chunks = await ragService.search(query, topK, fileFilter)
    searchResults.value = chunks.map(c => ({
      file_path: c.filePath,
      chunk_index: c.chunkIndex,
      content: c.content,
      relevance: c.relevance,
    }))
    return { chunks: searchResults.value, total: searchResults.value.length }
  }

  const listDocuments = async () => {
    const docs = await ragService.listDocuments()
    indexedDocuments.value = docs.map(d => ({
      file_path: d.filePath,
      title: d.title,
      char_count: d.charCount,
      chunk_count: d.chunkCount,
      last_indexed: d.lastIndexed,
    }))
  }

  const buildContext = async (query: string, maxTokens = 3000): Promise<string> => {
    return ragService.buildContext(query, maxTokens)
  }

  return {
    isIndexing,
    indexedDocuments,
    searchResults,
    indexDocument,
    search,
    listDocuments,
    buildContext,
  }
}
