import { ref, computed, watch, onUnmounted, type Ref } from 'vue'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { fileSystem } from '@/services/fileSystem'

export interface SearchResult {
  filePath: string
  fileName: string
  matches: Array<{
    lineNumber: number
    lineContent: string
  }>
  relevanceScore?: number
  semanticSummary?: string
}

export interface SemanticSearchResult {
  filePath: string
  fileName: string
  relevance: number
  summary: string
  keyTopics: string[]
}

export interface GlobalSearchOptions {
  /** Max results per file, default 5 */
  maxMatchesPerFile?: number
  /** Max total results, default 50 */
  maxResults?: number
  /** Enable AI-powered semantic search */
  enableSemanticSearch?: boolean
}

export function useGlobalSearch(options: GlobalSearchOptions = {}) {
  const { maxMatchesPerFile = 5, maxResults = 50, enableSemanticSearch = false } = options

  const query = ref('')
  const scopePath = ref('')
  const results = ref<SearchResult[]>([])
  const semanticResults = ref<SemanticSearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchMode = ref<'text' | 'regex' | 'semantic'>('text')
  const isSemanticSearch = ref(false)
  let isDisposed = false

  // Detect if query is a regex pattern (starts and ends with /)
  const isRegexQuery = (q: string): boolean => {
    return q.startsWith('/') && q.endsWith('/') && q.length > 2
  }

  // Extract regex pattern from query
  const extractRegex = (q: string): RegExp | null => {
    if (!isRegexQuery(q)) return null
    try {
      const pattern = q.slice(1, -1)
      return new RegExp(pattern, 'gi')
    } catch (e) {
      console.debug('[useGlobalSearch] Invalid regex pattern:', e)
      return null
    }
  }

  // Make excerpt with match highlighted
  const makeExcerpt = (text: string, matchQuery: string, maxLength = 140): string => {
    const lowerText = text.toLowerCase()
    const lowerQuery = matchQuery.toLowerCase()
    const index = lowerText.indexOf(lowerQuery)
    if (index === -1) return text.slice(0, maxLength)

    const start = Math.max(0, index - 40)
    const end = Math.min(text.length, index + matchQuery.length + 80)
    const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')

    // Highlight the match
    const escapedQuery = matchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`(${escapedQuery})`, 'gi')
    return excerpt.replace(regex, '**$1**')
  }

  // Search files with given query
  const search = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      results.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const isRegex = isRegexQuery(searchQuery)
      searchMode.value = isRegex ? 'regex' : 'text'

      if (isRegex) {
        const regex = extractRegex(searchQuery)
        if (!regex) {
          error.value = 'Invalid regex pattern'
          results.value = []
          return
        }
        await searchWithRegex(regex, searchQuery)
      } else {
        await searchWithText(searchQuery.toLowerCase(), searchQuery)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
      results.value = []
    } finally {
      loading.value = false
    }
  }

  // Search using regex pattern
  const searchWithRegex = async (pattern: RegExp, originalQuery: string) => {
    const searchResults: SearchResult[] = []
    const allRecords = await knowledgeIndex.getAll()
    const cleanQuery = originalQuery.replace(/^\/|\/$/g, '')
    const scope = scopePath.value.trim()

    // First filter using knowledge index searchableText (faster)
    const candidateFiles = allRecords.filter(record => {
      if (scope && !record.filePath.startsWith(scope)) return false
      // Also include filename match
      return record.searchableText.toLowerCase().includes(cleanQuery.toLowerCase()) ||
             record.filePath.toLowerCase().includes(cleanQuery.toLowerCase())
    })

    for (const record of candidateFiles) {
      if (searchResults.length >= maxResults) break

      try {
        const content = await fileSystem.readFile(record.filePath)
        const lines = content.split('\n')
        const matches: Array<{ lineNumber: number; lineContent: string }> = []

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxMatchesPerFile) break
          const line = lines[i]
          // Reset regex lastIndex to avoid issues with global regex
          pattern.lastIndex = 0
          if (pattern.test(line)) {
            matches.push({
              lineNumber: i + 1,
              lineContent: makeExcerpt(line, cleanQuery),
            })
          }
        }

        if (matches.length > 0) {
          const fileName = record.filePath.split('/').pop() || record.filePath
          searchResults.push({
            filePath: record.filePath,
            fileName,
            matches,
          })
        }
      } catch (e) {
        console.debug(`[useGlobalSearch] Skipped unreadable file: ${record.filePath}`, e)
      }
    }

    results.value = searchResults
  }

  // Search using text (case-insensitive)
  const searchWithText = async (lowerQuery: string, originalQuery: string) => {
    const searchResults: SearchResult[] = []
    const allRecords = await knowledgeIndex.getAll()
    const scope = scopePath.value.trim()

    // First filter using knowledge index searchableText (faster)
    const candidateFiles = allRecords.filter(record => {
      if (scope && !record.filePath.startsWith(scope)) return false
      // Also include filename match
      return record.searchableText.toLowerCase().includes(lowerQuery) ||
             record.filePath.toLowerCase().includes(lowerQuery)
    })

    for (const record of candidateFiles) {
      if (searchResults.length >= maxResults) break

      try {
        const content = await fileSystem.readFile(record.filePath)
        const lines = content.split('\n')
        const matches: Array<{ lineNumber: number; lineContent: string }> = []

        for (let i = 0; i < lines.length; i++) {
          if (matches.length >= maxMatchesPerFile) break
          const line = lines[i]
          if (line.toLowerCase().includes(lowerQuery)) {
            matches.push({
              lineNumber: i + 1,
              lineContent: makeExcerpt(line, originalQuery),
            })
          }
        }

        if (matches.length > 0) {
          const fileName = record.filePath.split('/').pop() || record.filePath
          searchResults.push({
            filePath: record.filePath,
            fileName,
            matches,
          })
        }
      } catch (e) {
        console.debug(`[useGlobalSearch] Skipped unreadable file: ${record.filePath}`, e)
      }
    }

    results.value = searchResults
  }

  // Debounced search
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedSearch = (q: string) => {
    if (isDisposed) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (!isDisposed) search(q)
    }, 200)
  }

  // Watch query changes
  watch(query, (newQuery) => {
    debouncedSearch(newQuery)
  })

  // Cleanup on unmount
  onUnmounted(() => {
    isDisposed = true
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  })

  // Total match count
  const totalMatches = computed(() => {
    return results.value.reduce((sum, r) => sum + r.matches.length, 0)
  })

  function dispose(): void {
    isDisposed = true
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    results.value = []
    error.value = null
  }

  // AI-powered semantic search
  const semanticSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      semanticResults.value = []
      return
    }

    loading.value = true
    error.value = null
    isSemanticSearch.value = true
    searchMode.value = 'semantic'

    try {
      const allRecords = await knowledgeIndex.getAll()
      const scope = scopePath.value.trim()

      // Filter by scope
      const candidateRecords = allRecords.filter(record => {
        if (scope && !record.filePath.startsWith(scope)) return false
        return true
      })

      // Simple semantic matching based on keywords and context
      const results: SemanticSearchResult[] = []
      const queryLower = searchQuery.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)

      for (const record of candidateRecords) {
        const contentLower = record.searchableText.toLowerCase()
        const titleLower = record.title.toLowerCase()
        const tagsLower = record.tags.map(t => t.toLowerCase()).join(' ')

        let relevance = 0
        const matchedTopics: string[] = []

        // Title match (highest weight)
        if (titleLower.includes(queryLower)) {
          relevance += 100
          matchedTopics.push('标题匹配')
        }

        // Tag match
        for (const tag of record.tags) {
          if (tag.toLowerCase().includes(queryLower) || queryLower.includes(tag.toLowerCase())) {
            relevance += 50
            matchedTopics.push(`标签: ${tag}`)
          }
        }

        // Content keyword match
        for (const word of queryWords) {
          if (contentLower.includes(word)) {
            relevance += 10
            if (!matchedTopics.includes('内容匹配')) {
              matchedTopics.push('内容匹配')
            }
          }
        }

        // Frontmatter match
        for (const [key, value] of Object.entries(record.frontmatter)) {
          const valueStr = String(value).toLowerCase()
          if (valueStr.includes(queryLower) || queryLower.includes(valueStr)) {
            relevance += 30
            matchedTopics.push(`属性: ${key}`)
          }
        }

        // Only include results with some relevance
        if (relevance > 0) {
          // Generate summary
          const summary = generateSemanticSummary(record.searchableText, searchQuery)

          results.push({
            filePath: record.filePath,
            fileName: record.title,
            relevance,
            summary,
            keyTopics: matchedTopics,
          })
        }
      }

      // Sort by relevance
      results.sort((a, b) => b.relevance - a.relevance)

      // Limit results
      semanticResults.value = results.slice(0, maxResults)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Semantic search failed'
      semanticResults.value = []
    } finally {
      loading.value = false
    }
  }

  // Generate semantic summary
  function generateSemanticSummary(content: string, query: string): string {
    const queryLower = query.toLowerCase()
    const sentences = content.split(/[.!?。！？]+/).filter(s => s.trim().length > 0)

    // Find most relevant sentence
    let bestSentence = ''
    let bestScore = 0

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase()
      let score = 0

      // Check for query words
      const queryWords = queryLower.split(/\s+/)
      for (const word of queryWords) {
        if (sentenceLower.includes(word)) {
          score += 10
        }
      }

      // Check for exact query
      if (sentenceLower.includes(queryLower)) {
        score += 50
      }

      if (score > bestScore) {
        bestScore = score
        bestSentence = sentence.trim()
      }
    }

    // Return best sentence or first 150 characters
    if (bestSentence && bestScore > 0) {
      return bestSentence.length > 150 ? bestSentence.substring(0, 150) + '...' : bestSentence
    }

    return content.substring(0, 150) + '...'
  }

  // Check if query looks like a natural language question
  const isNaturalLanguageQuery = (q: string): boolean => {
    const questionPatterns = [
      /^(what|how|why|when|where|who|which|can|could|would|should|is|are|was|were|do|does|did)\b/i,
      /^(什么|怎么|为什么|何时|哪里|谁|哪个|能否|可以|是否|是不是)/i,
      /\?$/,
      /？$/,
    ]
    return questionPatterns.some(pattern => pattern.test(q))
  }

  return {
    query,
    scopePath,
    results,
    semanticResults,
    loading,
    error,
    searchMode,
    isSemanticSearch,
    totalMatches,
    search,
    semanticSearch,
    isRegexQuery,
    isNaturalLanguageQuery,
    dispose,
  }
}
