import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { knowledgeIndex } from '@/services/knowledgeIndex'
import { vaultService } from '@/services/vault'

type SearchResult = { filePath: string; fileName: string; matches: Array<{ lineNumber?: number; lineContent: string }> }

export function useFileSearch(options: {
  rootPath: () => string
  isDisposed: () => boolean
}) {
  const searchQuery = ref('')
  const searchMode = ref<'name' | 'content'>('name')
  const contentSearchMode = ref<'text' | 'regex'>('text')
  const contentSearchResults = ref<SearchResult[]>([])
  const nameSearchResults = ref<SearchResult[]>([])
  const trimmedSearchQuery = computed(() => searchQuery.value.trim())
  const activeSearchResults = computed(() => searchMode.value === 'name' ? nameSearchResults.value : contentSearchResults.value)

  let nameSearchRequestId = 0
  let contentSearchRequestId = 0

  const getRelativeWorkspacePath = (path: string) => {
    const rootPath = options.rootPath()
    const prefix = rootPath.endsWith('/') ? rootPath : `${rootPath}/`
    return path.startsWith(prefix) ? path.slice(prefix.length) : path
  }

  const toggleSearchMode = () => {
    searchMode.value = searchMode.value === 'name' ? 'content' : 'name'
    contentSearchResults.value = []
    nameSearchResults.value = []
    if (searchMode.value === 'content' && trimmedSearchQuery.value) searchContent()
    if (searchMode.value === 'name' && trimmedSearchQuery.value) searchFileNames()
  }

  const clearSearch = () => {
    nameSearchRequestId += 1
    contentSearchRequestId += 1
    searchQuery.value = ''
    contentSearchResults.value = []
    nameSearchResults.value = []
  }

  const searchFileNames = async () => {
    const requestId = ++nameSearchRequestId
    const query = trimmedSearchQuery.value.toLowerCase()
    const activeRootPath = options.rootPath()
    if (!query || !activeRootPath) {
      nameSearchResults.value = []
      return
    }

    try {
      const files = await vaultService.getAllMarkdownFiles()
      if (
        options.isDisposed() ||
        requestId !== nameSearchRequestId ||
        searchMode.value !== 'name' ||
        trimmedSearchQuery.value.toLowerCase() !== query ||
        options.rootPath() !== activeRootPath
      ) return
      nameSearchResults.value = files
        .filter(file => file.path.startsWith(`${activeRootPath}/`))
        .filter(file => file.name.toLowerCase().includes(query) || getRelativeWorkspacePath(file.path).toLowerCase().includes(query))
        .sort((a, b) => {
          const aName = a.name.toLowerCase()
          const bName = b.name.toLowerCase()
          const aStarts = aName.startsWith(query) ? 0 : 1
          const bStarts = bName.startsWith(query) ? 0 : 1
          if (aStarts !== bStarts) return aStarts - bStarts
          return a.name.localeCompare(b.name)
        })
        .slice(0, 30)
        .map(file => ({
          filePath: file.path,
          fileName: file.name,
          matches: [{ lineContent: getRelativeWorkspacePath(file.path) }],
        }))
    } catch {
      if (options.isDisposed() || requestId !== nameSearchRequestId) return
      nameSearchResults.value = []
      ElMessage.error('搜索失败')
    }
  }

  const handleSearchInput = () => {
    if (searchMode.value === 'name') {
      void searchFileNames()
    } else {
      contentSearchResults.value = []
    }
  }

  const handleSearchEnter = () => {
    if (searchMode.value === 'content') void searchContent()
    else void searchFileNames()
  }

  const searchContent = async () => {
    const requestId = ++contentSearchRequestId
    const query = trimmedSearchQuery.value
    const activeRootPath = options.rootPath()
    if (!query || !activeRootPath) {
      contentSearchResults.value = []
      return
    }

    const isRegex = query.startsWith('/') && query.endsWith('/') && query.length > 2
    contentSearchMode.value = isRegex ? 'regex' : 'text'

    try {
      let results: SearchResult[]

      if (isRegex) {
        const pattern = query.slice(1, -1)
        try {
          const searchResults: SearchResult[] = []
          const maxResults = 30

          await knowledgeIndex.searchRegex(pattern, activeRootPath, maxResults, 5, (filePath, fileName, matches) => {
            searchResults.push({ filePath, fileName, matches })
          })
          results = searchResults
        } catch {
          results = []
        }
      } else {
        results = await vaultService.searchFiles(query)
        results = results.filter(r => r.filePath.startsWith(`${activeRootPath}/`))
      }

      if (
        options.isDisposed() ||
        requestId !== contentSearchRequestId ||
        searchMode.value !== 'content' ||
        trimmedSearchQuery.value !== query ||
        options.rootPath() !== activeRootPath
      ) return
      contentSearchResults.value = results
    } catch {
      if (options.isDisposed() || requestId !== contentSearchRequestId) return
      ElMessage.error('搜索失败')
    }
  }

  const cancelPendingSearches = () => {
    nameSearchRequestId += 1
    contentSearchRequestId += 1
  }

  return {
    searchQuery,
    searchMode,
    contentSearchMode,
    contentSearchResults,
    nameSearchResults,
    trimmedSearchQuery,
    activeSearchResults,
    toggleSearchMode,
    clearSearch,
    searchFileNames,
    searchContent,
    handleSearchInput,
    handleSearchEnter,
    cancelPendingSearches,
  }
}
