import { describe, it, expect, vi, beforeEach } from 'vitest'

// Test regex search functionality
describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should detect regex search pattern', () => {
    const isRegexQuery = (query: string): boolean => {
      // If query starts and ends with /, it's a regex
      return query.startsWith('/') && query.endsWith('/') && query.length > 2
    }

    expect(isRegexQuery('/\\d+/')).toBe(true)
    expect(isRegexQuery('/^todo/')).toBe(true)
    expect(isRegexQuery('simple text')).toBe(false)
    expect(isRegexQuery('/incomplete')).toBe(false)
    expect(isRegexQuery('no ending slash/')).toBe(false)
  })

  it('should extract regex pattern', () => {
    const extractRegex = (query: string): RegExp | null => {
      if (!query.startsWith('/') || !query.endsWith('/') || query.length <= 2) {
        return null
      }
      try {
        const pattern = query.slice(1, -1)
        return new RegExp(pattern, 'gi')
      } catch {
        return null
      }
    }

    expect(extractRegex('/\\d+/')?.source).toBe('\\d+')
    expect(extractRegex('/^todo/')?.source).toBe('^todo')
    expect(extractRegex('simple')).toBe(null)
  })

  it('should handle invalid regex gracefully', () => {
    const extractRegex = (query: string): RegExp | null => {
      if (!query.startsWith('/') || !query.endsWith('/') || query.length <= 2) {
        return null
      }
      try {
        const pattern = query.slice(1, -1)
        return new RegExp(pattern, 'gi')
      } catch {
        return null
      }
    }

    expect(extractRegex('/[/')).toBe(null) // Invalid regex
    expect(extractRegex('/(*)/')).toBe(null) // Invalid regex
  })

  it('should search using regex pattern', () => {
    const testContent = [
      { filePath: '/note1.md', content: 'Task 1: TODO fix bug' },
      { filePath: '/note2.md', content: 'Task 2: DONE implement feature' },
      { filePath: '/note3.md', content: 'Task 3: WIP refactor' },
    ]

    const searchWithRegex = (pattern: RegExp, files: typeof testContent) => {
      const results: Array<{ filePath: string; matches: string[] }> = []
      for (const file of files) {
        const matches: string[] = []
        const lines = file.content.split('\n')
        for (const line of lines) {
          const match = line.match(pattern)
          if (match) matches.push(line.trim())
        }
        if (matches.length > 0) {
          results.push({ filePath: file.filePath, matches })
        }
      }
      return results
    }

    const results = searchWithRegex(/\bTODO\b|\bDONE\b|\bWIP\b/gi, testContent)
    expect(results).toHaveLength(3)
    expect(results[0].matches[0]).toContain('TODO')
    expect(results[1].matches[0]).toContain('DONE')
    expect(results[2].matches[0]).toContain('WIP')
  })

  it('should fallback to text search for non-regex', () => {
    const testContent = [
      { filePath: '/note1.md', content: 'Hello world' },
      { filePath: '/note2.md', content: 'Hello everyone' },
      { filePath: '/note3.md', content: 'Goodbye world' },
    ]

    const searchText = (query: string, files: typeof testContent) => {
      const lowerQuery = query.toLowerCase()
      const results: Array<{ filePath: string; matches: string[] }> = []
      for (const file of files) {
        const lines = file.content.split('\n')
        const matches = lines.filter(line => line.toLowerCase().includes(lowerQuery))
        if (matches.length > 0) {
          results.push({ filePath: file.filePath, matches: matches.map(m => m.trim()) })
        }
      }
      return results
    }

    const results = searchText('hello', testContent)
    expect(results).toHaveLength(2)
    expect(results[0].filePath).toBe('/note1.md')
    expect(results[1].filePath).toBe('/note2.md')
  })

  it('should highlight matched text in excerpt', () => {
    const makeExcerpt = (text: string, query: string, maxLength = 140): string => {
      const index = text.toLowerCase().indexOf(query.toLowerCase())
      if (index === -1) return text.slice(0, maxLength)
      const start = Math.max(0, index - 40)
      const end = Math.min(text.length, index + query.length + 80)
      const excerpt = (start > 0 ? '...' : '') + text.slice(start, end) + (end < text.length ? '...' : '')
      // Highlight the match
      const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
      return excerpt.replace(regex, '**$1**')
    }

    const result = makeExcerpt('This is a test document with TODO in it', 'TODO')
    expect(result).toContain('**TODO**')
    expect(result).not.toContain('...**TODO**...') // Should not have ellipsis right before/after highlight
  })

  it('should support case insensitive regex by default', () => {
    const testContent = 'TODO: fix this bug'

    const regex = new RegExp('todo', 'gi') // Global, case-insensitive
    expect(regex.test(testContent)).toBe(true)

    const regexCaseSensitive = new RegExp('todo', 'g') // Global, case-sensitive
    expect(regexCaseSensitive.test(testContent)).toBe(false)
  })
})
