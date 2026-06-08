import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { RSSFeed, RSSArticle, RSSImportOptions } from '../../types'

// 创建内存模拟 DB
class MockRSSDB {
  feeds = new Map<string, RSSFeed>()
  articles = new Map<string, RSSArticle>()

  async clear() {
    this.feeds.clear()
    this.articles.clear()
  }
}

const mockDB = new MockRSSDB()

// 模拟服务
const rssService = {
  async addFeed(url: string, options?: Partial<RSSFeed>): Promise<RSSFeed> {
    const id = Math.random().toString(36).substring(2, 15)
    const now = Date.now()
    const feed: RSSFeed = {
      id,
      url,
      title: options?.title || '',
      description: options?.description || '',
      siteUrl: options?.siteUrl || new URL(url).origin,
      fetchIntervalMinutes: options?.fetchIntervalMinutes || 60,
      autoImport: options?.autoImport || false,
      importPath: options?.importPath || '/RSS/',
      createdAt: now,
      updatedAt: now
    }
    mockDB.feeds.set(id, feed)
    return feed
  },

  async updateFeed(id: string, updates: Partial<RSSFeed>): Promise<RSSFeed> {
    const feed = mockDB.feeds.get(id)
    if (!feed) throw new Error('Feed not found')
    const updatedFeed = { ...feed, ...updates, updatedAt: Date.now() }
    mockDB.feeds.set(id, updatedFeed)
    return updatedFeed
  },

  async deleteFeed(id: string): Promise<void> {
    mockDB.feeds.delete(id)
    const articlesToDelete: string[] = []
    mockDB.articles.forEach((article, articleId) => {
      if (article.feedId === id) articlesToDelete.push(articleId)
    })
    articlesToDelete.forEach(articleId => mockDB.articles.delete(articleId))
  },

  async getFeeds(): Promise<RSSFeed[]> {
    return Array.from(mockDB.feeds.values())
  },

  async getFeed(id: string): Promise<RSSFeed | null> {
    return mockDB.feeds.get(id) || null
  },

  async addArticles(feedId: string, articles: Partial<RSSArticle>[]): Promise<void> {
    const now = Date.now()
    const existingGuids = new Set(
      Array.from(mockDB.articles.values()).filter(a => a.feedId === feedId).map(a => a.guid)
    )

    for (const articleData of articles) {
      if (articleData.guid && existingGuids.has(articleData.guid)) continue

      const id = Math.random().toString(36).substring(2, 15)
      const article: RSSArticle = {
        id,
        feedId,
        guid: articleData.guid || id,
        title: articleData.title || '',
        link: articleData.link || '',
        pubDate: articleData.pubDate || now,
        description: articleData.description || '',
        content: articleData.content || '',
        categories: articleData.categories || [],
        imageUrl: articleData.imageUrl,
        isImported: false,
        createdAt: now
      }
      mockDB.articles.set(id, article)
    }
  },

  async getArticles(feedId?: string, limit?: number): Promise<RSSArticle[]> {
    let articles = Array.from(mockDB.articles.values())
    if (feedId) articles = articles.filter(a => a.feedId === feedId)
    articles.sort((a, b) => b.pubDate - a.pubDate)
    if (limit && limit > 0) articles = articles.slice(0, limit)
    return articles
  },

  async markImported(articleId: string, filePath: string): Promise<void> {
    const article = mockDB.articles.get(articleId)
    if (!article) throw new Error('Article not found')
    mockDB.articles.set(articleId, {
      ...article,
      isImported: true,
      importedPath: filePath,
      importedAt: Date.now()
    })
  },

  async articleToMarkdown(article: RSSArticle, options?: Partial<RSSImportOptions>): Promise<string[]> {
    const opts: RSSImportOptions = {
      chunkSize: options?.chunkSize || 1000,
      includeImages: options?.includeImages !== false,
      includeLinks: options?.includeLinks !== false,
      template: options?.template || `---
title: "{title}"
author: "{author}"
date: "{date}"
source: "{source}"
tags: {tags}
---

{content}
`
    }

    let content = article.content || article.description || ''

    if (!opts.includeImages) {
      content = content.replace(/<img[^>]*>/gi, '')
    }

    if (!opts.includeLinks) {
      content = content.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    }

    content = content
      .replace(/<h1[^>]*>/gi, '# ')
      .replace(/<\/h1>/gi, '\n\n')
      .replace(/<h2[^>]*>/gi, '## ')
      .replace(/<\/h2>/gi, '\n\n')
      .replace(/<h3[^>]*>/gi, '### ')
      .replace(/<\/h3>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([^<]*)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([^<]*)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .trim()

    const date = new Date(article.pubDate)
    let markdown = opts.template
      .replace(/\{title\}/g, article.title)
      .replace(/\{author\}/g, article.author || '')
      .replace(/\{date\}/g, date.toISOString().split('T')[0])
      .replace(/\{source\}/g, article.link)
      .replace(/\{tags\}/g, JSON.stringify(article.categories || []))
      .replace(/\{content\}/g, content)

    const chunks: string[] = []
    if (opts.chunkSize <= 0 || markdown.length <= opts.chunkSize) {
      chunks.push(markdown)
    } else {
      const paragraphs = markdown.split('\n\n')
      let currentChunk = ''

      for (const para of paragraphs) {
        if ((currentChunk + '\n\n' + para).length <= opts.chunkSize || currentChunk.length === 0) {
          currentChunk = currentChunk ? currentChunk + '\n\n' + para : para
        } else {
          chunks.push(currentChunk)
          currentChunk = para
        }
      }

      if (currentChunk) chunks.push(currentChunk)
    }

    return chunks
  }
}

describe('RSS Service', () => {
  beforeEach(async () => {
    await mockDB.clear()
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
})
