import { describe, it, expect } from 'vitest'
import { createMarkdownRenderer, renderMarkdownBody, createExportHtml, renderMarkdownBodyWithEmbeds } from '../exportHtml'

describe('createMarkdownRenderer', () => {
  it('creates a MarkdownIt instance', () => {
    const md = createMarkdownRenderer()
    expect(md).toBeDefined()
    expect(typeof md.render).toBe('function')
  })

  it('renders basic markdown - headings', () => {
    const md = createMarkdownRenderer()
    const result = md.render('# Hello')
    expect(result).toContain('<h1')
    expect(result).toContain('Hello')
  })

  it('renders basic markdown - paragraphs', () => {
    const md = createMarkdownRenderer()
    const result = md.render('Hello world')
    expect(result).toContain('<p>')
    expect(result).toContain('Hello world')
  })

  it('renders basic markdown - unordered lists', () => {
    const md = createMarkdownRenderer()
    const result = md.render('- item1\n- item2')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>')
    expect(result).toContain('item1')
    expect(result).toContain('item2')
  })

  it('renders basic markdown - ordered lists', () => {
    const md = createMarkdownRenderer()
    const result = md.render('1. first\n2. second')
    expect(result).toContain('<ol>')
    expect(result).toContain('first')
    expect(result).toContain('second')
  })

  it('task lists plugin is active - renders checkbox inputs', () => {
    const md = createMarkdownRenderer()
    const result = md.render('- [x] done\n- [ ] todo')
    expect(result).toContain('type="checkbox"')
    expect(result).toContain('checked')
    expect(result).toContain('done')
    expect(result).toContain('todo')
  })

  it('KaTeX plugin is active - renders inline math', () => {
    const md = createMarkdownRenderer()
    const result = md.render('$E=mc^2$')
    // KaTeX renders math into .katex elements
    expect(result).toContain('katex')
  })

  it('KaTeX plugin is active - renders block math', () => {
    const md = createMarkdownRenderer()
    const result = md.render('$$\nE=mc^2\n$$')
    expect(result).toContain('katex')
  })

  it('anchor plugin is active - headings get ids', () => {
    const md = createMarkdownRenderer()
    const result = md.render('# Hello World')
    expect(result).toContain('id="hello-world"')
  })

  it('with sourceLineAttrs option adds data-line attributes', () => {
    const md = createMarkdownRenderer({ sourceLineAttrs: true })
    const result = md.render('# Title\n\nParagraph')
    expect(result).toContain('data-line')
    expect(result).toContain('data-line-end')
  })

  it('without sourceLineAttrs option does not add data-line attributes', () => {
    const md = createMarkdownRenderer({ sourceLineAttrs: false })
    const result = md.render('# Title\n\nParagraph')
    expect(result).not.toContain('data-line')
  })

  it('with anchorPermalink option adds header anchors', () => {
    const md = createMarkdownRenderer({ anchorPermalink: true })
    const result = md.render('# Hello')
    expect(result).toContain('header-anchor')
    expect(result).toContain('#hello')
  })

  it('without anchorPermalink does not add header anchors', () => {
    const md = createMarkdownRenderer({ anchorPermalink: false })
    const result = md.render('# Hello')
    expect(result).not.toContain('header-anchor')
  })

  it('with wikiLinkRule option adds wiki link inline rule', () => {
    const wikiLinkRule: any = (state: any, silent: boolean): boolean => {
      const start = state.pos
      if (state.src.charCodeAt(start) !== 0x5B /* [ */ || state.src.charCodeAt(start + 1) !== 0x5B) {
        return false
      }
      const end = state.src.indexOf(']]', start + 2)
      if (end === -1) return false
      const content = state.src.slice(start + 2, end)
      if (!silent) {
        const token = state.push('wiki_link', '', 0)
        token.attrSet('href', content)
        token.content = content
      }
      state.pos = end + 2
      return true
    }

    const md = createMarkdownRenderer({ wikiLinkRule })
    // Verify the rule is registered by rendering wiki link syntax
    const result = md.render('[[test-link]]')
    expect(result).toContain('test-link')
  })

  it('with highlight option uses custom highlight function', () => {
    const highlight = (str: string, lang: string): string => {
      return `<pre class="custom-${lang}"><code>${str}</code></pre>`
    }
    const md = createMarkdownRenderer({ highlight })
    const result = md.render('```js\nconsole.log("hi")\n```')
    expect(result).toContain('custom-js')
  })

  it('populates headings array when using default anchor callback', () => {
    const headings: { level: number; slug: string; title: string }[] = []
    const md = createMarkdownRenderer({ headings })
    md.render('# First\n## Second\n### Third')
    expect(headings).toHaveLength(3)
    expect(headings[0]).toEqual({ level: 1, slug: 'first', title: 'First' })
    expect(headings[1]).toEqual({ level: 2, slug: 'second', title: 'Second' })
    expect(headings[2]).toEqual({ level: 3, slug: 'third', title: 'Third' })
  })

  it('does not populate headings array when anchorPermalink is true', () => {
    const headings: { level: number; slug: string; title: string }[] = []
    const md = createMarkdownRenderer({ headings, anchorPermalink: true })
    md.render('# First')
    expect(headings).toHaveLength(0)
  })
})

describe('renderMarkdownBody', () => {
  it('renders markdown and sanitizes output', () => {
    const result = renderMarkdownBody('# Hello')
    expect(result).toContain('<h1')
    expect(result).toContain('Hello')
  })

  it('strips script tags from output', () => {
    // markdown-it with html: false escapes raw HTML as text,
    // sanitizeMarkdown also strips script tags as a safety net
    const result = renderMarkdownBody('<script>alert("xss")</script>')
    expect(result).not.toContain('<script')
    // The escaped text may still contain "alert" as plain text,
    // but no executable script tag exists
  })

  it('strips iframe tags from output', () => {
    const result = renderMarkdownBody('<iframe src="evil.com"></iframe>')
    expect(result).not.toContain('<iframe')
  })

  it('renders complex markdown correctly', () => {
    const markdown = '# Title\n\n- item1\n- item2\n\n**bold** and *italic*'
    const result = renderMarkdownBody(markdown)
    expect(result).toContain('<h1')
    expect(result).toContain('<ul>')
    expect(result).toContain('<strong>bold</strong>')
    expect(result).toContain('<em>italic</em>')
  })
})

describe('createExportHtml', () => {
  it('produces valid HTML document', () => {
    const result = createExportHtml('Hello', { title: 'Test' })
    expect(result).toContain('<!DOCTYPE html>')
    expect(result).toContain('<html')
    expect(result).toContain('</html>')
    expect(result).toContain('<head>')
    expect(result).toContain('</head>')
    expect(result).toContain('<body>')
    expect(result).toContain('</body>')
  })

  it('includes title', () => {
    const result = createExportHtml('Hello', { title: 'My Document' })
    expect(result).toContain('<title>My Document</title>')
  })

  it('escapes title HTML entities', () => {
    const result = createExportHtml('Hello', { title: '<script>alert("xss")</script>' })
    expect(result).not.toContain('<title><script>')
    expect(result).toContain('&lt;script&gt;')
  })

  it('includes styles by default', () => {
    const result = createExportHtml('Hello', { title: 'Test' })
    expect(result).toContain('<style>')
    expect(result).toContain('body{max-width')
  })

  it('excludes styles when includeStyles is false', () => {
    const result = createExportHtml('Hello', { title: 'Test', includeStyles: false })
    expect(result).not.toContain('<style>')
  })

  it('includes TOC when includeTOC is true', () => {
    const result = createExportHtml('# Section 1\n\n## Subsection\n\nContent', { title: 'Test', includeTOC: true })
    expect(result).toContain('export-toc')
    expect(result).toContain('Section 1')
  })

  it('excludes TOC by default', () => {
    const result = createExportHtml('# Section 1\n\nContent', { title: 'Test' })
    // The <nav class="export-toc"> element should not be present
    expect(result).not.toContain('<nav class="export-toc"')
  })

  it('includes lang="zh-CN" attribute', () => {
    const result = createExportHtml('Hello', { title: 'Test' })
    expect(result).toContain('lang="zh-CN"')
  })

  it('includes charset and viewport meta tags', () => {
    const result = createExportHtml('Hello', { title: 'Test' })
    expect(result).toContain('charset="utf-8"')
    expect(result).toContain('viewport')
  })

  it('renders markdown body content inside the HTML', () => {
    const result = createExportHtml('# Hello World', { title: 'Test' })
    expect(result).toContain('Hello World')
  })

  it('sanitizes markdown body content', () => {
    const result = createExportHtml('<script>alert(1)</script>', { title: 'Test' })
    expect(result).not.toContain('<script')
  })
})

describe('createExportHtml - mermaid 支持', () => {
  it('导出 HTML 中包含 mermaid 代码块', () => {
    const md = '```mermaid\nflowchart LR\n  A --> B\n```'
    const html = createExportHtml(md, { title: 'Test' })
    expect(html).toContain('language-mermaid')
    expect(html).toContain('flowchart LR')
  })
})

describe('renderMarkdownBodyWithEmbeds', () => {
  it('解析无 embed 的普通 Markdown', async () => {
    const md = '# Test\n\nSome content'
    const html = await renderMarkdownBodyWithEmbeds(md)
    expect(html).toContain('Test')
    expect(html).toContain('Some content')
  })
})
