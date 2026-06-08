import { describe, it, expect } from 'vitest'
import { createMarkdownRenderer } from '@/utils/exportHtml'

describe('createMarkdownRenderer', () => {
  it('创建的实例包含 taskLists 插件', () => {
    const md = createMarkdownRenderer()
    const html = md.render('- [x] done\n- [ ] todo')
    expect(html).toContain('task-list-item')
    expect(html).toContain('checkbox')
  })

  it('创建的实例包含 anchor 插件', () => {
    const headings: { level: number; slug: string; title: string }[] = []
    const md = createMarkdownRenderer({ headings })
    md.render('# Hello World')
    expect(headings.length).toBe(1)
    expect(headings[0].title).toBe('Hello World')
    expect(headings[0].level).toBe(1)
  })

  it('创建的实例包含 KaTeX 插件', () => {
    const md = createMarkdownRenderer()
    const html = md.render('$E = mc^2$')
    expect(html).toContain('katex')
  })

  it('sourceLineAttrs 选项添加 data-line 属性', () => {
    const md = createMarkdownRenderer({ sourceLineAttrs: true })
    const html = md.render('# Title\n\nParagraph')
    expect(html).toContain('data-line="1"')
  })

  it('wikiLinkRule 选项支持 [[链接]]', () => {
    const md = createMarkdownRenderer({
      wikiLinkRule: (state: any, silent: boolean) => {
        const start = state.pos
        if (state.src.charCodeAt(start) !== 0x5B || state.src.charCodeAt(start + 1) !== 0x5B) return false
        const end = state.src.indexOf(']]', start + 2)
        if (end === -1) return false
        const raw = state.src.slice(start + 2, end)
        if (!raw.trim() || raw.includes('\n')) return false
        if (!silent) {
          const linkOpen = state.push('link_open', 'a', 1)
          linkOpen.attrSet('href', '#')
          linkOpen.attrSet('class', 'wiki-link')
          linkOpen.attrSet('data-filename', raw.trim())
          const textToken = state.push('text', '', 0)
          textToken.content = raw.trim()
          state.push('link_close', 'a', -1)
        }
        state.pos = end + 2
        return true
      }
    })
    const html = md.render('See [[My Note]] for details')
    expect(html).toContain('wiki-link')
    expect(html).toContain('My Note')
  })

  it('anchorPermalink 选项添加 header-anchor', () => {
    const md = createMarkdownRenderer({ anchorPermalink: true })
    const html = md.render('# Title')
    expect(html).toContain('header-anchor')
  })

  it('highlight 选项自定义代码高亮', () => {
    const md = createMarkdownRenderer({
      highlight: (str: string, lang: string) => {
        return `<pre class="custom-hljs"><code>${str}</code></pre>`
      }
    })
    const html = md.render('```js\nhello\n```')
    expect(html).toContain('custom-hljs')
  })

  it('html 选项默认禁用', () => {
    const md = createMarkdownRenderer()
    const html = md.render('<script>alert("xss")</script>')
    expect(html).not.toContain('<script>')
  })
})
