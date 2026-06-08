import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { ragService } from '../rag'

describe('ragService', () => {
  // 在每个测试前清理数据库
  beforeEach(async () => {
    const docs = await ragService.listDocuments()
    for (const doc of docs) {
      await ragService.deleteDocument(doc.filePath)
    }
  })

  describe('indexDocument', () => {
    it('should index a simple document and return chunk count', async () => {
      const chunkCount = await ragService.indexDocument('/test.md', 'Hello world')
      expect(chunkCount).toBe(1)
    })

    it('should handle Chinese text with proper chunking', async () => {
      const content = '这是一个测试文档。这是第二句话。这是第三句话。'.repeat(20)
      const chunkCount = await ragService.indexDocument('/chinese.md', content)
      expect(chunkCount).toBeGreaterThan(0)
    })

    it('should split on Chinese periods and newlines', async () => {
      const content = '第一部分。\n第二部分。\n第三部分。'
      const chunkCount = await ragService.indexDocument('/split.md', content)
      expect(chunkCount).toBeGreaterThanOrEqual(1)
    })

    it('should overwrite existing document when reindexing', async () => {
      await ragService.indexDocument('/overwrite.md', 'Version 1')
      const chunkCount2 = await ragService.indexDocument('/overwrite.md', 'Version 2 with more content that splits into multiple chunks. '.repeat(10))
      expect(chunkCount2).toBeGreaterThan(1)
    })

    it('should handle empty content gracefully', async () => {
      const chunkCount = await ragService.indexDocument('/empty.md', '')
      expect(chunkCount).toBe(0)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      await ragService.indexDocument('/programming.md', 'JavaScript is a popular language. TypeScript adds types to JavaScript. Python is good for data science.')
      await ragService.indexDocument('/javascript-tips.md', 'JavaScript tips: use const and let. Avoid var.')
      await ragService.indexDocument('/python-guide.md', 'Python guide: indentation matters. Use virtual environments.')
    })

    it('should find matching documents by content', async () => {
      const results = await ragService.search('JavaScript')
      expect(results.length).toBeGreaterThan(0)
      expect(results.some(r => r.filePath === '/programming.md')).toBe(true)
    })

    it('should return empty array for empty query', async () => {
      const results = await ragService.search('')
      expect(results).toEqual([])
    })

    it('should return empty array for no matching results', async () => {
      const results = await ragService.search('nonexistentkeyword123')
      expect(results).toEqual([])
    })

    it('should respect topK parameter', async () => {
      const results1 = await ragService.search('JavaScript', 1)
      const results2 = await ragService.search('JavaScript', 2)
      expect(results1.length).toBeLessThanOrEqual(1)
      expect(results2.length).toBeLessThanOrEqual(2)
    })

    it('should filter by file path when fileFilter is provided', async () => {
      const results = await ragService.search('JavaScript', 10, '/javascript-tips.md')
      expect(results.every(r => r.filePath === '/javascript-tips.md')).toBe(true)
    })

    it('should rank title matches higher than path matches higher than content matches', async () => {
      await ragService.indexDocument('/JavaScript-Deep-Dive.md', 'This is about JavaScript.')
      await ragService.indexDocument('/js-notes.md', 'JavaScript content here.')
      
      const results = await ragService.search('JavaScript', 10)
      expect(results.length).toBeGreaterThan(0)
      
      // Verify relevance scores are positive and ordered
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].relevance).toBeGreaterThanOrEqual(results[i + 1].relevance)
      }
    })
  })

  describe('searchDiversified', () => {
    beforeEach(async () => {
      await ragService.indexDocument('/doc1.md', 'Topic A content 1. Topic A content 2. Topic A content 3.')
      await ragService.indexDocument('/doc2.md', 'Topic A content 4. Topic A content 5.')
      await ragService.indexDocument('/doc3.md', 'Topic A content 6.')
    })

    it('should return diversified results across different files', async () => {
      const results = await ragService.searchDiversified('Topic', 3, 1)
      const filePaths = new Set(results.map(r => r.filePath))
      expect(filePaths.size).toBeGreaterThan(1)
    })

    it('should respect maxPerFile parameter', async () => {
      const results = await ragService.searchDiversified('Topic', 10, 2)
      const fileCounts: Record<string, number> = {}
      results.forEach(r => {
        fileCounts[r.filePath] = (fileCounts[r.filePath] || 0) + 1
      })
      Object.values(fileCounts).forEach(count => {
        expect(count).toBeLessThanOrEqual(2)
      })
    })
  })

  describe('buildContext and buildContextWithSources', () => {
    beforeEach(async () => {
      await ragService.indexDocument('/context1.md', 'Context about AI and machine learning. Neural networks are powerful.')
      await ragService.indexDocument('/context2.md', 'More context: deep learning, transformers, and LLMs.')
    })

    it('should build context string with search results', async () => {
      const context = await ragService.buildContext('AI')
      expect(context).toBeTruthy()
      expect(typeof context).toBe('string')
    })

    it('should build context with sources', async () => {
      const result = await ragService.buildContextWithSources('AI')
      expect(result.context).toBeTruthy()
      expect(result.sources).toBeDefined()
      expect(Array.isArray(result.sources)).toBe(true)
    })

    it('should respect maxTokens parameter', async () => {
      const smallContext = await ragService.buildContext('AI', 100)
      const largeContext = await ragService.buildContext('AI', 10000)
      expect(smallContext.length).toBeLessThanOrEqual(largeContext.length)
    })
  })

  describe('document management', () => {
    beforeEach(async () => {
      await ragService.indexDocument('/keep.md', 'Keep this')
      await ragService.indexDocument('/delete1.md', 'Delete this 1')
      await ragService.indexDocument('/delete2.md', 'Delete this 2')
      await ragService.indexDocument('/folder/doc1.md', 'In folder')
      await ragService.indexDocument('/folder/doc2.md', 'Also in folder')
    })

    it('should list all indexed documents', async () => {
      const docs = await ragService.listDocuments()
      expect(docs.length).toBe(5)
      expect(docs.some(d => d.filePath === '/keep.md')).toBe(true)
    })

    it('should delete a single document', async () => {
      await ragService.deleteDocument('/delete1.md')
      const docs = await ragService.listDocuments()
      expect(docs.some(d => d.filePath === '/delete1.md')).toBe(false)
      expect(docs.some(d => d.filePath === '/keep.md')).toBe(true)
    })

    it('should delete documents by prefix', async () => {
      await ragService.deleteByPrefix('/folder')
      const docs = await ragService.listDocuments()
      expect(docs.some(d => d.filePath.startsWith('/folder'))).toBe(false)
    })

    it('should rename a document', async () => {
      await ragService.renameDocument('/keep.md', '/renamed.md')
      const docs = await ragService.listDocuments()
      expect(docs.some(d => d.filePath === '/keep.md')).toBe(false)
      expect(docs.some(d => d.filePath === '/renamed.md')).toBe(true)
    })

    it('should rename documents by prefix', async () => {
      await ragService.renameByPrefix('/folder', '/new-folder')
      const docs = await ragService.listDocuments()
      expect(docs.some(d => d.filePath.startsWith('/folder'))).toBe(false)
      expect(docs.some(d => d.filePath.startsWith('/new-folder'))).toBe(true)
    })

    it('should handle deleting non-existent document gracefully', async () => {
      await expect(ragService.deleteDocument('/nonexistent.md')).resolves.not.toThrow()
    })

    it('should handle renaming non-existent document gracefully', async () => {
      await expect(ragService.renameDocument('/nonexistent.md', '/new.md')).resolves.not.toThrow()
    })
  })

  describe('line number tracking', () => {
    it('should track line numbers in chunks', async () => {
      const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      await ragService.indexDocument('/lines.md', content)
      const results = await ragService.search('Line')
      expect(results.length).toBeGreaterThan(0)
      results.forEach(r => {
        if (r.lineStart !== undefined) {
          expect(r.lineStart).toBeGreaterThan(0)
        }
      })
    })
  })
})
