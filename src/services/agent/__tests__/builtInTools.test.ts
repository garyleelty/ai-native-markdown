import { describe, it, expect, vi, beforeEach } from 'vitest'
import { listNotesTool, readNoteTool, writeNoteTool, searchNotesTool, getBacklinksTool, getTagsTool } from '../tools'
import { fileSystem } from '@/services/fileSystem'
import { knowledgeIndex } from '@/services/knowledgeIndex'

vi.mock('@/services/fileSystem')
vi.mock('@/services/knowledgeIndex')

const mockFileSystem = vi.mocked(fileSystem) as any
const mockKnowledgeIndex = vi.mocked(knowledgeIndex) as any

describe('Built-in Tools', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('listNotesTool', () => {
    it('should list all markdown files', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/test1.md', content: '# Test 1', isDirectory: false, name: 'test1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 100 },
        { path: '/test2.md', content: '# Test 2', isDirectory: false, name: 'test2.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 200 }
      ])

      const result = await listNotesTool.execute({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual(['/test1.md', '/test2.md'])
    })

    it('should filter files by prefix', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/test1.md', content: '# Test 1', isDirectory: false, name: 'test1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 100 },
        { path: '/other.md', content: '# Other', isDirectory: false, name: 'other.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 150 }
      ])

      const result = await listNotesTool.execute({ prefix: '/test' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual(['/test1.md'])
    })

    it('should limit results', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/test1.md', content: '# Test 1', isDirectory: false, name: 'test1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 100 },
        { path: '/test2.md', content: '# Test 2', isDirectory: false, name: 'test2.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 200 },
        { path: '/test3.md', content: '# Test 3', isDirectory: false, name: 'test3.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 300 }
      ])

      const result = await listNotesTool.execute({ limit: 2 })
      expect(result.success).toBe(true)
      expect((result.data as string[]).length).toBe(2)
    })

    it('should return empty list when no files exist', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([])

      const result = await listNotesTool.execute({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
      expect(result.display).toContain('0')
    })

    it('should default limit to 50 when not specified', async () => {
      const manyFiles = Array.from({ length: 60 }, (_, i) => ({
        path: `/file${i}.md`, content: '# Test', isDirectory: false, name: `file${i}.md`,
        parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 100
      }))
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue(manyFiles)

      const result = await listNotesTool.execute({})
      expect(result.success).toBe(true)
      expect((result.data as string[]).length).toBe(50)
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.getAllMarkdownFiles.mockRejectedValue(new Error('FS error'))

      const result = await listNotesTool.execute({})
      expect(result.success).toBe(false)
      expect(result.error).toContain('FS error')
    })

    it('should include display text with file count', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/a.md', content: '# A', isDirectory: false, name: 'a.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 50 }
      ])

      const result = await listNotesTool.execute({})
      expect(result.display).toContain('1')
      expect(result.display).toContain('/a.md')
    })
  })

  describe('readNoteTool', () => {
    it('should read a note successfully', async () => {
      const testPath = '/test.md'
      const testContent = '# Test Content'
      mockFileSystem.readFileOrEmpty.mockResolvedValue(testContent)

      const result = await readNoteTool.execute({ path: testPath })
      expect(result.success).toBe(true)
      expect((result.data as any).content).toBe(testContent)
      expect(mockFileSystem.readFileOrEmpty).toHaveBeenCalledWith(testPath)
    })

    it('should return error if path is missing', async () => {
      const result = await readNoteTool.execute({})
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if path is empty string', async () => {
      const result = await readNoteTool.execute({ path: '' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if path is whitespace only', async () => {
      const result = await readNoteTool.execute({ path: '   ' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if path is not a string', async () => {
      const result = await readNoteTool.execute({ path: 123 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.readFileOrEmpty.mockRejectedValue(new Error('Read error'))

      const result = await readNoteTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Read error')
    })

    it('should return display text with content', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# Hello World')

      const result = await readNoteTool.execute({ path: '/test.md' })
      expect(result.display).toBe('# Hello World')
    })
  })

  describe('writeNoteTool', () => {
    it('should write a note successfully', async () => {
      const testPath = '/test.md'
      const testContent = '# New Content'
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      const result = await writeNoteTool.execute({ path: testPath, content: testContent })
      expect(result.success).toBe(true)
      expect(mockFileSystem.writeFile).toHaveBeenCalledWith(testPath, testContent)
    })

    it('should return error if path or content is missing', async () => {
      const result1 = await writeNoteTool.execute({ path: '/test.md' })
      expect(result1.success).toBe(false)
      expect(result1.error).toContain('content')

      const result2 = await writeNoteTool.execute({ content: 'test' })
      expect(result2.success).toBe(false)
      expect(result2.error).toContain('path')
    })

    it('should return error if path is empty string', async () => {
      const result = await writeNoteTool.execute({ path: '', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if path is whitespace only', async () => {
      const result = await writeNoteTool.execute({ path: '   ', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('path')
    })

    it('should return error if content is not a string', async () => {
      const result = await writeNoteTool.execute({ path: '/test.md', content: 123 })
      expect(result.success).toBe(false)
      expect(result.error).toContain('content')
    })

    it('should return error if both path and content are missing', async () => {
      const result = await writeNoteTool.execute({})
      expect(result.success).toBe(false)
      // path is checked first
      expect(result.error).toContain('path')
    })

    it('should handle fileSystem errors gracefully', async () => {
      mockFileSystem.writeFile.mockRejectedValue(new Error('Write error'))

      const result = await writeNoteTool.execute({ path: '/test.md', content: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Write error')
    })

    it('should return display text with saved path', async () => {
      mockFileSystem.writeFile.mockResolvedValue(undefined)

      const result = await writeNoteTool.execute({ path: '/saved.md', content: 'Content' })
      expect(result.display).toContain('/saved.md')
    })
  })

  describe('searchNotesTool', () => {
    it('should search notes by query', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'This is a test about apple', rawContent: '...' },
        { filePath: '/test2.md', title: 'Test 2', searchableText: 'This is about banana', rawContent: '...' },
        { filePath: '/test3.md', title: 'Test 3', searchableText: 'Apple pie recipe', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'apple' })
      expect(result.success).toBe(true)
      const data = result.data as Array<{ filePath: string }>
      expect(data.length).toBe(2)
      expect(data.some(d => d.filePath === '/test1.md')).toBe(true)
      expect(data.some(d => d.filePath === '/test3.md')).toBe(true)
    })

    it('should limit search results', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'test', rawContent: '...' },
        { filePath: '/test2.md', title: 'Test 2', searchableText: 'test', rawContent: '...' },
        { filePath: '/test3.md', title: 'Test 3', searchableText: 'test', rawContent: '...' },
        { filePath: '/test4.md', title: 'Test 4', searchableText: 'test', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'test', limit: 2 })
      expect(result.success).toBe(true)
      const data = result.data as Array<any>
      expect(data.length).toBe(2)
    })

    it('should return empty results when no matches found', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'banana', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'apple' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should perform case-insensitive search', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'APPLE PIE', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'apple' })
      expect(result.success).toBe(true)
      const data = result.data as Array<{ filePath: string }>
      expect(data.length).toBe(1)
    })

    it('should handle knowledgeIndex errors gracefully', async () => {
      mockKnowledgeIndex.getAll.mockRejectedValue(new Error('Index error'))

      const result = await searchNotesTool.execute({ query: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Index error')
    })

    it('should include excerpt in search results', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'This is a test about apples and oranges', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'apples' })
      expect(result.success).toBe(true)
      const data = result.data as Array<{ excerpt: string }>
      expect(data[0].excerpt).toBeDefined()
      expect(data[0].excerpt.length).toBeGreaterThan(0)
    })

    it('should include display text with formatted results', async () => {
      mockKnowledgeIndex.getAll.mockResolvedValue([
        { filePath: '/test1.md', title: 'Test 1', searchableText: 'test content', rawContent: '...' }
      ])

      const result = await searchNotesTool.execute({ query: 'test' })
      expect(result.display).toContain('/test1.md')
    })

    it('should default limit to 10 when not specified', async () => {
      const manyRecords = Array.from({ length: 15 }, (_, i) => ({
        filePath: `/file${i}.md`, title: `File ${i}`, searchableText: 'test', rawContent: '...'
      }))
      mockKnowledgeIndex.getAll.mockResolvedValue(manyRecords)

      const result = await searchNotesTool.execute({ query: 'test' })
      expect(result.success).toBe(true)
      expect((result.data as any[]).length).toBe(10)
    })
  })

  describe('getBacklinksTool', () => {
    it('should get backlinks for a file', async () => {
      const testPath = '/test.md'
      mockKnowledgeIndex.getBacklinks.mockResolvedValue([
        { filePath: '/link1.md', title: 'Link 1', excerpt: 'References test.md' },
        { filePath: '/link2.md', title: 'Link 2', excerpt: 'Also references test.md' }
      ])

      const result = await getBacklinksTool.execute({ path: testPath })
      expect(result.success).toBe(true)
      const data = result.data as Array<any>
      expect(data.length).toBe(2)
      expect(mockKnowledgeIndex.getBacklinks).toHaveBeenCalledWith(testPath)
    })

    it('should return empty list when no backlinks exist', async () => {
      mockKnowledgeIndex.getBacklinks.mockResolvedValue([])

      const result = await getBacklinksTool.execute({ path: '/test.md' })
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })

    it('should handle knowledgeIndex errors gracefully', async () => {
      mockKnowledgeIndex.getBacklinks.mockRejectedValue(new Error('Index error'))

      const result = await getBacklinksTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Index error')
    })

    it('should include display text with backlink info', async () => {
      mockKnowledgeIndex.getBacklinks.mockResolvedValue([
        { filePath: '/link1.md', title: 'Link 1', excerpt: 'References test.md' }
      ])

      const result = await getBacklinksTool.execute({ path: '/test.md' })
      expect(result.display).toContain('/link1.md')
      expect(result.display).toContain('References test.md')
    })

    it('should call getBacklinks with "undefined" string when path is not provided', async () => {
      mockKnowledgeIndex.getBacklinks.mockResolvedValue([])

      await getBacklinksTool.execute({})
      // Source code does String(params.path) which converts undefined to "undefined"
      expect(mockKnowledgeIndex.getBacklinks).toHaveBeenCalledWith('undefined')
    })
  })

  describe('getTagsTool', () => {
    it('should get tags for a specific file', async () => {
      const testPath = '/test.md'
      mockFileSystem.readFileOrEmpty.mockResolvedValue('---\ntags: [tag1, tag2]\n---\nContent')

      const result = await getTagsTool.execute({ path: testPath })
      expect(result.success).toBe(true)
      expect((result.data as any).tags).toEqual(['tag1', 'tag2'])
    })

    it('should get all tags from all files', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/test1.md', content: '---\ntags: [a, b]\n---', isDirectory: false, name: 'test1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 100 },
        { path: '/test2.md', content: '---\ntags: [b, c]\n---', isDirectory: false, name: 'test2.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 200 }
      ])

      mockFileSystem.readFileOrEmpty.mockImplementation(async (path: string) => {
        if (path === '/test1.md') return '---\ntags: [a, b]\n---'
        if (path === '/test2.md') return '---\ntags: [b, c]\n---'
        return ''
      })

      const result = await getTagsTool.execute({})
      expect(result.success).toBe(true)
      const data = result.data as Array<[string, number]>
      expect(data.some(([tag]) => tag === 'a')).toBe(true)
      expect(data.some(([tag]) => tag === 'b')).toBe(true)
      expect(data.some(([tag]) => tag === 'c')).toBe(true)
    })

    it('should return empty tags for file with no tags', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('# No Tags Here\nJust content')

      const result = await getTagsTool.execute({ path: '/notags.md' })
      expect(result.success).toBe(true)
      expect((result.data as any).tags).toEqual([])
    })

    it('should sort tags by count descending', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/f1.md', isDirectory: false, name: 'f1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 50 },
        { path: '/f2.md', isDirectory: false, name: 'f2.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 50 },
        { path: '/f3.md', isDirectory: false, name: 'f3.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 50 }
      ])

      mockFileSystem.readFileOrEmpty.mockImplementation(async (path: string) => {
        if (path === '/f1.md') return '---\ntags: [common, rare]\n---'
        if (path === '/f2.md') return '---\ntags: [common]\n---'
        if (path === '/f3.md') return '---\ntags: [common]\n---'
        return ''
      })

      const result = await getTagsTool.execute({})
      expect(result.success).toBe(true)
      const data = result.data as Array<[string, number]>
      // 'common' appears 3 times, 'rare' appears 1 time
      const commonEntry = data.find(([tag]) => tag === 'common')
      const rareEntry = data.find(([tag]) => tag === 'rare')
      expect(commonEntry![1]).toBe(3)
      expect(rareEntry![1]).toBe(1)
      // common should come before rare
      expect(data.indexOf(commonEntry!)).toBeLessThan(data.indexOf(rareEntry!))
    })

    it('should handle fileSystem errors gracefully for single file', async () => {
      mockFileSystem.readFileOrEmpty.mockRejectedValue(new Error('Read error'))

      const result = await getTagsTool.execute({ path: '/test.md' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('Read error')
    })

    it('should handle fileSystem errors gracefully for all files', async () => {
      mockFileSystem.getAllMarkdownFiles.mockRejectedValue(new Error('FS error'))

      const result = await getTagsTool.execute({})
      expect(result.success).toBe(false)
      expect(result.error).toContain('FS error')
    })

    it('should return display text with tags for single file', async () => {
      mockFileSystem.readFileOrEmpty.mockResolvedValue('---\ntags: [alpha, beta]\n---\nContent')

      const result = await getTagsTool.execute({ path: '/test.md' })
      expect(result.display).toContain('alpha')
      expect(result.display).toContain('beta')
    })

    it('should return display text with tag counts for all files', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([
        { path: '/test1.md', isDirectory: false, name: 'test1.md', parentPath: '/', createdAt: Date.now(), updatedAt: Date.now(), size: 50 }
      ])
      mockFileSystem.readFileOrEmpty.mockResolvedValue('---\ntags: [mytag]\n---\nContent')

      const result = await getTagsTool.execute({})
      expect(result.display).toContain('mytag')
      expect(result.display).toContain('(1)')
    })

    it('should return empty result when no files exist', async () => {
      mockFileSystem.getAllMarkdownFiles.mockResolvedValue([])

      const result = await getTagsTool.execute({})
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })
})
