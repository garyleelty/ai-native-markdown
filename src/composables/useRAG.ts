import { ref } from 'vue'

const isTauri = '__TAURI_INTERNALS__' in window

async function tauriInvoke(cmd: string, args?: Record<string, unknown>): Promise<unknown> {
  if (!isTauri) throw new Error('Tauri 环境不可用')
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke(cmd, args)
}

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
    const { aiService } = await import('@/services/ai')
    const provider = aiService.getActiveProvider()
    if (!provider) throw new Error('未配置 AI 服务')

    const config = provider.getConfig()
    isIndexing.value = true

    try {
      await tauriInvoke('index_document', {
        filePath,
        content,
        baseUrl: config.baseURL as string,
        apiKey: '',
        model: config.model as string,
      })
      await listDocuments()
    } finally {
      isIndexing.value = false
    }
  }

  const search = async (query: string, topK = 5, fileFilter?: string) => {
    const result = await tauriInvoke('rag_search', {
      query,
      topK,
      fileFilter: fileFilter || null,
    }) as { chunks: ChunkMatch[]; total: number }

    searchResults.value = result.chunks
    return result
  }

  const listDocuments = async () => {
    const docs = await tauriInvoke('rag_list_documents') as IndexedDocument[]
    indexedDocuments.value = docs
  }

  const buildContext = async (query: string, maxTokens = 3000): Promise<string> => {
    const result = await search(query, 5)
    let context = ''
    let tokenEstimate = 0

    for (const chunk of result.chunks) {
      const chunkText = `[${chunk.file_path}]: ${chunk.content}\n\n`
      tokenEstimate += chunkText.length / 2

      if (tokenEstimate > maxTokens) break
      context += chunkText
    }

    return context
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
