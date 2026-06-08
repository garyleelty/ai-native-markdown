import { describe, it, expect, beforeEach, vi } from 'vitest'
import 'fake-indexeddb/auto'
import type { RSSFeed, RSSArticle, RSSImportOptions } from '../../types'
import { rssService } from '../rss'

// 模拟 fileSystem
vi.mock('../../services/fileSystem', () => ({
  fileSystem: {
    createDirectory: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  }
}))

describe('RSS Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // 清空数据库
    const { rssDb } = await import('../rss')
    await rssDb.feeds.clear()
    await rssDb.articles.clear()
  })

  describe('Feed Management', () => {
    it('should add a new RSS feed', async () => {
      const feed = await rssService.addFeed('https://example.com/feed.xml', {
        title: 'Example Blog',
        description: 'A test blog'
      })

      expect(feed.id).toBeDefined()
      expect(feed.url).toBe('https://example.com/feed.xml')
      expect(feed.title).toBe('Example Blog')
      expect(feed.siteUrl).toBe('https://example.com')
      expect(feed.fetchIntervalMinutes).toBe(60)
      expect(feed.autoImport).toBe(false)
      expect(feed.importPath).toBe('/RSS/')
    })

    it('should update an existing feed', async () => {
      const feed = await rssService.addFeed('https://example.com/feed.xml')
      const updatedFeed = await rssService.updateFeed(feed.id, {
        title: 'New Title',
        fetchIntervalMinutes: 120
      })

      expect(updatedFeed.title).toBe('New Title')
      expect(updatedFeed.fetchIntervalMinutes).toBe(120)
    })

    it('should delete a feed and its articles', async () => {
      const feed = await rssService.addFeed('https://example.com/feed.xml')
      await rssService.addArticles(feed.id, [{
        title: 'Test Article',
        link: 'https://example.com/test',
        guid: 'test-guid'
      }])

      expect(await rssService.getFeeds()).toHaveLength(1)
      expect(await rssService.getArticles(feed.id)).toHaveLength(1)

      await rssService.deleteFeed(feed.id)

      expect(await rssService.getFeeds()).toHaveLength(0)
      expect(await rssService.getArticles(feed.id)).toHaveLength(0)
    })

    it('should get all feeds', async () => {
      await rssService.addFeed('https://example1.com/feed.xml', { title: 'Blog 1' })
      await rssService.addFeed('https://example2.com/feed.xml', { title: 'Blog 2' })

      const feeds = await rssService.getFeeds()
      expect(feeds).toHaveLength(2)
      expect(feeds.map(f => f.title)).toContain('Blog 1')
      expect(feeds.map(f => f.title)).toContain('Blog 2')
    })
  })

  describe('Article Management', () => {
    it('should add articles to a feed', async () => {
      const feed = await rssService.addFeed('https://example.com/feed.xml')
      await rssService.addArticles(feed.id, [
        {
          title: 'Article 1',
          link: 'https://example.com/1',
          guid: 'guid-1',
          pubDate: Date.now() - 86400000
        },
        {
          title: 'Article 2',
          link: 'https://example.com/2',
          guid: 'guid-2',
          pubDate: Date.now()
        }
      ])

      const articles = await rssService.getArticles(feed.id)
      expect(articles).toHaveLength(2)
      expect(articles[0].title).toBe('Article 2')
      expect(articles[1].title).toBe('Article 1')
    })

    it('should mark an article as imported', async () => {
      const feed = await rssService.addFeed('https://example.com/feed.xml')
      await rssService.addArticles(feed.id, [{
        title: 'Test Article',
        link: 'https://example.com/test',
        guid: 'test-guid'
      }])

      const articles = await rssService.getArticles(feed.id)
      expect(articles[0].isImported).toBe(false)

      await rssService.markImported(articles[0].id, '/RSS/test-article.md')

      const updatedArticles = await rssService.getArticles(feed.id)
      expect(updatedArticles[0].isImported).toBe(true)
      expect(updatedArticles[0].importedPath).toBe('/RSS/test-article.md')
      expect(updatedArticles[0].importedAt).toBeDefined()
    })
  })

  describe('Article to Markdown', () => {
    it('should convert article to markdown', async () => {
      const article: RSSArticle = {
        id: 'test',
        feedId: 'feed1',
        guid: 'guid1',
        title: 'Test Article',
        link: 'https://example.com/test',
        pubDate: Date.now(),
        author: 'Test Author',
        description: 'A test article',
        content: '<p>This is a <strong>test</strong> article.</p><p>It has multiple paragraphs.</p>',
        categories: ['test', 'rss'],
        isImported: false,
        createdAt: Date.now()
      }

      const chunks = await rssService.articleToMarkdown(article, { chunkSize: 5000 })
      expect(chunks).toHaveLength(1)
      expect(chunks[0]).toContain('title: "Test Article"')
      expect(chunks[0]).toContain('author: "Test Author"')
      expect(chunks[0]).toContain('This is a **test** article')
      expect(chunks[0]).toContain('tags: ["test","rss"]')
    })

    it('should split long articles into chunks', async () => {
      const longContent = Array(50).fill('This is a long paragraph. ').join('\n\n')
      const article: RSSArticle = {
        id: 'test',
        feedId: 'feed1',
        guid: 'guid1',
        title: 'Long Article',
        link: 'https://example.com/long',
        pubDate: Date.now(),
        description: '',
        content: `<p>${longContent}</p>`,
        categories: [],
        isImported: false,
        createdAt: Date.now()
      }

      const chunks = await rssService.articleToMarkdown(article, { chunkSize: 200 })
      expect(chunks.length).toBeGreaterThan(1)
      chunks.forEach(chunk => {
        expect(chunk.length).toBeLessThanOrEqual(300)
      })
    })

    it('should respect includeImages and includeLinks options', async () => {
      const article: RSSArticle = {
        id: 'test',
        feedId: 'feed1',
        guid: 'guid1',
        title: 'Article with Media',
        link: 'https://example.com/test',
        pubDate: Date.now(),
        description: '',
        content: '<p><img src="test.jpg" alt="Test"> <a href="https://link.com">Link</a></p>',
        categories: [],
        isImported: false,
        createdAt: Date.now()
      }

      const chunks1 = await rssService.articleToMarkdown(article, {
        includeImages: false,
        includeLinks: false
      })
      expect(chunks1[0]).not.toContain('img')
      expect(chunks1[0]).not.toContain('https://link.com')
      expect(chunks1[0]).toContain('Link')

      const chunks2 = await rssService.articleToMarkdown(article, {
        includeImages: true,
        includeLinks: true
      })
      expect(chunks2[0]).toBeDefined()
    })

    it('should use custom template', async () => {
      const article: RSSArticle = {
        id: 'test',
        feedId: 'feed1',
        guid: 'guid1',
        title: 'Custom Template Test',
        link: 'https://example.com/test',
        pubDate: Date.now(),
        description: '',
        content: 'Test content',
        categories: [],
        isImported: false,
        createdAt: Date.now()
      }

      const chunks = await rssService.articleToMarkdown(article, {
        template: '# {title}\n\nSource: {source}\n\n{content}'
      })
      expect(chunks[0]).toContain('# Custom Template Test')
      expect(chunks[0]).toContain('Source: https://example.com/test')
      expect(chunks[0]).toContain('Test content')
    })
  })

  describe('Article Import', () => {
    it('should import article to markdown file', async () => {
      const { fileSystem } = await import('../../services/fileSystem')
      const feed = await rssService.addFeed('https://example.com/feed.xml')
      await rssService.addArticles(feed.id, [{
        title: 'Import Test Article',
        link: 'https://example.com/import-test',
        guid: 'import-test-guid',
        content: '<p>This is the content to import.</p>'
      }])

      const articles = await rssService.getArticles(feed.id)
      const paths = await rssService.importArticle(articles[0].id)

      expect(paths).toHaveLength(1)
      expect(paths[0]).toContain('/RSS/')
      expect(paths[0]).toContain('.md')
      expect(fileSystem.writeFile).toHaveBeenCalled()
      expect(fileSystem.createDirectory).toHaveBeenCalled()
    })

    it('should create nested directories recursively', async () => {
      const { fileSystem } = await import('../../services/fileSystem')
      const feed = await rssService.addFeed('https://example.com/feed.xml', {
        importPath: '/RSS/Nested/Deep/'
      })
      await rssService.addArticles(feed.id, [{
        title: 'Nested Test',
        link: 'https://example.com/nested-test',
        guid: 'nested-test-guid',
        content: '<p>Testing nested paths.</p>'
      }])

      const articles = await rssService.getArticles(feed.id)
      await rssService.importArticle(articles[0].id)

      // 验证 createDirectory 被调用多次（每个目录层级一次）
      expect(fileSystem.createDirectory).toHaveBeenCalled()
      const calls = (fileSystem.createDirectory as any).mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(2)
    })

    it('should handle import path with existing directories', async () => {
      const { fileSystem } = await import('../../services/fileSystem')
      // 模拟目录已存在的情况
      ;(fileSystem.createDirectory as any).mockRejectedValueOnce(new Error('路径已存在'))

      const feed = await rssService.addFeed('https://example.com/feed.xml', {
        importPath: '/RSS/'
      })
      await rssService.addArticles(feed.id, [{
        title: 'Existing Path Test',
        link: 'https://example.com/existing-test',
        guid: 'existing-test-guid',
        content: '<p>Testing existing directories.</p>'
      }])

      const articles = await rssService.getArticles(feed.id)
      // 应该不会抛出错误
      await expect(rssService.importArticle(articles[0].id)).resolves.toBeDefined()
    })
  })
})
