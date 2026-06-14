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
}

export interface GlobalSearchOptions {
  /** Max results per file, default 5 */
  maxMatchesPerFile?: number
  /** Max total results, default 50 */
  maxResults?: number
}

export function useGlobalSearch(options: GlobalSearchOptions = {}) {
  const { maxMatchesPerFile = 5, maxResults = 50 } = options

  const query = ref('')
  const scopePath = ref('')
  const results = ref<SearchResult[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const searchMode = ref<'text' | 'regex'>('text')
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
    } catch {
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
      } catch {
        // Skip files that can't be read
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
      } catch {
        // Skip files that can't be read
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

  return {
    query,
    scopePath,
    results,
    loading,
    error,
    searchMode,
    totalMatches,
    search,
    isRegexQuery,
    dispose,
  }
}
