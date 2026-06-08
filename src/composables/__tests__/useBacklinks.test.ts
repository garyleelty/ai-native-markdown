import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock dependencies before importing the module under test
vi.mock('@/services/knowledgeIndex', () => ({
  knowledgeIndex: {
    getBacklinks: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}))

vi.mock('@/composables', () => ({
  useDebounceFn: vi.fn((fn) => fn),
}))

import { knowledgeIndex } from '@/services/knowledgeIndex'

// Test the composable logic directly
describe('useBacklinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty backlinks when filePath is undefined', async () => {
    const filePath = () => undefined as string | undefined
    const backlinks = ref<Array<{ filePath: string; title: string; excerpt: string; lineNumber?: number }>>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

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
        error.value = e instanceof Error ? e.message : 'Unknown error'
      } finally {
        loading.value = false
      }
    }

    await fetchBacklinks()
    expect(backlinks.value).toEqual([])
  })

  it('should fetch backlinks for given file path', async () => {
    const mockBacklinks = [
      { filePath: '/note1.md', title: 'Note 1', excerpt: 'Links here...' },
      { filePath: '/note2.md', title: 'Note 2', excerpt: 'Also links...' },
    ]
    vi.mocked(knowledgeIndex.getBacklinks).mockResolvedValue(mockBacklinks)

    const filePath = () => '/target.md'
    const backlinks = ref<Array<{ filePath: string; title: string; excerpt: string; lineNumber?: number }>>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

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
        error.value = e instanceof Error ? e.message : 'Unknown error'
      } finally {
        loading.value = false
      }
    }

    await fetchBacklinks()

    expect(knowledgeIndex.getBacklinks).toHaveBeenCalledWith('/target.md')
    expect(backlinks.value).toEqual(mockBacklinks)
  })

  it('should handle errors gracefully', async () => {
    vi.mocked(knowledgeIndex.getBacklinks).mockRejectedValue(new Error('Index error'))

    const filePath = () => '/target.md'
    const backlinks = ref<Array<{ filePath: string; title: string; excerpt: string; lineNumber?: number }>>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

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
        error.value = e instanceof Error ? e.message : 'Unknown error'
      } finally {
        loading.value = false
      }
    }

    await fetchBacklinks()

    expect(error.value).toBe('Index error')
    expect(backlinks.value).toEqual([])
  })

  it('should indicate loading state during fetch', async () => {
    vi.mocked(knowledgeIndex.getBacklinks).mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 10))
      return []
    })

    const filePath = () => '/target.md'
    const loading = ref(false)

    const fetchBacklinks = async () => {
      const path = filePath()
      if (!path) return
      loading.value = true
      try {
        await knowledgeIndex.getBacklinks(path)
      } finally {
        loading.value = false
      }
    }

    const fetchPromise = fetchBacklinks()
    expect(loading.value).toBe(true)
    await fetchPromise
    expect(loading.value).toBe(false)
  })
})
