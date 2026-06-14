import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockBuildGraphData, mockGetByPath, mockGetBacklinks } = vi.hoisted(() => ({
  mockBuildGraphData: vi.fn(),
  mockGetByPath: vi.fn(),
  mockGetBacklinks: vi.fn(),
}))

vi.mock('@/services/knowledgeIndex', () => ({
  knowledgeIndex: {
    buildGraphData: mockBuildGraphData,
    getByPath: mockGetByPath,
    getBacklinks: mockGetBacklinks,
  }
}))

import { recommendConnectionsTool } from '../tools/recommendConnections'

function makeGraphData(overrides: {
  nodes?: Array<{ id: string; label: string; path: string; tags: string[]; linkCount: number; isOrphan: boolean }>
  edges?: Array<{ source: string; target: string; weight: number }>
  stats?: { totalNodes: number; totalEdges: number; orphanCount: number }
} = {}) {
  return {
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    stats: overrides.stats ?? { totalNodes: 0, totalEdges: 0, orphanCount: 0 },
  }
}

describe('recommendConnectionsTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return error when current note is not found', async () => {
    mockGetByPath.mockResolvedValueOnce(null)
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData())

    const result = await recommendConnectionsTool.execute({ currentPath: '/missing.md' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('找不到笔记')
  })

  it('should suggest connecting orphan notes', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: [] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: [], linkCount: 0, isOrphan: true },
        { id: 'orphan1', label: 'Orphan 1', path: '/orphan1.md', tags: [], linkCount: 0, isOrphan: true },
        { id: 'orphan2', label: 'Orphan 2', path: '/orphan2.md', tags: [], linkCount: 0, isOrphan: true },
      ],
      stats: { totalNodes: 3, totalEdges: 0, orphanCount: 3 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<{ type: string }>
    const orphanSuggestions = data.filter(s => s.type === 'connect-orphan')
    expect(orphanSuggestions.length).toBeGreaterThan(0)
  })

  it('should suggest similar-topic based on shared tags', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: ['vue', 'frontend'] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: ['vue', 'frontend'], linkCount: 1, isOrphan: false },
        { id: 'similar', label: 'Similar', path: '/similar.md', tags: ['vue', 'testing'], linkCount: 2, isOrphan: false },
      ],
      edges: [{ source: '/other.md', target: '/similar.md', weight: 1 }],
      stats: { totalNodes: 2, totalEdges: 1, orphanCount: 0 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<{ type: string; reason: string }>
    const similarSuggestions = data.filter(s => s.type === 'similar-topic')
    expect(similarSuggestions.length).toBeGreaterThan(0)
    expect(similarSuggestions[0].reason).toContain('vue')
  })

  it('should suggest missing-link for high connectivity notes', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: [] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: [], linkCount: 0, isOrphan: true },
        { id: 'popular', label: 'Popular', path: '/popular.md', tags: [], linkCount: 5, isOrphan: false },
      ],
      edges: Array.from({ length: 5 }, (_, i) => ({ source: '/link' + i + '.md', target: '/popular.md', weight: 1 })),
      stats: { totalNodes: 2, totalEdges: 5, orphanCount: 1 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<{ type: string }>
    const missingLinkSuggestions = data.filter(s => s.type === 'missing-link')
    expect(missingLinkSuggestions.length).toBeGreaterThan(0)
  })

  it('should respect limit parameter', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: ['tag1'] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: ['tag1'], linkCount: 0, isOrphan: true },
        ...Array.from({ length: 8 }, (_, i) => ({
          id: 'orphan' + i, label: 'Orphan ' + i, path: '/orphan' + i + '.md', tags: ['tag1'], linkCount: 0, isOrphan: true,
        })),
      ],
      stats: { totalNodes: 9, totalEdges: 0, orphanCount: 9 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md', limit: 3 })
    expect(result.success).toBe(true)
    const data = result.data as Array<unknown>
    expect(data.length).toBeLessThanOrEqual(3)
  })

  it('should exclude already-linked notes from suggestions', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: ['vue'] })
    mockGetBacklinks.mockResolvedValueOnce([{ filePath: '/linked.md', title: 'Linked', excerpt: 'ref' }])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: ['vue'], linkCount: 1, isOrphan: false },
        { id: 'linked', label: 'Linked', path: '/linked.md', tags: ['vue'], linkCount: 1, isOrphan: false },
        { id: 'unlinked', label: 'Unlinked', path: '/unlinked.md', tags: ['vue'], linkCount: 0, isOrphan: true },
      ],
      edges: [{ source: '/linked.md', target: '/current.md', weight: 1 }],
      stats: { totalNodes: 3, totalEdges: 1, orphanCount: 1 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<{ path: string }>
    const linkedPaths = data.map(s => s.path)
    expect(linkedPaths).not.toContain('/linked.md')
  })

  it('should sort suggestions by priority (connect-orphan > similar-topic > missing-link)', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: ['tag1'] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [
        { id: 'current', label: 'Current', path: '/current.md', tags: ['tag1'], linkCount: 0, isOrphan: true },
        { id: 'orphan', label: 'Orphan', path: '/orphan.md', tags: [], linkCount: 0, isOrphan: true },
        { id: 'similar', label: 'Similar', path: '/similar.md', tags: ['tag1'], linkCount: 1, isOrphan: false },
        { id: 'popular', label: 'Popular', path: '/popular.md', tags: [], linkCount: 5, isOrphan: false },
      ],
      edges: Array.from({ length: 5 }, (_, i) => ({ source: '/link' + i + '.md', target: '/popular.md', weight: 1 })),
      stats: { totalNodes: 4, totalEdges: 5, orphanCount: 2 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<{ type: string }>
    const types = data.map(s => s.type)
    const orphanIdx = types.indexOf('connect-orphan')
    const similarIdx = types.indexOf('similar-topic')
    const missingIdx = types.indexOf('missing-link')
    if (orphanIdx >= 0 && similarIdx >= 0) expect(orphanIdx).toBeLessThan(similarIdx)
    if (similarIdx >= 0 && missingIdx >= 0) expect(similarIdx).toBeLessThan(missingIdx)
  })

  it('should include display text with graph stats', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: [] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [{ id: 'current', label: 'Current', path: '/current.md', tags: [], linkCount: 0, isOrphan: true }],
      stats: { totalNodes: 1, totalEdges: 0, orphanCount: 1 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    expect(result.display).toContain('知识图谱分析结果')
    expect(result.display).toContain('Current')
  })

  it('should handle buildGraphData errors gracefully', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: [] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockRejectedValueOnce(new Error('DB error'))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('分析失败')
  })

  it('should return empty suggestions when no connections can be recommended', async () => {
    mockGetByPath.mockResolvedValueOnce({ filePath: '/current.md', title: 'Current', tags: [] })
    mockGetBacklinks.mockResolvedValueOnce([])
    mockBuildGraphData.mockResolvedValueOnce(makeGraphData({
      nodes: [{ id: 'current', label: 'Current', path: '/current.md', tags: [], linkCount: 5, isOrphan: false }],
      edges: Array.from({ length: 5 }, (_, i) => ({ source: '/link' + i + '.md', target: '/current.md', weight: 1 })),
      stats: { totalNodes: 1, totalEdges: 5, orphanCount: 0 },
    }))

    const result = await recommendConnectionsTool.execute({ currentPath: '/current.md' })
    expect(result.success).toBe(true)
    const data = result.data as Array<unknown>
    expect(data).toEqual([])
  })
})
