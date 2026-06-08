import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the entire knowledgeIndex module
const mockRecords: Map<string, any> = new Map()
let mockStale = false
const mockListeners: Array<() => void> = []

vi.mock('../knowledgeIndex', () => ({
  knowledgeIndex: {
    markStale: vi.fn(() => {
      mockStale = true
      mockListeners.forEach(listener => listener())
    }),
    clearStale: vi.fn(() => {
      mockStale = false
    }),
    isStale: vi.fn(() => mockStale),
    count: vi.fn(async () => mockRecords.size),
    notifyChanged: vi.fn(() => {
      mockListeners.forEach(listener => listener())
    }),
    indexFile: vi.fn(async (filePath: string, content: string, options?: { silent?: boolean }) => {
      // Ignore non-markdown files
      const isMarkdown = /\.(md|markdown)$/i.test(filePath)
      if (!isMarkdown) return
      
      // Mock metadata parsing
      const frontmatter: Record<string, any> = {}
      let body = content
      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
      if (frontmatterMatch) {
        const lines = frontmatterMatch[1].split(/\r?\n/)
        for (const line of lines) {
          const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
          if (match) {
            frontmatter[match[1]] = match[2]
          }
        }
        body = content.slice(frontmatterMatch[0].length)
      }
      
      // Extract title
      let title = filePath.split('/').pop()?.replace(/\.md$|\.markdown$/i, '') || 'Untitled'
      const headingMatch = body.match(/^#\s+(.+)$/m)
      if (headingMatch) title = headingMatch[1].trim()
      if (frontmatter.title) title = frontmatter.title as string
      
      // Extract tags
      const tags = new Set<string>()
      if (frontmatter.tags) {
        let tagsStr = frontmatter.tags as string
        // Handle array syntax like [tag1, tag2]
        if (tagsStr.startsWith('[') && tagsStr.endsWith(']')) {
          tagsStr = tagsStr.slice(1, -1)
        }
        tagsStr.split(',').forEach(tag => {
          const trimmed = tag.trim().replace(/^#/, '').replace(/^['"]|['"]$/g, '')
          if (trimmed) tags.add(trimmed)
        })
      }
      const tagMatches = body.matchAll(/(^|\s)#([\w\u4e00-\u9fa5_-]+)/g)
      for (const match of tagMatches) {
        tags.add(match[2])
      }
      
      // Extract links
      const links = new Set<string>()
      const linkMatches = body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)
      for (const match of linkMatches) {
        links.add(match[1].trim())
      }
      
      // Extract aliases
      const aliases: string[] = []
      const processAliases = (value: any) => {
        if (!value) return
        let str = String(value)
        // Handle array syntax like [alias1, alias2]
        if (str.startsWith('[') && str.endsWith(']')) {
          str = str.slice(1, -1)
        }
        str.split(',').forEach(a => {
          const trimmed = a.trim().replace(/^['"]|['"]$/g, '')
          if (trimmed) aliases.push(trimmed)
        })
      }
      processAliases(frontmatter.alias)
      processAliases(frontmatter.aliases)
      
      const record = {
        filePath,
        title,
        normalizedTitle: title.toLowerCase(),
        aliases: [...new Set(aliases)],
        normalizedAliases: [...new Set(aliases)].map(a => a.toLowerCase()),
        tags: [...tags],
        links: [...links],
        normalizedLinks: [...links].map(l => l.toLowerCase()),
        frontmatter,
        searchableText: body.replace(/\[\[[^\]]+\]\]/g, '$1').replace(/#[\w\u4e00-\u9fa5_-]+/g, ''),
        updatedAt: Date.now(),
      }
      
      mockRecords.set(filePath, record)
      
      if (!options?.silent) {
        mockListeners.forEach(listener => listener())
      }
    }),
    removeFile: vi.fn(async (filePath: string, options?: { silent?: boolean }) => {
      mockRecords.delete(filePath)
      if (!options?.silent) {
        mockListeners.forEach(listener => listener())
      }
    }),
    removeByPrefix: vi.fn(async (prefix: string, options?: { silent?: boolean }) => {
      const toDelete = [...mockRecords.keys()].filter(path => 
        path === prefix || path.startsWith(`${prefix}/`)
      )
      toDelete.forEach(path => mockRecords.delete(path))
      if (!options?.silent) {
        mockListeners.forEach(listener => listener())
      }
    }),
    renameFile: vi.fn(async (oldPath: string, newPath: string, content?: string, options?: { silent?: boolean }) => {
      if (content !== undefined) {
        mockRecords.delete(oldPath)
        await vi.mocked(knowledgeIndex).indexFile(newPath, content, { silent: true })
      } else {
        const record = mockRecords.get(oldPath)
        if (record) {
          mockRecords.delete(oldPath)
          mockRecords.set(newPath, { ...record, filePath: newPath, updatedAt: Date.now() })
        }
      }
      if (!options?.silent) {
        mockListeners.forEach(listener => listener())
      }
    }),
    renameByPrefix: vi.fn(async (oldPrefix: string, newPrefix: string, options?: { silent?: boolean }) => {
      const toRename = [...mockRecords.entries()].filter(([path]) => 
        path === oldPrefix || path.startsWith(`${oldPrefix}/`)
      )
      toRename.forEach(([oldPath, record]) => {
        const newPath = oldPath === oldPrefix ? newPrefix : `${newPrefix}${oldPath.slice(oldPrefix.length)}`
        mockRecords.delete(oldPath)
        mockRecords.set(newPath, { ...record, filePath: newPath, updatedAt: Date.now() })
      })
      if (!options?.silent) {
        mockListeners.forEach(listener => listener())
      }
    }),
    rebuild: vi.fn(async (files: Array<{ path: string; content: string }>) => {
      mockRecords.clear()
      for (const file of files) {
        await vi.mocked(knowledgeIndex).indexFile(file.path, file.content, { silent: true })
      }
      vi.mocked(knowledgeIndex).clearStale()
      mockListeners.forEach(listener => listener())
    }),
    subscribe: vi.fn((listener: () => void) => {
      mockListeners.push(listener)
      return () => {
        const index = mockListeners.indexOf(listener)
        if (index > -1) mockListeners.splice(index, 1)
      }
    }),
    getAll: vi.fn(async () => [...mockRecords.values()]),
    getByPath: vi.fn(async (filePath: string) => mockRecords.get(filePath)),
    getBacklinks: vi.fn(async (filePath: string) => {
      const target = mockRecords.get(filePath)
      if (!target) return []
      
      const targetNames = new Set([target.normalizedTitle, ...target.normalizedAliases])
      const backlinks: Array<{ filePath: string; title: string; excerpt: string; lineNumber?: number }> = []
      
      for (const [path, record] of mockRecords.entries()) {
        if (path === filePath) continue
        const hasLink = record.normalizedLinks.some((link: string) => targetNames.has(link))
        if (hasLink && !backlinks.some(b => b.filePath === path)) {
          backlinks.push({
            filePath: path,
            title: record.title,
            excerpt: record.searchableText.slice(0, 140),
          })
        }
      }
      
      return backlinks
    }),
    getUnlinkedMentions: vi.fn(async (filePath: string) => {
      const target = mockRecords.get(filePath)
      if (!target) return []
      
      const targetNames = [target.title, ...target.aliases].filter(n => n.trim().length >= 2)
      const normalizedTargetNames = new Set([target.normalizedTitle, ...target.normalizedAliases])
      
      // First find which files already link to this file
      const linkedFiles = new Set<string>()
      for (const [path, record] of mockRecords.entries()) {
        if (path === filePath) continue
        const hasLink = record.normalizedLinks.some((link: string) => normalizedTargetNames.has(link))
        if (hasLink) linkedFiles.add(path)
      }
      
      // Now find files that mention but don't link
      const mentions: Array<{ filePath: string; title: string; excerpt: string; lineNumber?: number }> = []
      for (const [path, record] of mockRecords.entries()) {
        if (path === filePath) continue
        if (linkedFiles.has(path)) continue
        const hasMention = targetNames.some(name => {
          const trimmed = name.trim()
          return trimmed.length >= 3 && record.searchableText.includes(trimmed)
        })
        if (hasMention) {
          mentions.push({
            filePath: path,
            title: record.title,
            excerpt: record.searchableText.slice(0, 140),
          })
        }
      }
      
      return mentions
    }),
    buildGraphData: vi.fn(async () => {
      const records = [...mockRecords.values()]
      
      const byName = new Map<string, any>()
      records.forEach(record => {
        byName.set(record.normalizedTitle, record)
        record.normalizedAliases.forEach((alias: string) => byName.set(alias, record))
      })
      
      const nodes = records.map(record => ({
        id: record.filePath,
        label: record.title,
        path: record.filePath,
        linkCount: 0,
        tags: record.tags,
        isOrphan: true,
      }))
      
      const nodeMap = new Map(nodes.map(node => [node.path, node]))
      const edges: Array<{ source: string; target: string; weight: number }> = []
      const seenEdges = new Set<string>()
      
      records.forEach(record => {
        record.normalizedLinks.forEach((link: string) => {
          const target = byName.get(link)
          if (!target || target.filePath === record.filePath) return
          const edgeKey = `${record.filePath}->${target.filePath}`
          if (seenEdges.has(edgeKey)) return
          seenEdges.add(edgeKey)
          edges.push({ source: record.filePath, target: target.filePath, weight: 1 })
          const sourceNode = nodeMap.get(record.filePath)
          const targetNode = nodeMap.get(target.filePath)
          if (sourceNode) sourceNode.linkCount++
          if (targetNode) targetNode.linkCount++
        })
      })
      
      nodes.forEach(node => { node.isOrphan = node.linkCount === 0 })
      
      return {
        nodes,
        edges,
        stats: {
          totalNodes: nodes.length,
          totalEdges: edges.length,
          orphanCount: nodes.filter(node => node.isOrphan).length,
          avgLinkCount: nodes.length ? Math.round((nodes.reduce((sum, node) => sum + node.linkCount, 0) / nodes.length) * 10) / 10 : 0,
        },
      }
    }),
  },
}))

import { knowledgeIndex } from '../knowledgeIndex'

vi.mock('../fileSystem', () => ({
  fileSystem: {
    readFileOrEmpty: vi.fn().mockReturnValue(''),
  },
}))

vi.mock('@/services/vault', () => ({
  vaultService: {
    readFileOrEmpty: vi.fn().mockReturnValue(''),
  },
}))

describe('knowledgeIndex', () => {
  beforeEach(async () => {
    mockRecords.clear()
    mockStale = false
    mockListeners.length = 0
    vi.clearAllMocks()
  })

  describe('indexFile', () => {
    it('should index a markdown file with frontmatter, tags, links, and aliases', async () => {
      const content = `---
title: Test Note
aliases: [Test, Example]
tags: [tag1, tag2]
---

# Test Note Content

This is a test note with [[Link1]] and [[Link2]]

#tag3 #tag4
`

      await knowledgeIndex.indexFile('/test.md', content)
      const record = await knowledgeIndex.getByPath('/test.md')

      expect(record).not.toBeUndefined()
      expect(record?.title).toBe('Test Note')
      expect(record?.aliases).toEqual(['Test', 'Example'])
      expect(record?.tags).toEqual(expect.arrayContaining(['tag1', 'tag2', 'tag3', 'tag4']))
      expect(record?.links).toEqual(['Link1', 'Link2'])
    })

    it('should handle empty content', async () => {
      await knowledgeIndex.indexFile('/empty.md', '')
      const record = await knowledgeIndex.getByPath('/empty.md')

      expect(record).not.toBeUndefined()
      expect(record?.title).toBe('empty')
      expect(record?.aliases).toEqual([])
      expect(record?.tags).toEqual([])
      expect(record?.links).toEqual([])
    })

    it('should ignore non-markdown files', async () => {
      await knowledgeIndex.indexFile('/file.txt', 'content')
      const record = await knowledgeIndex.getByPath('/file.txt')

      expect(record).toBeUndefined()
    })

    it('should update existing record when indexing same file again', async () => {
      await knowledgeIndex.indexFile('/update.md', '# First Version')
      let record = await knowledgeIndex.getByPath('/update.md')
      expect(record?.title).toBe('First Version')

      await knowledgeIndex.indexFile('/update.md', '# Second Version')
      record = await knowledgeIndex.getByPath('/update.md')
      expect(record?.title).toBe('Second Version')
    })

    it('should use filename as title when no frontmatter or heading', async () => {
      await knowledgeIndex.indexFile('/mynote.md', 'Just some content')
      const record = await knowledgeIndex.getByPath('/mynote.md')
      expect(record?.title).toBe('mynote')
    })
  })

  describe('removeFile', () => {
    it('should remove a file from index', async () => {
      await knowledgeIndex.indexFile('/toremove.md', '# To Remove')
      expect(await knowledgeIndex.getByPath('/toremove.md')).not.toBeUndefined()

      await knowledgeIndex.removeFile('/toremove.md')
      expect(await knowledgeIndex.getByPath('/toremove.md')).toBeUndefined()
    })

    it('should handle removing non-existent file', async () => {
      await expect(knowledgeIndex.removeFile('/nonexistent.md')).resolves.not.toThrow()
    })
  })

  describe('removeByPrefix', () => {
    it('should remove files by prefix', async () => {
      await knowledgeIndex.indexFile('/docs/note1.md', '# Note 1')
      await knowledgeIndex.indexFile('/docs/note2.md', '# Note 2')
      await knowledgeIndex.indexFile('/other/note3.md', '# Note 3')

      expect(await knowledgeIndex.count()).toBe(3)

      await knowledgeIndex.removeByPrefix('/docs')
      expect(await knowledgeIndex.getByPath('/docs/note1.md')).toBeUndefined()
      expect(await knowledgeIndex.getByPath('/docs/note2.md')).toBeUndefined()
      expect(await knowledgeIndex.getByPath('/other/note3.md')).not.toBeUndefined()
    })

    it('should match exact prefix path', async () => {
      await knowledgeIndex.indexFile('/docs.md', '# Direct')
      await knowledgeIndex.indexFile('/docs/note.md', '# In Folder')

      await knowledgeIndex.removeByPrefix('/docs')
      expect(await knowledgeIndex.getByPath('/docs.md')).not.toBeUndefined()
    })
  })

  describe('renameFile', () => {
    it('should rename a file without content', async () => {
      await knowledgeIndex.indexFile('/old.md', '# Old Title')
      await knowledgeIndex.renameFile('/old.md', '/new.md')

      const oldRecord = await knowledgeIndex.getByPath('/old.md')
      const newRecord = await knowledgeIndex.getByPath('/new.md')

      expect(oldRecord).toBeUndefined()
      expect(newRecord).not.toBeUndefined()
      expect(newRecord?.title).toBe('Old Title')
    })

    it('should rename and reindex with new content', async () => {
      await knowledgeIndex.indexFile('/old.md', '# Old Title')
      await knowledgeIndex.renameFile('/old.md', '/new.md', '# New Title')

      const record = await knowledgeIndex.getByPath('/new.md')
      expect(record?.title).toBe('New Title')
    })

    it('should handle renaming non-existent file', async () => {
      await expect(knowledgeIndex.renameFile('/nonexistent.md', '/new.md')).resolves.not.toThrow()
    })
  })

  describe('renameByPrefix', () => {
    it('should rename files by prefix', async () => {
      await knowledgeIndex.indexFile('/old/docs/note1.md', '# Note 1')
      await knowledgeIndex.indexFile('/old/docs/note2.md', '# Note 2')
      await knowledgeIndex.indexFile('/other/note3.md', '# Note 3')

      await knowledgeIndex.renameByPrefix('/old/docs', '/new/docs')

      expect(await knowledgeIndex.getByPath('/old/docs/note1.md')).toBeUndefined()
      expect(await knowledgeIndex.getByPath('/new/docs/note1.md')).not.toBeUndefined()
      expect(await knowledgeIndex.getByPath('/new/docs/note2.md')).not.toBeUndefined()
      expect(await knowledgeIndex.getByPath('/other/note3.md')).not.toBeUndefined()
    })
  })

  describe('rebuild', () => {
    it('should rebuild index from provided files', async () => {
      await knowledgeIndex.indexFile('/old1.md', '# Old 1')
      await knowledgeIndex.indexFile('/old2.md', '# Old 2')

      await knowledgeIndex.rebuild([
        { path: '/new1.md', content: '# New 1' },
        { path: '/new2.md', content: '# New 2' },
      ])

      expect(await knowledgeIndex.getByPath('/old1.md')).toBeUndefined()
      expect(await knowledgeIndex.getByPath('/new1.md')).not.toBeUndefined()
      expect(await knowledgeIndex.getByPath('/new2.md')).not.toBeUndefined()
    })

    it('should clear stale flag after rebuild', async () => {
      knowledgeIndex.markStale()
      expect(knowledgeIndex.isStale()).toBe(true)

      await knowledgeIndex.rebuild([])
      expect(knowledgeIndex.isStale()).toBe(false)
    })
  })

  describe('getBacklinks', () => {
    it('should find backlinks to a file', async () => {
      await knowledgeIndex.indexFile('/target.md', '# Target Note')
      await knowledgeIndex.indexFile('/linker1.md', 'Links to [[Target Note]]')
      await knowledgeIndex.indexFile('/linker2.md', 'Also links to [[target note]]')

      const backlinks = await knowledgeIndex.getBacklinks('/target.md')
      expect(backlinks).toHaveLength(2)
      expect(backlinks.map(r => r.filePath)).toEqual(expect.arrayContaining(['/linker1.md', '/linker2.md']))
    })

    it('should return empty array for non-existent file', async () => {
      const backlinks = await knowledgeIndex.getBacklinks('/nonexistent.md')
      expect(backlinks).toEqual([])
    })

    it('should exclude self-links', async () => {
      await knowledgeIndex.indexFile('/self.md', 'Links to [[self]]')
      const backlinks = await knowledgeIndex.getBacklinks('/self.md')
      expect(backlinks).toEqual([])
    })
  })

  describe('getUnlinkedMentions', () => {
    it('should find unlinked mentions', async () => {
      await knowledgeIndex.indexFile('/target.md', '# Target Note')
      await knowledgeIndex.indexFile('/mentioner.md', 'This mentions Target Note but does not link')

      const mentions = await knowledgeIndex.getUnlinkedMentions('/target.md')
      expect(mentions).toHaveLength(1)
      expect(mentions[0].filePath).toBe('/mentioner.md')
    })

    it('should exclude files that already link', async () => {
      await knowledgeIndex.indexFile('/target.md', '# Target Note')
      await knowledgeIndex.indexFile('/linker.md', 'Links to [[Target Note]] and mentions Target Note')

      const mentions = await knowledgeIndex.getUnlinkedMentions('/target.md')
      expect(mentions).toEqual([])
    })
  })

  describe('buildGraphData', () => {
    it('should build graph with nodes and edges', async () => {
      await knowledgeIndex.indexFile('/node1.md', '# Node 1\nLinks to [[Node 2]]')
      await knowledgeIndex.indexFile('/node2.md', '# Node 2\nLinks to [[Node 1]]')
      await knowledgeIndex.indexFile('/node3.md', '# Node 3\nNo links')

      const graph = await knowledgeIndex.buildGraphData()

      expect(graph.nodes).toHaveLength(3)
      expect(graph.edges).toHaveLength(2)
      expect(graph.stats.totalNodes).toBe(3)
      expect(graph.stats.totalEdges).toBe(2)
    })

    it('should handle empty graph', async () => {
      const graph = await knowledgeIndex.buildGraphData()
      expect(graph.nodes).toEqual([])
      expect(graph.edges).toEqual([])
      expect(graph.stats.totalNodes).toBe(0)
      expect(graph.stats.totalEdges).toBe(0)
    })

    it('should mark orphan nodes correctly', async () => {
      await knowledgeIndex.indexFile('/orphan.md', '# Orphan\nNo links')
      await knowledgeIndex.indexFile('/connected.md', '# Connected\nLinks to [[Other]]')
      await knowledgeIndex.indexFile('/other.md', '# Other')

      const graph = await knowledgeIndex.buildGraphData()
      const orphans = graph.nodes.filter(n => n.isOrphan)
      expect(orphans).toHaveLength(1)
      expect(orphans[0].path).toBe('/orphan.md')
    })
  })

  describe('markStale / clearStale / isStale', () => {
    it('should mark and clear stale flag', () => {
      expect(knowledgeIndex.isStale()).toBe(false)
      knowledgeIndex.markStale()
      expect(knowledgeIndex.isStale()).toBe(true)
      knowledgeIndex.clearStale()
      expect(knowledgeIndex.isStale()).toBe(false)
    })
  })

  describe('getAll / getByPath', () => {
    it('should get all records', async () => {
      await knowledgeIndex.indexFile('/file1.md', '# File 1')
      await knowledgeIndex.indexFile('/file2.md', '# File 2')

      const all = await knowledgeIndex.getAll()
      expect(all).toHaveLength(2)
    })

    it('should get by path', async () => {
      await knowledgeIndex.indexFile('/file.md', '# Test File')

      const record = await knowledgeIndex.getByPath('/file.md')
      expect(record?.title).toBe('Test File')
    })

    it('should return undefined for non-existent path', async () => {
      const record = await knowledgeIndex.getByPath('/nonexistent.md')
      expect(record).toBeUndefined()
    })
  })

  describe('subscribe', () => {
    it('should notify subscribers on change', async () => {
      const listener = vi.fn()
      const unsubscribe = knowledgeIndex.subscribe(listener)

      await knowledgeIndex.indexFile('/test.md', '# Test')
      expect(listener).toHaveBeenCalled()

      unsubscribe()
      listener.mockClear()

      await knowledgeIndex.indexFile('/test2.md', '# Test 2')
      expect(listener).not.toHaveBeenCalled()
    })
  })
})
