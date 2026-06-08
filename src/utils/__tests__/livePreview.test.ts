import { describe, it, expect } from 'vitest'
import { renderMarkdownBody } from '@/utils/exportHtml'

describe('renderMarkdownBody', () => {
  it('渲染 mermaid 代码块为带 language-mermaid 类的 code 元素', () => {
    const md = '```mermaid\nflowchart LR\n  A --> B\n```'
    const html = renderMarkdownBody(md)
    expect(html).toContain('language-mermaid')
    expect(html).toContain('flowchart LR')
    expect(html).toContain('A --&gt; B')
  })

  it('渲染普通代码块为 pre>code', () => {
    const md = '```js\nconsole.log("hello")\n```'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<pre')
    expect(html).toContain('<code')
    expect(html).toContain('console.log')
  })

  it('渲染标题带锚点', () => {
    const md = '# Hello World'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<h1')
    expect(html).toContain('Hello World')
  })

  it('渲染任务列表', () => {
    const md = '- [x] done\n- [ ] todo'
    const html = renderMarkdownBody(md)
    expect(html).toContain('task-list-item')
    expect(html).toContain('checkbox')
  })

  it('渲染 KaTeX 行内公式', () => {
    const md = '行内公式：$E = mc^2$'
    const html = renderMarkdownBody(md)
    expect(html).toContain('katex')
  })

  it('渲染 KaTeX 块级公式', () => {
    const md = '$$\n\\int_0^1 x^2 dx = \\frac{1}{3}\n$$'
    const html = renderMarkdownBody(md)
    expect(html).toContain('katex-display')
  })

  it('渲染普通链接', () => {
    const md = '[link](https://example.com)'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<a')
    expect(html).toContain('https://example.com')
  })

  it('渲染 embed 占位符', () => {
    const md = '![[other-note]]'
    const html = renderMarkdownBody(md)
    expect(html).toContain('embed')
    expect(html).toContain('data-target="other-note"')
  })

  it('渲染带标题的 embed 占位符', () => {
    const md = '![[other-note#Section]]'
    const html = renderMarkdownBody(md)
    expect(html).toContain('embed')
    expect(html).toContain('data-target="other-note"')
    expect(html).toContain('data-heading="Section"')
  })

  it('渲染表格', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<table')
    expect(html).toContain('<th')
  })

  it('渲染引用块', () => {
    const md = '> 引用内容'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<blockquote')
  })

  it('渲染分隔线', () => {
    const md = '---'
    const html = renderMarkdownBody(md)
    expect(html).toContain('<hr')
  })

  it('空内容返回空字符串', () => {
    const html = renderMarkdownBody('')
    expect(html).toBe('')
  })
})
