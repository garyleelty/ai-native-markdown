import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AgentContext } from '../types'

// Top-level mocks so they apply to the imported module
const mockGetBacklinks = vi.fn()
const mockGetUnlinkedMentions = vi.fn()
const mockGetAllMarkdownFiles = vi.fn()
const mockBuildGraphData = vi.fn()

vi.mock('@/services/knowledgeIndex', () => ({
  knowledgeIndex: {
    getBacklinks: mockGetBacklinks,
    getUnlinkedMentions: mockGetUnlinkedMentions,
    buildGraphData: mockBuildGraphData
  }
}))

vi.mock('@/services/fileSystem', () => ({
  fileSystem: {
    getAllMarkdownFiles: mockGetAllMarkdownFiles
  }
}))

describe('ContextBuilder', () => {
  let contextBuilder: {
    build: (options?: {
      currentFile?: { path: string; content: string }
      recentFiles?: string[]
      withRag?: boolean
    }) => Promise<AgentContext>
  }

  beforeEach(async () => {
    vi.resetModules()

    // Set default mock implementations
    mockGetBacklinks.mockResolvedValue([{ filePath: '/backlink.md', title: 'Test', excerpt: 'Reference' }])
    mockGetUnlinkedMentions.mockResolvedValue([{ filePath: '/mention.md', title: 'Test', excerpt: 'Mention' }])
    mockGetAllMarkdownFiles.mockResolvedValue([
      { path: '/test1.md' },
      { path: '/test2.md' },
      { path: '/test3.md' }
    ])

    const module = await import('../contextBuilder')
    contextBuilder = module.contextBuilder
  })

  it('should build context with current file', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Test content' }
    })
    expect(ctx).toHaveProperty('currentFile')
    expect(ctx.currentFile).toHaveProperty('path', '/test.md')
    expect(ctx.currentFile).toHaveProperty('content', 'Test content')
  })

  it('should include recent files in context', async () => {
    const recent = ['/file1.md', '/file2.md']
    const ctx = await contextBuilder.build({ recentFiles: recent })
    expect(ctx.recentFiles).toEqual(recent)
  })

  it('should parse frontmatter tags from current file', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: '---\ntags: [a, b]\n---\nContent' }
    })
    expect(ctx.currentFile).toHaveProperty('tags')
    expect(Array.isArray(ctx.currentFile!.tags)).toBe(true)
  })

  it('should include backlinks in context', async () => {
    const ctx = await contextBuilder.build()
    expect(ctx).toHaveProperty('backlinks')
    expect(Array.isArray(ctx.backlinks)).toBe(true)
  })

  it('should include mentions in context', async () => {
    const ctx = await contextBuilder.build()
    expect(ctx).toHaveProperty('mentions')
    expect(Array.isArray(ctx.mentions)).toBe(true)
  })

  it('should return null currentFile when no currentFile option provided', async () => {
    const ctx = await contextBuilder.build()
    expect(ctx.currentFile).toBeNull()
  })

  it('should return empty backlinks and mentions when no currentFile', async () => {
    const ctx = await contextBuilder.build()
    expect(ctx.backlinks).toEqual([])
    expect(ctx.mentions).toEqual([])
  })

  it('should parse frontmatter tags as comma-separated string', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: '---\ntags: tag1, tag2, tag3\n---\nContent' }
    })
    expect(ctx.currentFile!.tags).toEqual(['tag1', 'tag2', 'tag3'])
  })

  it('should parse frontmatter tags as array', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: '---\ntags:\n  - alpha\n  - beta\n---\nContent' }
    })
    expect(ctx.currentFile!.tags).toEqual(['alpha', 'beta'])
  })

  it('should default to empty tags array when frontmatter has no tags', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: '---\ntitle: Test\n---\nContent' }
    })
    expect(ctx.currentFile!.tags).toEqual([])
  })

  it('should include backlinks when currentFile is provided', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' }
    })
    expect(ctx.backlinks).toEqual([{ path: '/backlink.md', context: 'Reference' }])
  })

  it('should include mentions when currentFile is provided', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' }
    })
    expect(ctx.mentions).toEqual([{ path: '/mention.md', context: 'Mention' }])
  })

  it('should ignore getBacklinks errors and return empty backlinks', async () => {
    mockGetBacklinks.mockRejectedValueOnce(new Error('DB error'))

    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' }
    })
    expect(ctx.backlinks).toEqual([])
  })

  it('should ignore getUnlinkedMentions errors and return empty mentions', async () => {
    mockGetUnlinkedMentions.mockRejectedValueOnce(new Error('DB error'))

    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' }
    })
    expect(ctx.mentions).toEqual([])
  })

  it('should fetch recent files from fileSystem when not provided', async () => {
    const ctx = await contextBuilder.build()
    expect(ctx.recentFiles).toEqual(['/test1.md', '/test2.md', '/test3.md'])
  })

  it('should ignore getAllMarkdownFiles errors and return empty recentFiles', async () => {
    mockGetAllMarkdownFiles.mockRejectedValueOnce(new Error('FS error'))

    const ctx = await contextBuilder.build()
    expect(ctx.recentFiles).toEqual([])
  })

  it('should limit default recentFiles to 10', async () => {
    const manyFiles = Array.from({ length: 15 }, (_, i) => ({ path: `/file${i}.md` }))
    mockGetAllMarkdownFiles.mockResolvedValueOnce(manyFiles)

    const ctx = await contextBuilder.build()
    expect(ctx.recentFiles.length).toBe(10)
  })

  it('should include ragContext when withRag is true and currentFile exists', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' },
      withRag: true
    })
    expect(ctx).toHaveProperty('ragContext')
  })

  it('should not include ragContext when withRag is true but no currentFile', async () => {
    const ctx = await contextBuilder.build({ withRag: true })
    expect(ctx.ragContext).toBeUndefined()
  })

  it('should not include ragContext when withRag is not set', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: 'Content' }
    })
    expect(ctx.ragContext).toBeUndefined()
  })

  it('should preserve frontmatter in currentFile', async () => {
    const ctx = await contextBuilder.build({
      currentFile: { path: '/test.md', content: '---\ntitle: My Note\nauthor: Test\n---\nContent' }
    })
    expect(ctx.currentFile!.frontmatter).toBeDefined()
    expect(ctx.currentFile!.frontmatter!.title).toBe('My Note')
  })
  describe('withGraphInsights', () => {
    const mockBuildGraphData = vi.fn()

    beforeEach(async () => {
      vi.resetModules()

      vi.doMock('@/services/knowledgeIndex', () => ({
        knowledgeIndex: {
          getBacklinks: mockGetBacklinks,
          getUnlinkedMentions: mockGetUnlinkedMentions,
          buildGraphData: mockBuildGraphData,
        }
      }))

      mockGetBacklinks.mockResolvedValue([])
      mockGetUnlinkedMentions.mockResolvedValue([])
      mockGetAllMarkdownFiles.mockResolvedValue([])
      mockBuildGraphData.mockResolvedValue({
        nodes: [],
        edges: [],
        stats: { totalNodes: 0, totalEdges: 0, orphanCount: 0 },
      })
    })

    it('should include graphInsights when withGraphInsights is true', async () => {
      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build({ withGraphInsights: true })
      expect(ctx).toHaveProperty('graphInsights')
      expect(ctx.graphInsights).toBeDefined()
      expect(ctx.graphInsights!.totalNotes).toBe(0)
      expect(ctx.graphInsights!.totalLinks).toBe(0)
      expect(ctx.graphInsights!.orphanCount).toBe(0)
    })

    it('should not include graphInsights when withGraphInsights is not set', async () => {
      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build()
      expect(ctx.graphInsights).toBeUndefined()
    })

    it('should include currentNotePosition when currentFile matches a graph node', async () => {
      mockBuildGraphData.mockResolvedValue({
        nodes: [
          { id: '/test.md', label: 'Test', path: '/test.md', tags: ['a'], linkCount: 3, isOrphan: false },
        ],
        edges: [],
        stats: { totalNodes: 1, totalEdges: 0, orphanCount: 0 },
      })
      mockGetBacklinks.mockResolvedValue([
        { filePath: '/backlink.md', title: 'Back', excerpt: 'ref' }
      ])

      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build({
        currentFile: { path: '/test.md', content: '---\ntags: [a]\n---\nContent' },
        withGraphInsights: true,
      })
      expect(ctx.graphInsights!.currentNotePosition).toBeDefined()
      expect(ctx.graphInsights!.currentNotePosition!.linkCount).toBe(3)
      expect(ctx.graphInsights!.currentNotePosition!.isOrphan).toBe(false)
    })

    it('should include suggestions for orphan notes', async () => {
      mockBuildGraphData.mockResolvedValue({
        nodes: [
          { id: '/current.md', label: 'Current', path: '/current.md', tags: [], linkCount: 0, isOrphan: true },
          { id: '/other.md', label: 'Other', path: '/other.md', tags: [], linkCount: 0, isOrphan: true },
        ],
        edges: [],
        stats: { totalNodes: 2, totalEdges: 0, orphanCount: 2 },
      })

      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build({
        currentFile: { path: '/current.md', content: 'Content' },
        withGraphInsights: true,
      })
      expect(ctx.graphInsights!.suggestions).toBeDefined()
      const orphanSuggestions = ctx.graphInsights!.suggestions!.filter(s => s.type === 'connect-orphan')
      expect(orphanSuggestions.length).toBeGreaterThan(0)
    })

    it('should include similar-topic suggestions based on shared tags', async () => {
      mockBuildGraphData.mockResolvedValue({
        nodes: [
          { id: '/current.md', label: 'Current', path: '/current.md', tags: ['vue'], linkCount: 1, isOrphan: false },
          { id: '/similar.md', label: 'Similar', path: '/similar.md', tags: ['vue'], linkCount: 1, isOrphan: false },
        ],
        edges: [],
        stats: { totalNodes: 2, totalEdges: 0, orphanCount: 0 },
      })

      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build({
        currentFile: { path: '/current.md', content: '---\ntags: [vue]\n---\nContent' },
        withGraphInsights: true,
      })
      const similarSuggestions = ctx.graphInsights!.suggestions?.filter(s => s.type === 'similar-topic') ?? []
      expect(similarSuggestions.length).toBeGreaterThan(0)
      expect(similarSuggestions[0].reason).toContain('vue')
    })

    it('should limit suggestions to 10', async () => {
      const manyNodes = [
        { id: '/current.md', label: 'Current', path: '/current.md', tags: ['tag1'], linkCount: 0, isOrphan: true },
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `/orphan${i}.md`, label: `Orphan ${i}`, path: `/orphan${i}.md`, tags: [], linkCount: 0, isOrphan: true,
        })),
      ]
      mockBuildGraphData.mockResolvedValue({
        nodes: manyNodes,
        edges: [],
        stats: { totalNodes: manyNodes.length, totalEdges: 0, orphanCount: manyNodes.length },
      })

      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      const ctx = await builder.build({
        currentFile: { path: '/current.md', content: 'Content' },
        withGraphInsights: true,
      })
      expect(ctx.graphInsights!.suggestions!.length).toBeLessThanOrEqual(10)
    })

    it('should propagate buildGraphData errors', async () => {
      mockBuildGraphData.mockRejectedValue(new Error('Graph DB error'))

      const module = await import('../contextBuilder')
      const builder = module.contextBuilder

      await expect(builder.build({ withGraphInsights: true })).rejects.toThrow('Graph DB error')
    })
  })

})
