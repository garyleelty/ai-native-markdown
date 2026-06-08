import Dexie, { type Table } from 'dexie'
import type { RSSFeed, RSSArticle, RSSImportOptions, RSSFetchResult } from '../types'
import { fileSystem } from './fileSystem'

class RSSDatabase extends Dexie {
  feeds!: Table<RSSFeed, string>
  articles!: Table<RSSArticle, string>

  constructor() {
    super('AIMarkdownRSS')
    this.version(1).stores({
      feeds: 'id, url, lastFetchedAt, createdAt',
      articles: 'id, feedId, guid, pubDate, isImported, createdAt'
    })
  }
}

const db = new RSSDatabase()

class RSSService {
  // Feed 管理
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
    await db.feeds.add(feed)
    return feed
  }

  async updateFeed(id: string, updates: Partial<RSSFeed>): Promise<RSSFeed> {
    const feed = await db.feeds.get(id)
    if (!feed) throw new Error('Feed not found')
    const updatedFeed = { ...feed, ...updates, updatedAt: Date.now() }
    await db.feeds.put(updatedFeed)
    return updatedFeed
  }

  async deleteFeed(id: string): Promise<void> {
    await db.transaction('rw', [db.feeds, db.articles], async () => {
      await db.feeds.delete(id)
      const allArticles = await db.articles.toArray()
      const toDelete = allArticles.filter(a => a.feedId === id).map(a => a.id)
      for (const articleId of toDelete) {
        await db.articles.delete(articleId)
      }
    })
  }

  async getFeeds(): Promise<RSSFeed[]> {
    return await db.feeds.toArray()
  }

  async getFeed(id: string): Promise<RSSFeed | null> {
    return (await db.feeds.get(id)) || null
  }

  // 文章管理
  async addArticles(feedId: string, articles: Partial<RSSArticle>[]): Promise<void> {
    const now = Date.now()
    const allArticles = await db.articles.toArray()
    const existingGuids = new Set(
      allArticles.filter(a => a.feedId === feedId).map(a => a.guid)
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
      await db.articles.add(article)
    }
  }

  async getArticles(feedId?: string, limit?: number): Promise<RSSArticle[]> {
    let articles = await db.articles.toArray()
    if (feedId) {
      articles = articles.filter(a => a.feedId === feedId)
    }
    articles.sort((a, b) => b.pubDate - a.pubDate)
    if (limit && limit > 0) articles = articles.slice(0, limit)
    return articles
  }

  async getArticle(id: string): Promise<RSSArticle | null> {
    return (await db.articles.get(id)) || null
  }

  async markImported(articleId: string, filePath: string): Promise<void> {
    const article = await db.articles.get(articleId)
    if (!article) throw new Error('Article not found')
    await db.articles.put({
      ...article,
      isImported: true,
      importedPath: filePath,
      importedAt: Date.now()
    })
  }

  // RSS 内容获取和解析
  async fetchFeed(feedId: string): Promise<RSSFetchResult> {
    const feed = await this.getFeed(feedId)
    if (!feed) throw new Error('Feed not found')

    const result: RSSFetchResult = {
      articles: [],
      newArticles: 0,
      updatedArticles: 0,
      skippedArticles: 0
    }

    try {
      const response = await fetch(feed.url)
      const text = await response.text()

      // 简单的 RSS/Atom 解析
      const partialArticles = this.parseRSSFeed(text, feedId)

      // 添加文章
      const allArticles = await db.articles.toArray()
      const existingGuids = new Set(
        allArticles.filter(a => a.feedId === feedId).map(a => a.guid)
      )

      for (const article of partialArticles) {
        if (article.guid) {
          if (existingGuids.has(article.guid)) {
            result.skippedArticles++
            continue
          }
        }
        result.newArticles++
      }

      await this.addArticles(feedId, partialArticles)
      result.articles = await this.getArticles(feedId)

      // 更新 lastFetchedAt
      await this.updateFeed(feedId, { lastFetchedAt: Date.now() })
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Failed to fetch feed'
    }

    return result
  }

  private parseRSSFeed(xml: string, feedId: string): Partial<RSSArticle>[] {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xml, 'text/xml')
    const articles: Partial<RSSArticle>[] = []

    // 尝试解析 RSS 2.0
    let items = doc.querySelectorAll('item')
    if (items.length === 0) {
      // 尝试解析 Atom
      items = doc.querySelectorAll('entry')
    }

    for (const item of items) {
      const article: Partial<RSSArticle> = {
        feedId,
        title: this.getTextContent(item, 'title') || this.getTextContent(item, 'atom\\:title'),
        link: this.getLink(item),
        guid: this.getTextContent(item, 'guid') || this.getLink(item),
        pubDate: this.getPubDate(item),
        author: this.getTextContent(item, 'author') || this.getTextContent(item, 'dc\\:creator'),
        description: this.getTextContent(item, 'description') || this.getTextContent(item, 'summary'),
        content: this.getTextContent(item, 'content\\:encoded') || this.getTextContent(item, 'content') || this.getTextContent(item, 'description'),
        categories: this.getCategories(item),
        imageUrl: this.getImageUrl(item)
      }
      articles.push(article)
    }

    return articles
  }

  private getTextContent(item: Element, tag: string): string {
    const el = item.querySelector(tag)
    return el ? el.textContent || '' : ''
  }

  private getLink(item: Element): string {
    const link = item.querySelector('link')
    if (link) {
      if (link.textContent) return link.textContent
      const href = link.getAttribute('href')
      if (href) return href
    }
    return ''
  }

  private getPubDate(item: Element): number {
    const dateStr = this.getTextContent(item, 'pubDate') || this.getTextContent(item, 'published') || this.getTextContent(item, 'updated')
    if (dateStr) {
      const date = new Date(dateStr)
      if (!isNaN(date.getTime())) return date.getTime()
    }
    return Date.now()
  }

  private getCategories(item: Element): string[] {
    const categories: string[] = []
    const categoryEls = item.querySelectorAll('category')
    categoryEls.forEach(el => {
      if (el.textContent) categories.push(el.textContent)
    })
    return categories
  }

  private getImageUrl(item: Element): string | undefined {
    const enclosure = item.querySelector('enclosure')
    if (enclosure?.getAttribute('type')?.startsWith('image/')) {
      return enclosure.getAttribute('url') || undefined
    }
    const media = item.querySelector('media\\:content')
    if (media?.getAttribute('type')?.startsWith('image/')) {
      return media.getAttribute('url') || undefined
    }
    return undefined
  }

  // 文章分块转 Markdown
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
    } else {
      content = content.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
      content = content.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)')
    }

    if (!opts.includeLinks) {
      content = content.replace(/<a[^>]*>([^<]*)<\/a>/gi, '$1')
    } else {
      content = content.replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '[$2]($1)')
    }

    content = content
      .replace(/<h1[^>]*>/gi, '# ')
      .replace(/<\/h1>/gi, '\n\n')
      .replace(/<h2[^>]*>/gi, '## ')
      .replace(/<\/h2>/gi, '\n\n')
      .replace(/<h3[^>]*>/gi, '### ')
      .replace(/<\/h3>/gi, '\n\n')
      .replace(/<h4[^>]*>/gi, '#### ')
      .replace(/<\/h4>/gi, '\n\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<strong[^>]*>([^<]*)<\/strong>/gi, '**$1**')
      .replace(/<b[^>]*>([^<]*)<\/b>/gi, '**$1**')
      .replace(/<em[^>]*>([^<]*)<\/em>/gi, '*$1*')
      .replace(/<i[^>]*>([^<]*)<\/i>/gi, '*$1*')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<ul[^>]*>/gi, '')
      .replace(/<\/ul>/gi, '\n')
      .replace(/<ol[^>]*>/gi, '')
      .replace(/<\/ol>/gi, '\n')
      .replace(/<code[^>]*>([^<]*)<\/code>/gi, '`$1`')
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```')
      .replace(/<blockquote[^>]*>([^<]*)<\/blockquote>/gi, '> $1')
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

  async importArticle(articleId: string, options?: Partial<RSSImportOptions>): Promise<string[]> {
    const article = await this.getArticle(articleId)
    if (!article) throw new Error('Article not found')

    const chunks = await this.articleToMarkdown(article, options)
    const feed = await this.getFeed(article.feedId)
    const importPath = feed?.importPath || '/RSS/'

    // 确保目录存在（递归创建）
    await this.ensureDirectoryExists(importPath)

    const paths: string[] = []
    const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const suffix = chunks.length > 1 ? `-${i + 1}` : ''
      const filename = `${slug}${suffix}.md`
      const path = `${importPath}${filename}`

      await fileSystem.writeFile(path, chunk)
      paths.push(path)
    }

    // 标记为已导入
    await this.markImported(articleId, paths[0])

    return paths
  }

  private async ensureDirectoryExists(path: string): Promise<void> {
    const parts = path.split('/').filter(Boolean)
    let currentPath = ''
    for (const part of parts) {
      currentPath += '/' + part
      try {
        await fileSystem.createDirectory(currentPath)
      } catch {
        // 目录已存在，忽略错误
      }
    }
  }
}

export const rssService = new RSSService()
export { db as rssDb }
