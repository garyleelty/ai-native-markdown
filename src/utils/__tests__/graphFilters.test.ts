import { describe, expect, it } from 'vitest'
import type { KnowledgeGraphData } from '@/types'
import { filterGraphData, getAvailableGraphDirectories, getAvailableGraphTags } from '../graphFilters'

const graph: KnowledgeGraphData = {
  nodes: [
    { id: '/workspace/a.md', path: '/workspace/a.md', label: 'Alpha', tags: ['x'], linkCount: 2, isOrphan: false },
    { id: '/workspace/folder/b.md', path: '/workspace/folder/b.md', label: 'Beta', tags: ['x', 'y'], linkCount: 2, isOrphan: false },
    { id: '/workspace/folder/c.md', path: '/workspace/folder/c.md', label: 'Gamma', tags: ['y'], linkCount: 1, isOrphan: false },
    { id: '/workspace/other/d.md', path: '/workspace/other/d.md', label: 'Delta', tags: [], linkCount: 1, isOrphan: false },
  ],
  edges: [
    { source: '/workspace/a.md', target: '/workspace/folder/b.md', weight: 1 },
    { source: '/workspace/folder/b.md', target: '/workspace/folder/c.md', weight: 1 },
    { source: '/workspace/folder/c.md', target: '/workspace/other/d.md', weight: 1 },
  ],
  stats: { totalNodes: 4, totalEdges: 3, orphanCount: 0, avgLinkCount: 1.5 },
}

describe('graphFilters', () => {
  it('returns equivalent graph for empty filters with rebuilt stats', () => {
    const result = filterGraphData(graph, {})
    expect(result.nodes.map(node => node.id)).toHaveLength(4)
    expect(result.stats.totalEdges).toBe(3)
  })

  it('filters by tag and recomputes local link counts', () => {
    const result = filterGraphData(graph, { tags: ['x'] })
    expect(result.nodes.map(node => node.id)).toEqual(['/workspace/a.md', '/workspace/folder/b.md'])
    expect(result.edges).toHaveLength(1)
    expect(result.nodes.every(node => node.linkCount === 1 && !node.isOrphan)).toBe(true)
  })

  it('filters by directory prefix', () => {
    const result = filterGraphData(graph, { pathPrefix: '/workspace/folder' })
    expect(result.nodes.map(node => node.id)).toEqual(['/workspace/folder/b.md', '/workspace/folder/c.md'])
    expect(result.edges).toHaveLength(1)
  })

  it('filters by depth from current file', () => {
    const result = filterGraphData(graph, { currentFile: '/workspace/a.md', maxDepth: 1 })
    expect(result.nodes.map(node => node.id)).toEqual(['/workspace/a.md', '/workspace/folder/b.md'])
  })

  it('search includes matched nodes and direct neighbors', () => {
    const result = filterGraphData(graph, { searchText: 'Beta' })
    expect(result.nodes.map(node => node.id).sort()).toEqual(['/workspace/a.md', '/workspace/folder/b.md', '/workspace/folder/c.md'].sort())
  })

  it('lists available tags and directories', () => {
    expect(getAvailableGraphTags(graph)).toEqual(['x', 'y'])
    expect(getAvailableGraphDirectories(graph)).toEqual(['/workspace', '/workspace/folder', '/workspace/other'])
  })
})
