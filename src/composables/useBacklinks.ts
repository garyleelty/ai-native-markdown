import { ref, watch } from 'vue'
import { knowledgeIndex, type KnowledgeReference } from '@/services/knowledgeIndex'

export interface UseBacklinksOptions {
  /** Debounce delay in ms, default 300 */
  debounce?: number
}

export function useBacklinks(
  filePath: () => string | undefined,
  options: UseBacklinksOptions = {}
) {
  const { debounce = 300 } = options

  const backlinks = ref<KnowledgeReference[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const fetchBacklinks = async () => {
    const path = filePath()
    if (!path) {
      backlinks.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      const result = await knowledgeIndex.getBacklinks(path)
      backlinks.value = result
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch backlinks'
      backlinks.value = []
    } finally {
      loading.value = false
    }
  }

  const debouncedFetch = () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(fetchBacklinks, debounce)
  }

  // Watch for file path changes
  watch(filePath, () => {
    debouncedFetch()
  })

  // Subscribe to knowledge index changes
  const unsubscribe = knowledgeIndex.subscribe(() => {
    debouncedFetch()
  })

  // Initial fetch
  fetchBacklinks()

  return {
    backlinks,
    loading,
    error,
    refresh: fetchBacklinks,
    unsubscribe,
  }
}
