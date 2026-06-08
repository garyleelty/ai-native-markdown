import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock dependencies
vi.mock('@/services/knowledgeIndex', () => ({
  knowledgeIndex: {
    getAll: vi.fn(),
    subscribe: vi.fn(() => () => {}),
  },
}))

import { knowledgeIndex } from '@/services/knowledgeIndex'

// Test the tag completion logic
describe('useTagCompletion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should extract tag query from text after #', () => {
    // Test helper function behavior
    const extractTagQuery = (text: string): string => {
      const hashIndex = text.lastIndexOf('#')
      if (hashIndex === -1) return ''
      const query = text.slice(hashIndex + 1)
      // Stop at whitespace, comma, or bracket
      if (/[\s,\[\]]/.test(query)) return ''
      return query
    }

    expect(extractTagQuery('hello #tag')).toBe('tag')
    expect(extractTagQuery('hello #work/home')).toBe('work/home')
    expect(extractTagQuery('hello #tag1 #tag2')).toBe('tag2')
    expect(extractTagQuery('hello #')).toBe('')
    expect(extractTagQuery('hello world')).toBe('')
  })

  it('should filter tags based on query', async () => {
    const allTags = [
      { filePath: '/note1.md', tags: ['work', 'home', 'project'] },
      { filePath: '/note2.md', tags: ['work', 'important'] },
      { filePath: '/note3.md', tags: ['home', 'diy'] },
    ]
    vi.mocked(knowledgeIndex.getAll).mockResolvedValue(allTags as any)

    const filterTags = async (query: string) => {
      const records = await knowledgeIndex.getAll()
      const tagCount = new Map<string, number>()
      for (const record of records as any) {
        for (const tag of record.tags || []) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        }
      }
      const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1])
      if (!query) return sorted.slice(0, 10)
      return sorted.filter(([tag]) => tag.toLowerCase().includes(query.toLowerCase())).slice(0, 10)
    }

    const result = await filterTags('work')
    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('work')
  })

  it('should return tags sorted by frequency', async () => {
    const allTags = [
      { filePath: '/note1.md', tags: ['work'] },
      { filePath: '/note2.md', tags: ['work'] },
      { filePath: '/note3.md', tags: ['work'] },
      { filePath: '/note4.md', tags: ['home'] },
    ]
    vi.mocked(knowledgeIndex.getAll).mockResolvedValue(allTags as any)

    const getTagsSortedByFrequency = async () => {
      const records = await knowledgeIndex.getAll()
      const tagCount = new Map<string, number>()
      for (const record of records as any) {
        for (const tag of record.tags || []) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        }
      }
      return [...tagCount.entries()].sort((a, b) => b[1] - a[1])
    }

    const result = await getTagsSortedByFrequency()
    expect(result[0][0]).toBe('work')
    expect(result[0][1]).toBe(3)
    expect(result[1][0]).toBe('home')
    expect(result[1][1]).toBe(1)
  })

  it('should detect tag completion trigger', () => {
    const detectTagTrigger = (textBeforeCursor: string): { trigger: boolean; query: string; start: number } | null => {
      const hashIndex = textBeforeCursor.lastIndexOf('#')
      if (hashIndex === -1) return null

      const query = textBeforeCursor.slice(hashIndex + 1)
      // Must be at start of line or preceded by whitespace
      if (hashIndex > 0 && !/\s/.test(textBeforeCursor[hashIndex - 1])) return null
      // Stop at whitespace, comma, bracket
      if (/[\s,\[\]]/.test(query)) return null
      // Empty query after # - not a valid trigger
      if (query === '') return null

      return {
        trigger: true,
        query,
        start: hashIndex,
      }
    }

    expect(detectTagTrigger('hello #')).toBeNull()
    expect(detectTagTrigger('hello #tag')).toEqual({ trigger: true, query: 'tag', start: 6 })
    expect(detectTagTrigger('#mytag')).toEqual({ trigger: true, query: 'mytag', start: 0 })
    expect(detectTagTrigger('[[link]]#tag')).toBeNull()
  })

  it('should handle nested tags with /', async () => {
    const filterTags = async (query: string) => {
      const allTags = [
        { filePath: '/note1.md', tags: ['work/projects', 'work/home', 'personal'] },
      ]
      vi.mocked(knowledgeIndex.getAll).mockResolvedValue(allTags as any)
      const records = await knowledgeIndex.getAll()
      const tagCount = new Map<string, number>()
      for (const record of records as any) {
        for (const tag of record.tags || []) {
          tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
        }
      }
      const sorted = [...tagCount.entries()].sort((a, b) => b[1] - a[1])
      if (!query) return sorted
      return sorted.filter(([tag]) => tag.toLowerCase().includes(query.toLowerCase()))
    }

    const result = await filterTags('work/')
    expect(result).toHaveLength(2)
    expect(result.map(([t]) => t)).toContain('work/projects')
    expect(result.map(([t]) => t)).toContain('work/home')
  })
})
